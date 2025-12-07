/**
 * Google Calendar Integration Disconnect
 * 
 * POST /api/calendar/disconnect
 * Disconnects the Google Calendar integration for the authenticated user
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getStaffCalendarIntegration, deleteCalendarIntegration } from '@/lib/calendar/token-manager';
import { decryptToken } from '@/lib/gmail/token-encryption';

export async function POST() {
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

    // Get Calendar integration
    const integration = await getStaffCalendarIntegration(auth.user.id, membership.org_id);

    if (!integration) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Google Calendar integration not found' } },
        { status: 404 }
      );
    }

    // Revoke Google tokens (optional, best practice)
    try {
      const accessToken = decryptToken(integration.access_token_encrypted);
      
      // Revoke token via Google API
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (revokeError) {
      // Log but don't fail if revocation fails
      console.warn('Failed to revoke Google token:', revokeError);
    }

    // Delete integration (soft delete)
    await deleteCalendarIntegration(integration.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect Google Calendar integration' } },
      { status: 500 }
    );
  }
}

