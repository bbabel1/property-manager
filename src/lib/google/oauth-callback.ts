import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import {
  clearOAuthState,
  getOAuthState,
  resolveRedirectUri,
  validateRedirectUri,
  type GoogleOAuthFlow,
} from './oauth';
import { storeGmailIntegration } from '@/lib/gmail/token-manager';
import { storeCalendarIntegration } from '@/lib/calendar/token-manager';

function buildSettingsRedirect(flow: GoogleOAuthFlow, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?${search.toString()}`);
}

export async function handleGoogleOAuthCallback(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    // Try to peek flow from state cookie to keep error redirects specific.
    const statePayload = await getOAuthState(auth.user.id);
    const inferredFlow: GoogleOAuthFlow = statePayload?.flow || 'gmail';

    if (oauthError) {
      return buildSettingsRedirect(inferredFlow, {
        error: inferredFlow,
        message: oauthError,
      });
    }

    if (!code || !stateParam) {
      return buildSettingsRedirect(inferredFlow, {
        error: inferredFlow,
        message: 'Missing authorization code or state',
      });
    }

    // Validate state token
    if (!statePayload || statePayload.state !== stateParam) {
      await clearOAuthState();
      return buildSettingsRedirect(inferredFlow, {
        error: inferredFlow,
        message: 'Invalid state token',
      });
    }

    await clearOAuthState();
    const flow = statePayload.flow;

    // Verify staff record exists and is active
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, user_id, is_active')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .single();

    if (staffError || !staff) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Staff record not found or inactive',
      });
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
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Organization membership not found',
      });
    }

    const orgId = membership.org_id;

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = resolveRedirectUri(flow);

    if (!clientId || !clientSecret) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Google OAuth not configured',
      });
    }

    if (!validateRedirectUri(flow, redirectUri)) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Invalid redirect URI',
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Failed to obtain access token',
      });
    }

    oauth2Client.setCredentials(tokens);

    if (flow === 'gmail') {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      if (!profile.data.emailAddress) {
        return buildSettingsRedirect(flow, {
          error: flow,
          message: 'Failed to fetch Gmail address',
        });
      }

      const email = profile.data.emailAddress;

      const allowedDomainsEnv = process.env.GMAIL_ALLOWED_DOMAINS || '';
      const allowedDomains = allowedDomainsEnv
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      if (allowedDomains.length > 0) {
        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const isGmail = /@(gmail|googlemail)\.com$/i.test(email);
        const isAllowed = allowedDomains.includes(emailDomain);
        if (!isGmail && !isAllowed) {
          return buildSettingsRedirect(flow, {
            error: flow,
            message: 'Email domain not allowed for Gmail integration',
          });
        }
      }

      await storeGmailIntegration(
        staff.id,
        auth.user.id,
        orgId,
        email,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
        tokens.scope || 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly'
      );

      return buildSettingsRedirect(flow, { connected: flow });
    }

    // Calendar flow
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar =
      calendarList.data.items?.find((cal) => cal.primary) || calendarList.data.items?.[0];

    if (!primaryCalendar) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Failed to fetch calendar information',
      });
    }

    const calendarId = primaryCalendar.id || 'primary';
    const emailCandidates: string[] = [];
    if (primaryCalendar.id) emailCandidates.push(primaryCalendar.id);
    if (primaryCalendar.summary) emailCandidates.push(primaryCalendar.summary);

    try {
      const primaryDetails = await calendar.calendarList.get({
        calendarId: calendarId === 'primary' ? 'primary' : calendarId,
      });
      if (primaryDetails.data.id) emailCandidates.push(primaryDetails.data.id);
      if (primaryDetails.data.summary) emailCandidates.push(primaryDetails.data.summary);
    } catch (fetchErr) {
      console.warn('Failed to fetch primary calendar details', fetchErr);
    }

    if (auth.user.email) emailCandidates.push(auth.user.email);

    const email = emailCandidates.find((value) => /^[^@\s]+@[^@\s]+$/.test(value)) || '';

    if (!email) {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Failed to determine calendar email',
      });
    }

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

    return buildSettingsRedirect(flow, { connected: flow });
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);

    const flow: GoogleOAuthFlow = 'gmail';
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return buildSettingsRedirect(flow, {
        error: flow,
        message: 'Authentication required',
      });
    }

    return buildSettingsRedirect(flow, {
      error: flow,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
