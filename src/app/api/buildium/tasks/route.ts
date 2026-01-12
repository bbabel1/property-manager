import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
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

    // Require authentication
    await requireRole('platform_admin');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const categoryId = searchParams.get('categoryId');
    const assignedTo = searchParams.get('assignedTo');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    if (status) queryParams.status = status;
    if (priority) queryParams.priority = priority;
    if (categoryId) queryParams.categoryId = categoryId;
    if (assignedTo) queryParams.assignedTo = assignedTo;
    if (dateFrom) queryParams.dateFrom = dateFrom;
    if (dateTo) queryParams.dateTo = dateTo;

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/tasks', queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium tasks fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch tasks from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const tasks = (response.json ?? []) as unknown[];

    logger.info(`Buildium tasks fetched successfully`);

    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium tasks`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
