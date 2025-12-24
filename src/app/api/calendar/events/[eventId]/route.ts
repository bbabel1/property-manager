/**
 * Google Calendar Event API
 * 
 * GET /api/calendar/events/[eventId]
 * Get single event
 * 
 * PUT /api/calendar/events/[eventId] (Phase 2)
 * Update event
 * 
 * DELETE /api/calendar/events/[eventId] (Phase 2)
 * Delete event
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getCalendarClient, withRateLimitRetry, formatCalendarError } from '@/lib/calendar/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { eventId } = await params;

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

    // Fetch event with rate limit retry
    const event = await withRateLimitRetry(async () => {
      const response = await calendar.events.get({
        calendarId: integration.calendar_id,
        eventId,
      });
      return response.data;
    });

    return NextResponse.json({ event });
  } catch (error: unknown) {
    console.error('Error fetching Google Calendar event:', error);

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

// PUT and DELETE handlers for Phase 2
export async function PUT() {
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Event updates are not available in MVP' } },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Event deletion is not available in MVP' } },
    { status: 501 }
  );
}
