import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const transferId = params.id;
    
    logger.info({ userId: user.id, transferId, action: 'get_buildium_transfer' }, 'Fetching Buildium transfer details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/transfers/${transferId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Transfer not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transfer = await response.json();

    return NextResponse.json({
      success: true,
      data: transfer
    });

  } catch (error) {
    logger.error({ error, transferId: params.id }, 'Error fetching Buildium transfer details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transfer details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const transferId = params.id;
    
    logger.info({ userId: user.id, transferId, action: 'update_buildium_transfer' }, 'Updating Buildium transfer');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/transfers/${transferId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Transfer not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedTransfer = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedTransfer
    });

  } catch (error) {
    logger.error({ error, transferId: params.id }, 'Error updating Buildium transfer');
    return NextResponse.json(
      { error: 'Failed to update Buildium transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
