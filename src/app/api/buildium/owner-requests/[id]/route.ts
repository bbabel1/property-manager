import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumOwnerRequestUpdateSchema } from '@/schemas/buildium';
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
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/ownerrequests/${id}`;
    
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
      logger.error(`Buildium rental owner request fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch rental owner request from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const ownerRequest = await response.json();

    logger.info(`Buildium rental owner request fetched successfully`);

    return NextResponse.json({
      success: true,
      data: ownerRequest,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium rental owner request`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerRequestUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/ownerrequests/${id}`;
    
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
      logger.error(`Buildium rental owner request update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update rental owner request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const ownerRequest = await response.json();

    logger.info(`Buildium rental owner request updated successfully`);

    return NextResponse.json({
      success: true,
      data: ownerRequest,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium rental owner request`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
