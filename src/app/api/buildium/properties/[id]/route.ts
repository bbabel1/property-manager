import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyUpdateEnhancedSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Require authentication
    const user = await requireUser();

    const { id } = params;
    const prox = await buildiumFetch('GET', `/rentals/${id}`)
    if (!prox.ok) {
      logger.error(`Buildium property fetch failed`);
      return NextResponse.json(
        { error: 'Failed to fetch property from Buildium', details: prox.errorText || prox.json },
        { status: prox.status || 502 }
      );
    }
    const property = prox.json;

    logger.info(`Buildium property fetched successfully`);

    return NextResponse.json({
      success: true,
      data: property,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Require authentication
    const user = await requireUser();

    const { id } = params;
    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyUpdateEnhancedSchema);
    const prox = await buildiumFetch('PUT', `/rentals/${id}`, undefined, validatedData)
    if (!prox.ok) {
      logger.error(`Buildium property update failed`);
      return NextResponse.json(
        { error: 'Failed to update property in Buildium', details: prox.errorText || prox.json },
        { status: prox.status || 502 }
      );
    }
    const property = prox.json;

    logger.info(`Buildium property updated successfully`);

    return NextResponse.json({
      success: true,
      data: property,
    });

  } catch (error) {
    logger.error(`Error updating Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
