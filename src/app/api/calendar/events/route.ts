/**
 * Google Calendar Events API
 * 
 * GET /api/calendar/events
 * List events from Google Calendar
 * 
 * POST /api/calendar/events (Phase 2 - MVP is read-only)
 * Create new event
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getCalendarClient, withRateLimitRetry, formatCalendarError } from '@/lib/calendar/client';
import type { calendar_v3 } from 'googleapis';

type AttendeeInput = { email?: string | null; name?: string | null };

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();

    // Verify staff record exists and is active
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, user_id, is_active')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: { code: 'STAFF_NOT_FOUND', message: 'Staff record not found or inactive' } },
        { status: 403 }
      );
    }

    // Get user's org_id from org_memberships
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: { code: 'ORG_NOT_FOUND', message: 'Organization membership not found' } },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin');
    const timeMax = url.searchParams.get('timeMax');
    const maxResults = parseInt(url.searchParams.get('maxResults') || '250', 10);

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'timeMin and timeMax are required' } },
        { status: 400 }
      );
    }

    // Get Calendar client
    const calendar = await getCalendarClient(auth.user.id, membership.org_id);
    const integration = await import('@/lib/calendar/token-manager').then(m => 
      m.getStaffCalendarIntegration(auth.user.id, membership.org_id)
    );
    
    if (!integration) {
      return NextResponse.json(
        { error: { code: 'INTEGRATION_NOT_FOUND', message: 'Google Calendar integration not found' } },
        { status: 404 }
      );
    }

    // Fetch events with rate limit retry
    const events = await withRateLimitRetry(async () => {
      const response = await calendar.events.list({
        calendarId: integration.calendar_id,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return response.data.items || [];
    });

    return NextResponse.json({ events });
  } catch (error: unknown) {
    console.error('Error fetching Google Calendar events:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const formattedError = formatCalendarError(error);
    return NextResponse.json(
      { error: formattedError },
      { status: (error as { response?: { status?: number } })?.response?.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, user_id, is_active')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: { code: 'STAFF_NOT_FOUND', message: 'Staff record not found or inactive' } },
        { status: 403 }
      );
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: { code: 'ORG_NOT_FOUND', message: 'Organization membership not found' } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      summary,
      description,
      location,
      start,
      end,
      attendees = [],
      allDay = false,
      addConference = false,
      timeZone,
    } = body;

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'summary, start, and end are required' } },
        { status: 400 }
      );
    }

    const calendar = await getCalendarClient(auth.user.id, membership.org_id);
    const integration = await import('@/lib/calendar/token-manager').then((m) =>
      m.getStaffCalendarIntegration(auth.user.id, membership.org_id)
    );

    if (!integration) {
      return NextResponse.json(
        { error: { code: 'INTEGRATION_NOT_FOUND', message: 'Google Calendar integration not found' } },
        { status: 404 }
      );
    }

    const allDayEnd = allDay ? new Date(end) : null;
    if (allDayEnd) {
      allDayEnd.setDate(allDayEnd.getDate() + 1); // Google expects exclusive end date for all-day
    }

    const attendeeList: calendar_v3.Schema$EventAttendee[] = Array.isArray(attendees)
      ? (attendees as AttendeeInput[])
          .filter((a) => typeof a?.email === 'string' && a.email.trim())
          .map((a) => ({
            email: a.email?.trim(),
            displayName: a.name?.trim() || undefined,
          }))
      : [];

    const resolvedTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const event: calendar_v3.Schema$Event = {
      summary,
      description,
      location,
      attendees: attendeeList.length ? attendeeList : undefined,
      start: allDay
        ? { date: start }
        : { dateTime: start, timeZone: resolvedTimeZone },
      end: allDay
        ? { date: allDayEnd?.toISOString().slice(0, 10) }
        : { dateTime: end, timeZone: resolvedTimeZone },
    };

    if (addConference) {
      event.conferenceData = {
        createRequest: {
          requestId: `ora-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const created = await withRateLimitRetry(async () => {
      const res = await calendar.events.insert({
        calendarId: integration.calendar_id,
        requestBody: event,
        conferenceDataVersion: addConference ? 1 : 0,
      });
      return res.data;
    });

    return NextResponse.json({ event: created });
  } catch (error: unknown) {
    console.error('Error creating Google Calendar event:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const formattedError = formatCalendarError(error);
    return NextResponse.json(
        { error: formattedError },
        { status: (error as { response?: { status?: number } })?.response?.status || 500 }
    );
  }
}
