import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(_request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_transfers' }, 'Fetching Buildium transfers');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/transfers', undefined, undefined, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transfers = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: transfers,
      count: Array.isArray(transfers) ? transfers.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium transfers');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transfers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'create_buildium_transfer' }, 'Creating Buildium transfer');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/transfers', undefined, body, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newTransfer = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: newTransfer
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium transfer');
    return NextResponse.json(
      { error: 'Failed to create Buildium transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
