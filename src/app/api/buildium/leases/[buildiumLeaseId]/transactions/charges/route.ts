import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumLeaseChargeCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
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

    const { buildiumLeaseId } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    if (dateFrom) queryParams.dateFrom = dateFrom;
    if (dateTo) queryParams.dateTo = dateTo;

    // Make request to Buildium API
    const response = await buildiumFetch(
      'GET',
      `/leases/${buildiumLeaseId}/charges`,
      queryParams,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease charges fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease charges from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const charges = (response.json ?? []) as unknown[];

    logger.info(`Buildium lease charges fetched successfully`);

    return NextResponse.json({
      success: true,
      data: charges,
      count: charges.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease charges`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
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

    const { buildiumLeaseId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumLeaseChargeCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch(
      'POST',
      `/leases/${buildiumLeaseId}/charges`,
      undefined,
      validatedData,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease charge creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create lease charge in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const charge = response.json ?? {};

    logger.info(`Buildium lease charge created successfully`);

    return NextResponse.json({
      success: true,
      data: charge,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium lease charge`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
