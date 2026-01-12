import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumResidentRequestUpdateSchema } from '@/schemas/buildium';
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/residentrequests/${id}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium resident request fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch resident request from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequest = response.json ?? {};

    logger.info(`Buildium resident request fetched successfully`);

    return NextResponse.json({
      success: true,
      data: residentRequest,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium resident request`);

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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumResidentRequestUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/residentrequests/${id}`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium resident request update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update resident request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequest = response.json ?? {};

    logger.info(`Buildium resident request updated successfully`);

    return NextResponse.json({
      success: true,
      data: residentRequest,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium resident request`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
