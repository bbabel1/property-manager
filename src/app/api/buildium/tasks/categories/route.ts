import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumTaskCategoryCreateSchema } from '@/schemas/buildium';
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

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/tasks/categories', queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task categories fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch task categories from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskCategories = (response.json ?? []) as unknown[];

    logger.info(`Buildium task categories fetched successfully`);

    return NextResponse.json({
      success: true,
      data: taskCategories,
      count: taskCategories.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium task categories`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumTaskCategoryCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/tasks/categories', undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task category creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create task category in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskCategory = response.json ?? {};

    logger.info(`Buildium task category created successfully`);

    return NextResponse.json({
      success: true,
      data: taskCategory,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium task category`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
