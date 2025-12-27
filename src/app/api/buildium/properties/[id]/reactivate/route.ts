import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const response = await buildiumFetch('POST', `/rentals/${id}/reactivate`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property reactivation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to reactivate property in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium property reactivated successfully`);

    return NextResponse.json({
      success: true,
      message: 'Property reactivated successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error reactivating Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
