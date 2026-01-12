import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumApplianceCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
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

    // Require platform admin
    await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const propertyId = searchParams.get('propertyId') || searchParams.get('propertyids');
    const unitId = searchParams.get('unitId') || searchParams.get('unitids');
    const applianceType = searchParams.get('applianceType');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    // Buildium expects arrays propertyids/unitids; support single values by passing same param
    if (propertyId) queryParams.propertyids = propertyId;
    if (unitId) queryParams.unitids = unitId;
    if (applianceType) queryParams.applianceType = applianceType;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/rentals/appliances', queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliances fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliances from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliances = (response.json ?? []) as unknown[];

    logger.info(`Buildium appliances fetched successfully`);

    return NextResponse.json({
      success: true,
      data: appliances,
      count: appliances.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium appliances`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumApplianceCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/rentals/appliances', undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create appliance in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliance = response.json ?? {};

    logger.info(`Buildium appliance created successfully`);

    return NextResponse.json({
      success: true,
      data: appliance,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium appliance`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
