import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import UnitService from '@/lib/unit-service';

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

    // Require authentication
    const user = await requireUser();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const propertyId = searchParams.get('propertyId');
    const propertyIds = searchParams.get('propertyIds') || searchParams.get('propertyids');
    const isActive = searchParams.get('isActive');
    const lastUpdatedFrom = searchParams.get('lastupdatedfrom');
    const lastUpdatedTo = searchParams.get('lastupdatedto');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    // Buildium expects "propertyids" (plural). Accept local singular for convenience.
    if (propertyIds) queryParams.append('propertyids', propertyIds);
    else if (propertyId) queryParams.append('propertyids', propertyId);
    if (isActive) queryParams.append('isActive', isActive);
    if (lastUpdatedFrom) queryParams.append('lastupdatedfrom', lastUpdatedFrom);
    if (lastUpdatedTo) queryParams.append('lastupdatedto', lastUpdatedTo);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units?${queryParams.toString()}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium units fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch units from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const units = await response.json();

    logger.info(`Buildium units fetched successfully`);

    return NextResponse.json({
      success: true,
      data: units,
      count: units.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium units`);

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

    // Require authentication
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium unit creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create unit in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const unit = await response.json();

    // Optional persist to DB if query param persist=true|1
    const { searchParams } = new URL(request.url);
    const persist = ['1', 'true', 'yes'].includes((searchParams.get('persist') || '').toLowerCase());
    if (persist) {
      try { await UnitService.persistBuildiumUnit(unit); } catch (e) { logger.error(`Persist created unit failed: ${String(e)}`); }
    }

    logger.info(`Buildium unit created successfully`);

    return NextResponse.json({
      success: true,
      data: unit,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium unit`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
