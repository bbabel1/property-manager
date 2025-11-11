import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

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

    // Require authentication
    const user = await requireUser();

    const { id } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/${id}/reactivate`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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
    logger.error(`Error reactivating Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
