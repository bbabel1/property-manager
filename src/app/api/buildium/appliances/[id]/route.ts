import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumApplianceUpdateSchema } from '@/schemas/buildium';
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

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/appliances/${id}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliance = response.json ?? {};

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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumApplianceUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/appliances/${id}`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update appliance in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const appliance = response.json ?? {};

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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('DELETE', `/rentals/appliances/${id}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
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
