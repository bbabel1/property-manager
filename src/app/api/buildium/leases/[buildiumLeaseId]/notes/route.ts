import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumLeaseNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
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

    // Require platform admin
    const { user } = await requireRole('platform_admin');

    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    const { buildiumLeaseId } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const res = await edgeClient.listLeaseNotes(Number(buildiumLeaseId), { limit: Number(limit), offset: Number(offset), orderby: orderby || undefined })
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to fetch lease notes from Buildium' }, { status: 502 })
    const notes = res.data || []

    logger.info(`Buildium lease notes fetched successfully`);

    return NextResponse.json({
      success: true,
      data: notes,
      count: notes.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease notes`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
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

    // Require platform admin
    await requireRole('platform_admin');

    const { buildiumLeaseId } = await params;

    // Parse and validate request body
    const body: unknown = await request.json().catch(() => ({}));
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumLeaseNoteCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/leases/${buildiumLeaseId}/notes`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error(`Buildium lease note creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create lease note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const noteJson: unknown = response.json ?? {};
    const note =
      noteJson && typeof noteJson === 'object'
        ? (noteJson as Record<string, unknown>)
        : {};

    logger.info(`Buildium lease note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium lease note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
