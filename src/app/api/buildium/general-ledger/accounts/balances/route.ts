import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

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

    // Require authentication
    const user = await requireUser();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const accountType = searchParams.get('accountType');
    const isActive = searchParams.get('isActive');
    const asOfDate = searchParams.get('asOfDate');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (accountType) queryParams.append('accountType', accountType);
    if (isActive) queryParams.append('isActive', isActive);
    if (asOfDate) queryParams.append('asOfDate', asOfDate);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/generalledger/accounts/balances?${queryParams.toString()}`;
    
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
      logger.error(`Buildium general ledger account balances fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch general ledger account balances from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const balances = await response.json();

    logger.info(`Buildium general ledger account balances fetched successfully`);

    return NextResponse.json({
      success: true,
      data: balances,
      count: balances.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium general ledger account balances`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
