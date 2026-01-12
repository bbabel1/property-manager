/**
 * Gmail Integration Status
 *
 * GET /api/gmail/status
 * Returns the current Gmail integration status for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabase } from '@/lib/db';
import { getStaffGmailIntegration } from '@/lib/gmail/token-manager';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

export async function GET(request: NextRequest) {
  try {
    const { supabase: client, user } = await requireAuth();

    const orgId = await resolveOrgIdFromRequest(request, user.id, client);
    await requireOrgMember({ client, userId: user.id, orgId });

    // Get Gmail integration
    const integration = await getStaffGmailIntegration(user.id, orgId);

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
      updatedAt:
        'updated_at' in integration
          ? (integration as { updated_at?: string | null }).updated_at ?? null
          : null,
    });
  } catch (error) {
    console.error('Error fetching Gmail status:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Gmail status' } },
      { status: 500 },
    );
  }
}
