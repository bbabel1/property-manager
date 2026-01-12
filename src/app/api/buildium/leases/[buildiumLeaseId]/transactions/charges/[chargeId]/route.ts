import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumLeaseChargeUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; chargeId: string }> },
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

    const { buildiumLeaseId, chargeId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch(
      'GET',
      `/rentals/leases/${buildiumLeaseId}/transactions/charges/${chargeId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease charge fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease charge from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const charge = response.json ?? {};

    logger.info(`Buildium lease charge fetched successfully`);

    return NextResponse.json({
      success: true,
      data: charge,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease charge`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; chargeId: string }> },
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

    const { buildiumLeaseId, chargeId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumLeaseChargeUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch(
      'PUT',
      `/rentals/leases/${buildiumLeaseId}/transactions/charges/${chargeId}`,
      undefined,
      validatedData,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease charge update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update lease charge in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const charge = response.json ?? {};

    logger.info(`Buildium lease charge updated successfully`);

    return NextResponse.json({
      success: true,
      data: charge,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium lease charge`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
