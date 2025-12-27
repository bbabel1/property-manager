import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: transactionId } = await params
  try {
    // Authentication
    const auth = await requireRole('platform_admin')
    const userId = auth.user.id
    
    logger.info({ userId, transactionId, action: 'get_buildium_transaction' }, 'Fetching Buildium transaction details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/transactions/${transactionId}`, undefined, undefined, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transaction = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    logger.error({ error, transactionId }, 'Error fetching Buildium transaction details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transaction details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
