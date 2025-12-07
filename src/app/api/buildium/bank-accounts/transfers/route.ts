import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_transfers' }, 'Fetching Buildium transfers');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/transfers', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transfers = await response.json();

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
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/transfers', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newTransfer = await response.json();

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
