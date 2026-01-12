import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumOwnerCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import type { BuildiumOwner } from '@/types/buildium';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

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
    const { user } = await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const isActive = searchParams.get('isActive');
    const lastupdatedfrom = searchParams.get('lastupdatedfrom');
    const lastupdatedto = searchParams.get('lastupdatedto');
    const search = searchParams.get('search');

    // Build query parameters for Buildium API
    const params: Record<string, string> = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (orderby) params.orderby = orderby;
    if (isActive) params.isActive = isActive;
    if (lastupdatedfrom) params.lastupdatedfrom = lastupdatedfrom;
    if (lastupdatedto) params.lastupdatedto = lastupdatedto;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/rentals/owners', params, undefined, orgId);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error(`Buildium owners fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch owners from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const ownersPayload: unknown = response.json ?? [];
    const owners: BuildiumOwner[] = Array.isArray(ownersPayload) ? (ownersPayload as BuildiumOwner[]) : [];

    // Optional local search filter (client-side) across name/email when provided
    if (search) {
      const term = search.toLowerCase();
      const ownersFiltered = owners.filter((o) => {
        const first = (o?.FirstName || '').toLowerCase();
        const last = (o?.LastName || '').toLowerCase();
        const email = (o?.Email || '').toLowerCase();
        const company = ((o as any)?.CompanyName || '').toLowerCase();
        return first.includes(term) || last.includes(term) || email.includes(term) || company.includes(term);
      });
      logger.info(`Buildium owners fetched successfully`);

      return NextResponse.json({
        success: true,
        data: ownersFiltered,
        count: ownersFiltered.length,
      });
    }

    logger.info(`Buildium owners fetched successfully`);

    return NextResponse.json({
      success: true,
      data: owners,
      count: owners.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium owners`);

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
    const { user } = await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Parse and validate request body
    const body: unknown = await request.json().catch(() => ({}));
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/rentals/owners', undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error(`Buildium owner creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create owner in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const ownerJson: unknown = response.json ?? {};
    const owner =
      ownerJson && typeof ownerJson === 'object'
        ? (ownerJson as Record<string, unknown>)
        : {};

    logger.info(`Buildium owner created successfully`);

    return NextResponse.json({
      success: true,
      data: owner,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium owner`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
