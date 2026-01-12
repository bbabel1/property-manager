/**
 * Buildium Route Guard
 *
 * Helper functions to ensure Buildium integration is enabled before
 * allowing access to Buildium-related API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertBuildiumEnabled, BuildiumDisabledError } from './buildium-gate';
import { resolveOrgIdFromRequest } from './org/resolve-org-id';
import { requireAuth } from './auth/guards';

/**
 * Require Buildium integration to be enabled, or throw error
 *
 * @param request - Next.js request
 * @returns orgId if enabled
 * @throws BuildiumDisabledError if disabled
 */
export async function requireBuildiumEnabledOrThrow(request: NextRequest): Promise<string> {
  const { user } = await requireAuth();
  const orgId = await resolveOrgIdFromRequest(request, user.id);
  await assertBuildiumEnabled(orgId, request.url);
  return orgId;
}

/**
 * Require Buildium integration to be enabled, or return 403 response
 *
 * @param request - Next.js request
 * @returns orgId if enabled, or NextResponse with 403 if disabled
 */
export async function requireBuildiumEnabledOr403(
  request: NextRequest,
): Promise<string | NextResponse> {
  try {
    return await requireBuildiumEnabledOrThrow(request);
  } catch (error) {
    if (error instanceof BuildiumDisabledError) {
      return NextResponse.json(
        { error: { code: 'BUILDIUM_DISABLED', message: error.message } },
        { status: 403 },
      );
    }
    throw error;
  }
}

/**
 * Helper to get the orgId for a Buildium route with a standardized 403 response
 * when the integration is disabled.
 */
export async function getBuildiumOrgIdOr403(
  request: NextRequest,
): Promise<{ orgId: string } | { response: NextResponse }> {
  const guardResult = await requireBuildiumEnabledOr403(request);
  if (guardResult instanceof NextResponse) {
    return { response: guardResult };
  }
  return { orgId: guardResult };
}
