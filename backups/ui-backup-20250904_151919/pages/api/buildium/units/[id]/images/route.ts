import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitImageUploadSchema, BuildiumUnitImageOrderUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import UnitService from '@/lib/unit-service';

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

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images`;
    
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
      logger.error(`Buildium unit images fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit images from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const images = await response.json();
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      try { await UnitService.persistImages(Number(id), images) } catch {}
    }

    logger.info(`Buildium unit images fetched successfully`);

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium unit images`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageUploadSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images`;
    
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
      logger.error(`Buildium unit image upload failed`);

      return NextResponse.json(
        { 
          error: 'Failed to upload unit image to Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = await response.json();
    try { await UnitService.persistImages(Number(id), [image]) } catch {}

    logger.info(`Buildium unit image uploaded successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error uploading Buildium unit image`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageOrderUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images/order`;
    
    const response = await fetch(buildiumUrl, {
      method: 'PUT',
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
      logger.error(`Buildium unit image order update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit image order in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const images = await response.json();
    try { await UnitService.persistImages(Number(id), images) } catch {}

    logger.info(`Buildium unit image order updated successfully`);

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
    });

  } catch (error) {
    logger.error(`Error updating Buildium unit image order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
