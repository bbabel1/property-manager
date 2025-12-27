import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';

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

    const { id } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/userroles/${id}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium user role fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch user role from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const userRole = response.json ?? {};

    logger.info(`Buildium user role fetched successfully`);

    return NextResponse.json({
      success: true,
      data: userRole,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium user role`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
