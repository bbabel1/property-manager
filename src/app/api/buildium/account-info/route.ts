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

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/accountinfo', undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium account info fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch account info from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const accountInfo = response.json ?? {};

    logger.info(`Buildium account info fetched successfully`);

    return NextResponse.json({
      success: true,
      data: accountInfo,
    });

  } catch {
    logger.error(`Error fetching Buildium account info`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
