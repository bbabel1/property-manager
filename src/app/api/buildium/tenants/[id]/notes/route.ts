import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumTenantNoteCreateSchema } from '@/schemas/buildium';
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

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
    // Per Buildium API documentation: GET /v1/leases/tenants/{tenantId}/notes
    const response = await buildiumFetch('GET', `/leases/tenants/${id}/notes`, queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium tenant notes fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch tenant notes from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const notes = (response.json ?? []) as unknown[];

    logger.info(`Buildium tenant notes fetched successfully`);

    return NextResponse.json({
      success: true,
      data: notes,
      count: notes.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium tenant notes`);

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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumTenantNoteCreateSchema);

    // Log the request for debugging
    logger.info({ tenantId: id, payload: validatedData }, 'Creating tenant note in Buildium');

    // Make request to Buildium API
    // Per Buildium API documentation: POST /v1/leases/tenants/{tenantId}/notes
    // Note: id should be the Buildium tenant ID (not local tenant ID)
    const response = await buildiumFetch('POST', `/leases/tenants/${id}/notes`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error({ tenantId: id, status: response.status, error: errorData }, `Buildium tenant note creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create tenant note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = response.json ?? {};

    logger.info(`Buildium tenant note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium tenant note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
