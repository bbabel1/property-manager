import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
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
    const response = await buildiumFetch('GET', `/users/${id}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium user fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch user from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const userData = response.json ?? {};

    logger.info(`Buildium user fetched successfully`);

    return NextResponse.json({
      success: true,
      data: userData,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium user`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
