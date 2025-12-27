import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitAmenitiesUpdateSchema } from '@/schemas/buildium';
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

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/units/${id}/amenities`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit amenities fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit amenities from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const amenities = (response.json ?? []) as unknown[];

    logger.info(`Buildium unit amenities fetched successfully`);

    return NextResponse.json({
      success: true,
      data: amenities,
      count: amenities.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit amenities`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const validatedData = sanitizeAndValidate(body, BuildiumUnitAmenitiesUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/units/${id}/amenities`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit amenities update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit amenities in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const amenities = (response.json ?? []) as unknown[];

    logger.info(`Buildium unit amenities updated successfully`);

    return NextResponse.json({
      success: true,
      data: amenities,
      count: amenities.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium unit amenities`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
