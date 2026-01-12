import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; moveOutId: string }> },
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require platform admin
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { buildiumLeaseId, moveOutId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch(
      'GET',
      `/leases/${buildiumLeaseId}/moveouts/${moveOutId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease move out fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease move out from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const moveOut = response.json ?? {};

    logger.info(`Buildium lease move out fetched successfully`);

    return NextResponse.json({
      success: true,
      data: moveOut,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease move out`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; moveOutId: string }> },
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require platform admin
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { buildiumLeaseId, moveOutId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch(
      'DELETE',
      `/leases/${buildiumLeaseId}/moveouts/${moveOutId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease move out deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete lease move out from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium lease move out deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Lease move out deleted successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error deleting Buildium lease move out`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
