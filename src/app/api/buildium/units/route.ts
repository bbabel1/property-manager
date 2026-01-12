import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import UnitService from '@/lib/unit-service';
import { buildiumFetch } from '@/lib/buildium-http';
import type { BuildiumUnit } from '@/types/buildium';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const propertyId = searchParams.get('propertyId');
    const propertyIds = searchParams.get('propertyIds') || searchParams.get('propertyids');
    const isActive = searchParams.get('isActive');
    const lastUpdatedFrom = searchParams.get('lastupdatedfrom');
    const lastUpdatedTo = searchParams.get('lastupdatedto');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    // Buildium expects "propertyids" (plural). Accept local singular for convenience.
    if (propertyIds) queryParams.append('propertyids', propertyIds);
    else if (propertyId) queryParams.append('propertyids', propertyId);
    if (isActive) queryParams.append('isActive', isActive);
    if (lastUpdatedFrom) queryParams.append('lastupdatedfrom', lastUpdatedFrom);
    if (lastUpdatedTo) queryParams.append('lastupdatedto', lastUpdatedTo);

    const result = await buildiumFetch(
      'GET',
      '/rentals/units',
      Object.fromEntries(queryParams.entries()),
      undefined,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium units fetch failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to fetch units from Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const units = result.json;

    logger.info({ orgId }, 'Buildium units fetched successfully');

    return NextResponse.json({
      success: true,
      data: units,
      count: Array.isArray(units) ? units.length : undefined,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error fetching Buildium units');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitCreateSchema);

    const result = await buildiumFetch(
      'POST',
      '/rentals/units',
      undefined,
      validatedData,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium unit creation failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to create unit in Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const unit = result.json as BuildiumUnit;

    // Optional persist to DB if query param persist=true|1
    const { searchParams } = new URL(request.url);
    const persist = ['1', 'true', 'yes'].includes((searchParams.get('persist') || '').toLowerCase());
    if (persist) {
      try { await UnitService.persistBuildiumUnit(unit, orgId); } catch (e) { logger.error(`Persist created unit failed: ${String(e)}`); }
    }

    logger.info(`Buildium unit created successfully`);

    return NextResponse.json({
      success: true,
      data: unit,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error creating Buildium unit');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
