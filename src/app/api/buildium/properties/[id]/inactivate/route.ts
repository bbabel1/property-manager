import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch as _buildiumFetch } from '@/lib/buildium-http';

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
    const response = await _buildiumFetch('POST', `/rentals/${id}/inactivate`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property inactivation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to inactivate property in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium property inactivated successfully`);

    return NextResponse.json({
      success: true,
      message: 'Property inactivated successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error inactivating Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
