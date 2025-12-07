/**
 * Gmail OAuth Callback
 * 
 * GET /api/auth/gmail/callback
 * Handles Google OAuth callback and stores tokens
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOAuthState, clearOAuthState, validateRedirectUri } from '@/lib/gmail/oauth';
import { storeGmailIntegration } from '@/lib/gmail/token-manager';
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
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Validate state token
    const storedState = await getOAuthState();
    if (!storedState || storedState !== state) {
      await clearOAuthState();
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Invalid state token')}`
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
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Staff record not found or inactive')}`
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
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Organization membership not found')}`
      );
    }

    const orgId = membership.org_id;

    // Exchange authorization code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Google OAuth not configured')}`
      );
    }

    // Validate redirect URI
    if (!validateRedirectUri(redirectUri)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Invalid redirect URI')}`
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Failed to obtain access token')}`
      );
    }

    // Fetch user's Gmail address
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    if (!profile.data.emailAddress) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Failed to fetch Gmail address')}`
      );
    }

    const email = profile.data.emailAddress;

    // Validate Gmail domain
    if (!email.match(/@(gmail|googlemail)\.com$/i)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Only Gmail accounts are supported')}`
      );
    }

    // Store integration (will preserve existing refresh token if new one not provided)
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

    // Redirect to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=gmail`
    );
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent('Authentication required')}`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=gmail&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
}

