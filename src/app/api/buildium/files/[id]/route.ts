import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';

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
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/${id}`;
    
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
      logger.error(`Buildium file fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const file = await response.json();

    logger.info(`Buildium file fetched successfully`);

    return NextResponse.json({
      success: true,
      data: file,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium file`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumFileUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/${id}`;
    
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
      logger.error(`Buildium file update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update file in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const file = await response.json();

    logger.info(`Buildium file updated successfully`);

    return NextResponse.json({
      success: true,
      data: file,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium file`);

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

    // Make request to Buildium API for file download
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/${id}/download`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium file download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const downloadData = await response.json();

    logger.info(`Buildium file download initiated successfully`);

    return NextResponse.json({
      success: true,
      data: downloadData,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error downloading Buildium file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
