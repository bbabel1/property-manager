import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; serviceHistoryId: string } }
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

    // Require authentication
    const user = await requireUser();

    const { id, serviceHistoryId } = params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}/servicehistory/${serviceHistoryId}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium appliance service history fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance service history from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const serviceHistory = await response.json();

    logger.info(`Buildium appliance service history fetched successfully`);

    return NextResponse.json({
      success: true,
      data: serviceHistory,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium appliance service history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
