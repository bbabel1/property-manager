import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumApplianceUpdateSchema } from '@/schemas/buildium';
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
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}`;
    
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
      logger.error(`Buildium appliance fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliance = await response.json();

    logger.info(`Buildium appliance fetched successfully`);

    return NextResponse.json({
      success: true,
      data: appliance,
    });

  } catch (error) {
    logger.error({ error }, `Error fetching Buildium appliance`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumApplianceUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}`;
    
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
      logger.error(`Buildium appliance update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update appliance in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliance = await response.json();

    logger.info(`Buildium appliance updated successfully`);

    return NextResponse.json({
      success: true,
      data: appliance,
    });

  } catch (error) {
    logger.error({ error }, `Error updating Buildium appliance`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium appliance deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete appliance from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium appliance deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Appliance deleted successfully',
    });

  } catch (error) {
    logger.error({ error }, `Error deleting Buildium appliance`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
