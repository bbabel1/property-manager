/**
 * Gmail OAuth Initiation
 * 
 * GET /api/auth/gmail/initiate
 * Initiates Google OAuth flow for Gmail integration
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { generateStateToken, setOAuthState, buildGoogleOAuthUrl } from '@/lib/google/oauth';

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

    // Generate and store state token
    const state = generateStateToken();
    await setOAuthState({
      state,
      userId: auth.user.id,
      flow: 'gmail',
      createdAt: Date.now(),
    });

    // Build OAuth URL
    const authUrl = buildGoogleOAuthUrl('gmail', state);

    // Redirect to Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Gmail OAuth:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate OAuth flow' } },
      { status: 500 }
    );
  }
}
