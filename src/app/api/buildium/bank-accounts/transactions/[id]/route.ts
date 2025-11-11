import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const transactionId = (await params).id;
    
    logger.info({ userId: user.id, transactionId, action: 'get_buildium_transaction' }, 'Fetching Buildium transaction details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/transactions/${transactionId}`, {
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
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transaction = await response.json();

    return NextResponse.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    logger.error({ error, transactionId: (await params).id }, 'Error fetching Buildium transaction details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transaction details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
