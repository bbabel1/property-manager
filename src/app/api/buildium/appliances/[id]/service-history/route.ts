import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumApplianceServiceHistoryCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

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
    const response = await buildiumFetch('GET', `/rentals/appliances/${id}/servicehistory`, queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance service history fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance service history from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const serviceHistory = (response.json ?? []) as unknown[];

    logger.info(`Buildium appliance service history fetched successfully`);

    return NextResponse.json({
      success: true,
      data: serviceHistory,
      count: serviceHistory.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium appliance service history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumApplianceServiceHistoryCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/rentals/appliances/${id}/servicehistory`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance service history creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create appliance service history in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const serviceHistory = response.json ?? {};

    logger.info(`Buildium appliance service history created successfully`);

    return NextResponse.json({
      success: true,
      data: serviceHistory,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium appliance service history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
