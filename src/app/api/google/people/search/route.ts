import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getStaffCalendarIntegration, getAccessToken } from '@/lib/calendar/token-manager';

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    if (!query || query.length < 2) {
      return NextResponse.json({ people: [] });
    }

    const integration = await getStaffCalendarIntegration(auth.user.id, membership.org_id);
    if (!integration) {
      return NextResponse.json(
        { error: { code: 'INTEGRATION_NOT_FOUND', message: 'Google Calendar integration not found' } },
        { status: 404 }
      );
    }

    const accessToken = await getAccessToken(integration);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendar/callback`
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const peopleApi = google.people({ version: 'v1', auth: oauth2Client });
    const res = await peopleApi.people.searchContacts({
      query,
      pageSize: 10,
      readMask: 'names,emailAddresses,photos',
    });

    const people =
      res.data.results?.map((result) => {
        const name = result.person?.names?.[0]?.displayName || '';
        const email = result.person?.emailAddresses?.[0]?.value || '';
        const photoUrl = result.person?.photos?.[0]?.url || '';
        return { name, email, photoUrl };
      }) || [];

    return NextResponse.json({ people });
  } catch (error: any) {
    console.error('Error searching People API:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Insufficient scopes (needs contacts.readonly). Instruct user to reconnect Calendar.
    if (error?.code === 403 || error?.response?.status === 403) {
      return NextResponse.json(
        {
          error: {
            code: 'INSUFFICIENT_SCOPES',
            message:
              'Google contact access not granted. Please disconnect and reconnect your Google Calendar to grant contacts.readonly.',
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: { code: 'PEOPLE_API_ERROR', message: error?.message || 'Failed to search contacts' } },
      { status: error?.response?.status || 500 }
    );
  }
}
