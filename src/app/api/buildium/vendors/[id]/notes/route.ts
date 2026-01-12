import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumVendorNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const response = await buildiumFetch('GET', `/vendors/${id}/notes`, queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium vendor notes fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch vendor notes from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const notes = (response.json ?? []) as unknown[];

    logger.info(`Buildium vendor notes fetched successfully`);

    return NextResponse.json({
      success: true,
      data: notes,
      count: notes.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium vendor notes`);

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

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumVendorNoteCreateSchema);

    // Make request to Buildium API
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const response = await buildiumFetch('POST', `/vendors/${id}/notes`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium vendor note creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create vendor note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = response.json ?? {};

    logger.info(`Buildium vendor note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium vendor note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
