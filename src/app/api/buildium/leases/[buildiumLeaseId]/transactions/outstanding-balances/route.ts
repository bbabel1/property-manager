import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
) {
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

    const { buildiumLeaseId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/leases/${buildiumLeaseId}/transactions/outstanding-balances`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease outstanding balances fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease outstanding balances from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const outstandingBalances = response.json ?? {};

    logger.info(`Buildium lease outstanding balances fetched successfully`);

    return NextResponse.json({
      success: true,
      data: outstandingBalances,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease outstanding balances`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
