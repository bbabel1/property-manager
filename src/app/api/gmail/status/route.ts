/**
 * Gmail Integration Status
 * 
 * GET /api/gmail/status
 * Returns the current Gmail integration status for the authenticated user
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getStaffGmailIntegration } from '@/lib/gmail/token-manager';

export async function GET() {
  try {
    const auth = await requireAuth();

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

    // Get Gmail integration
    const integration = await getStaffGmailIntegration(auth.user.id, membership.org_id);

    if (!integration) {
      return NextResponse.json({
        connected: false,
        email: null,
        expiresAt: null,
        hasRefreshToken: false,
      });
    }

    return NextResponse.json({
      connected: integration.is_active,
      email: integration.email,
      expiresAt: integration.token_expires_at,
      hasRefreshToken: !!integration.refresh_token_encrypted,
      updatedAt: integration.updated_at,
    });
  } catch (error) {
    console.error('Error fetching Gmail status:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Gmail status' } },
      { status: 500 }
    );
  }
}


