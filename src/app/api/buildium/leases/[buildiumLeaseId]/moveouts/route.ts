import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumLeaseMoveOutCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

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

    const { buildiumLeaseId } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/leases/${buildiumLeaseId}/moveouts`, queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease move outs fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease move outs from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const moveOuts = (response.json ?? []) as unknown[];

    logger.info(`Buildium lease move outs fetched successfully`);

    return NextResponse.json({
      success: true,
      data: moveOuts,
      count: moveOuts.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease move outs`);

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

    const { buildiumLeaseId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumLeaseMoveOutCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/leases/${buildiumLeaseId}/moveouts`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease move out creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create lease move out in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const moveOut = response.json ?? {};

    logger.info(`Buildium lease move out created successfully`);

    return NextResponse.json({
      success: true,
      data: moveOut,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium lease move out`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
