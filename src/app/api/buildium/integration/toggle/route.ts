/**
 * Buildium Integration Toggle API
 * 
 * POST /api/buildium/integration/toggle - Enable/disable integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { toggleBuildiumIntegration } from '@/lib/buildium/credentials-manager';

/**
 * Resolve orgId from request context
 */
async function resolveOrgId(request: NextRequest, userId: string): Promise<string> {
  // Check header first
  const headerOrgId = request.headers.get('x-org-id');
  if (headerOrgId) {
    return headerOrgId.trim();
  }

  // Check cookies
  const cookieOrgId = request.cookies.get('x-org-id')?.value;
  if (cookieOrgId) {
    return cookieOrgId.trim();
  }

  // Fallback to first org membership
  const { data: membership, error } = await supabaseAdmin
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    throw new Error('ORG_CONTEXT_REQUIRED');
  }

  return membership.org_id;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const orgId = await resolveOrgId(request, auth.user.id);
    const body = await request.json();

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'enabled must be a boolean' } },
        { status: 400 }
      );
    }

    await toggleBuildiumIntegration(orgId, body.enabled, auth.user.id);

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

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle Buildium integration' } },
      { status: 500 }
    );
  }
}

