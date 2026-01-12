import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; creditId: string }> }) {
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

    const { id, creditId } = await params;

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/vendors/${id}/credits/${creditId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium vendor credit fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch vendor credit from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const credit = response.json ?? {};

    logger.info(`Buildium vendor credit fetched successfully`);

    return NextResponse.json({
      success: true,
      data: credit,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium vendor credit`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
