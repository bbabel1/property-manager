import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'get_buildium_reconciliation_transactions' }, 'Fetching Buildium reconciliation transactions');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}/transactions`, {
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
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transactions = await response.json();

    return NextResponse.json({
      success: true,
      data: transactions,
      count: Array.isArray(transactions) ? transactions.length : 0
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error fetching Buildium reconciliation transactions');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliation transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
