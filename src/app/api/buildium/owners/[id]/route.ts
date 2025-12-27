import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumOwnerUpdateSchema } from '@/schemas/buildium';
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
    const response = await buildiumFetch('GET', `/rentals/owners/${id}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium owner fetch failed: ${response.status} ${response.statusText}`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch owner from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const owner = response.json ?? {};

    logger.info('Buildium owner fetched successfully');

    return NextResponse.json({
      success: true,
      data: owner,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium owner: ${error instanceof Error ? error.message : 'Unknown error'}`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/owners/${id}`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium owner update failed: ${response.status} ${response.statusText}`);

      return NextResponse.json(
        { 
          error: 'Failed to update owner in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const owner = response.json ?? {};

    logger.info('Buildium owner updated successfully');

    return NextResponse.json({
      success: true,
      data: owner,
    });

  } catch (error) {
    logger.error(`Error updating Buildium owner: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
