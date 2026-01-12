/**
 * Buildium Integration Status Test API
 * 
 * POST /api/buildium/integration/status - Test Buildium connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { testBuildiumConnection } from '@/lib/buildium/credentials-manager';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

// Admin-only status check; gated by Buildium enablement (toggle route remains exempt).

export async function POST(request: NextRequest) {
  try {
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const { supabase: client, user } = await requireAuth();
    await requireOrgMember({ client, userId: user.id, orgId });

    const result = await testBuildiumConnection(orgId);

    if (!result.success && result.error) {
      const statusCode =
        result.error.code === 'missing_org' || result.error.code === 'no_credentials'
          ? 404
          : result.error.code === 'disabled'
          ? 403
          : result.error.code === 'rate_limited'
          ? 429
          : 500;

      return NextResponse.json(
        { error: result.error },
        { status: statusCode }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error testing Buildium connection:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: { code: 'missing_org', message: 'Organization context required' } },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json(
        { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden' } },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to test Buildium connection' } },
      { status: 500 }
    );
  }
}
