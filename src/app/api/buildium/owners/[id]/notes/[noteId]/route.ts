import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumOwnerNoteUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
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

    const { id, noteId } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners/${id}/notes/${noteId}`;
    
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
      logger.error(`Buildium owner note fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch owner note from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = await response.json();

    logger.info(`Buildium owner note fetched successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium owner note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
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

    const { id, noteId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerNoteUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners/${id}/notes/${noteId}`;
    
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
      logger.error(`Buildium owner note update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update owner note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = await response.json();

    logger.info(`Buildium owner note updated successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium owner note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
