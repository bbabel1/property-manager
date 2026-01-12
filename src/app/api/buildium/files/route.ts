import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileUploadSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
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
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    if (categoryId) queryParams.categoryId = categoryId;
    if (search) queryParams.search = search;
    if (dateFrom) queryParams.dateFrom = dateFrom;
    if (dateTo) queryParams.dateTo = dateTo;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/files', queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium files fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch files from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const files = (response.json ?? []) as unknown[];

    logger.info(`Buildium files fetched successfully`);

    return NextResponse.json({
      success: true,
      data: files,
      count: files.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium files`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumFileUploadSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/files', undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium file upload failed`);

      return NextResponse.json(
        { 
          error: 'Failed to upload file to Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const file = response.json ?? {};

    logger.info(`Buildium file uploaded successfully`);

    return NextResponse.json({
      success: true,
      data: file,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error uploading Buildium file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
