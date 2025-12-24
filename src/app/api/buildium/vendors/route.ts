import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumVendorCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const isActive = searchParams.get('isActive');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    // Build query parameters for Buildium API
    const params: Record<string, string> = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (orderby) params.orderby = orderby;
    if (isActive) params.isActive = isActive;
    if (categoryId) params.categoryId = categoryId;
    if (search) params.search = search;

    // Make request to Buildium API using org-scoped credentials
    // Note: platform_admin routes may not have org context, so pass undefined
    const response = await buildiumFetch('GET', '/vendors', params, undefined, undefined);

    if (!response.ok) {
      logger.error(`Buildium vendors fetch failed`, { status: response.status, errorText: response.errorText });

      return NextResponse.json(
        { 
          error: 'Failed to fetch vendors from Buildium',
          details: response.errorText
        },
        { status: response.status }
      );
    }

    const vendors = response.json ?? [];

    logger.info(`Buildium vendors fetched successfully`);

    return NextResponse.json({
      success: true,
      data: vendors,
      count: vendors.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium vendors`);

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

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumVendorCreateSchema);

    // Make request to Buildium API using org-scoped credentials
    // Note: platform_admin routes may not have org context, so pass undefined
    const response = await buildiumFetch('POST', '/vendors', undefined, validatedData, undefined);

    if (!response.ok) {
      logger.error(`Buildium vendor creation failed`, { status: response.status, errorText: response.errorText });

      return NextResponse.json(
        { 
          error: 'Failed to create vendor in Buildium',
          details: response.errorText
        },
        { status: response.status }
      );
    }

    const vendor = response.json ?? {};

    logger.info(`Buildium vendor created successfully`);

    return NextResponse.json({
      success: true,
      data: vendor,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium vendor`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
