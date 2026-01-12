import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id, paymentId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/bills/${id}/payments/${paymentId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium bill payment fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch bill payment from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const payment = response.json ?? {};

    logger.info(`Buildium bill payment fetched successfully`);

    return NextResponse.json({
      success: true,
      data: payment,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium bill payment`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
