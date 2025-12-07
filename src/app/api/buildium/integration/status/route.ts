/**
 * Buildium Integration Status Test API
 * 
 * POST /api/buildium/integration/status - Test Buildium connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { testBuildiumConnection } from '@/lib/buildium/credentials-manager';

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

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to test Buildium connection' } },
      { status: 500 }
    );
  }
}

