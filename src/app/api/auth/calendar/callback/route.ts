/**
 * Google Calendar OAuth Callback
 * 
 * GET /api/auth/calendar/callback
 * Handles Google OAuth callback and stores tokens
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOAuthState, clearOAuthState, validateRedirectUri } from '@/lib/calendar/oauth';
import { storeCalendarIntegration } from '@/lib/calendar/token-manager';
import { google } from 'googleapis';

export async function GET(request: Request) {
  try {
    // Verify authentication
    const auth = await requireAuth();

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Validate state token with user context
    const storedState = await getOAuthState(auth.user.id);
    if (!storedState || storedState !== state) {
      await clearOAuthState();
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Invalid state token')}`
      );
    }

    // Clear state cookie
    await clearOAuthState();

    // Verify staff record exists and is active
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, user_id, is_active')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .single();

    if (staffError || !staff) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Staff record not found or inactive')}`
      );
    }

    // Get org_id from org_memberships
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Organization membership not found')}`
      );
    }

    const orgId = membership.org_id;

    // Exchange authorization code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendar/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Google OAuth not configured')}`
      );
    }

    // Validate redirect URI
    if (!validateRedirectUri(redirectUri)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Invalid redirect URI')}`
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Failed to obtain access token')}`
      );
    }

    // Fetch user's calendar info
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get user's primary calendar
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary) || calendarList.data.items?.[0];
    
    if (!primaryCalendar) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Failed to fetch calendar information')}`
      );
    }

    const calendarId = primaryCalendar.id || 'primary';

    // Prefer an email-looking value for the calendar owner; fall back to auth user email.
    const emailCandidates: string[] = [];
    if (primaryCalendar.id) emailCandidates.push(primaryCalendar.id);
    if (primaryCalendar.summary) emailCandidates.push(primaryCalendar.summary);

    try {
      const primaryDetails = await calendar.calendarList.get({ calendarId: calendarId === 'primary' ? 'primary' : calendarId });
      if (primaryDetails.data.id) emailCandidates.push(primaryDetails.data.id);
      if (primaryDetails.data.summary) emailCandidates.push(primaryDetails.data.summary);
    } catch (fetchErr) {
      console.warn('Failed to fetch primary calendar details', fetchErr);
    }

    if (auth.user.email) emailCandidates.push(auth.user.email);

    const email = emailCandidates.find((value) => /^[^@\s]+@[^@\s]+$/.test(value)) || '';

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Failed to determine calendar email')}`
      );
    }

    // Store integration (will preserve existing refresh token if new one not provided)
    await storeCalendarIntegration(
      staff.id,
      auth.user.id,
      orgId,
      email || auth.user.email || '',
      calendarId,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      tokens.scope || 'https://www.googleapis.com/auth/calendar'
    );

    // Redirect to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=calendar`
    );
  } catch (error) {
    console.error('Error in Google Calendar OAuth callback:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent('Authentication required')}`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=calendar&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
}
