import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileCategoryUpdateSchema } from '@/schemas/buildium';
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
    const response = await buildiumFetch('GET', `/filecategories/${id}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium file category fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch file category from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const category = response.json ?? {};

    logger.info(`Buildium file category fetched successfully`);

    return NextResponse.json({
      success: true,
      data: category,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium file category`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumFileCategoryUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/filecategories/${id}`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium file category update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update file category in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const category = response.json ?? {};

    logger.info(`Buildium file category updated successfully`);

    return NextResponse.json({
      success: true,
      data: category,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium file category`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
