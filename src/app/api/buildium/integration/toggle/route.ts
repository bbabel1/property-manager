/**
 * Buildium Integration Toggle API
 * 
 * POST /api/buildium/integration/toggle - Enable/disable integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { toggleBuildiumIntegration } from '@/lib/buildium/credentials-manager';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

// Toggle must work while the integration is disabled; we only enforce auth + org membership here.

export async function POST(request: NextRequest) {
  try {
    const { supabase: client, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, client);
    await requireOrgMember({ client, userId: user.id, orgId });
    const body = await request.json();

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'enabled must be a boolean' } },
        { status: 400 }
      );
    }

    await toggleBuildiumIntegration(orgId, body.enabled, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling Buildium integration:', error);

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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle Buildium integration' } },
      { status: 500 }
    );
  }
}
