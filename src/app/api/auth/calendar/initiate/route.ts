/**
 * Google Calendar OAuth Initiation
 * 
 * GET /api/auth/calendar/initiate
 * Initiates Google OAuth flow for Google Calendar integration
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { generateStateToken, setOAuthState, buildGoogleOAuthUrl } from '@/lib/calendar/oauth';

export async function GET() {
  try {
    // Verify authentication
    const auth = await requireAuth();

    // Verify user has Staff role
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

    // Generate and store state token with user context
    const state = generateStateToken();
    await setOAuthState(state, auth.user.id);

    // Build OAuth URL
    const authUrl = buildGoogleOAuthUrl(state);

    // Redirect to Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google Calendar OAuth:', error);
    return NextResponse.json(
      { error: { code: 'OAUTH_INITIATION_FAILED', message: error instanceof Error ? error.message : 'Failed to initiate OAuth flow' } },
      { status: 500 }
    );
  }
}

