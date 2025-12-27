import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'clear_reconciliation_transactions' }, 'Clearing Buildium reconciliation transactions');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', `/bankaccounts/reconciliations/${reconciliationId}/cleartransactions`, undefined, body, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const result = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error clearing Buildium reconciliation transactions');
    return NextResponse.json(
      { error: 'Failed to clear Buildium reconciliation transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
