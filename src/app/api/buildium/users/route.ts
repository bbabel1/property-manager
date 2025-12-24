import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
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
    const roleId = searchParams.get('roleId');

    // Build query parameters for Buildium API
    const params: Record<string, string> = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (orderby) params.orderby = orderby;
    if (isActive) params.isActive = isActive;
    if (roleId) params.roleId = roleId;

    // Make request to Buildium API using org-scoped credentials
    // Note: platform_admin routes may not have org context, so pass undefined
    const response = await buildiumFetch('GET', '/users', params, undefined, undefined);

    if (!response.ok) {
      logger.error(`Buildium users fetch failed`, { status: response.status, errorText: response.errorText });

      return NextResponse.json(
        { 
          error: 'Failed to fetch users from Buildium',
          details: response.errorText
        },
        { status: response.status }
      );
    }

    const users = response.json ?? [];

    logger.info(`Buildium users fetched successfully`);

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium users`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
