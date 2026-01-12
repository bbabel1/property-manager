import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require org_admin role
    await requireRole('org_admin');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const isActive = searchParams.get('isActive');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    if (isActive) queryParams.isActive = isActive;

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/userroles', queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium user roles fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch user roles from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const userRoles = (response.json ?? []) as unknown[];

    logger.info(`Buildium user roles fetched successfully`);

    return NextResponse.json({
      success: true,
      data: userRoles,
      count: userRoles.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium user roles`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
