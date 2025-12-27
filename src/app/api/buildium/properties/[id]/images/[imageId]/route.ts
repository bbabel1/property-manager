import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyImageUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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

    const { id, imageId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/${id}/images/${imageId}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property image fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch property image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = response.json ?? {};

    logger.info(`Buildium property image fetched successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium property image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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

    const { id, imageId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyImageUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/${id}/images/${imageId}`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property image update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update property image in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = response.json ?? {};

    logger.info(`Buildium property image updated successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium property image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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

    const { id, imageId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('DELETE', `/rentals/${id}/images/${imageId}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property image deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete property image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium property image deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Property image deleted successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error deleting Buildium property image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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

    const { id, imageId } = await params;

    // Make request to Buildium API for image download
    const response = await buildiumFetch('POST', `/rentals/${id}/images/${imageId}/download`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property image download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download property image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const downloadData = response.json ?? {};

    logger.info(`Buildium property image download initiated successfully`);

    return NextResponse.json({
      success: true,
      data: downloadData,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error downloading Buildium property image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
