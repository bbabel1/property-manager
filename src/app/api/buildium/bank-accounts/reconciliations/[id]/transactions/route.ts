import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'get_buildium_reconciliation_transactions' }, 'Fetching Buildium reconciliation transactions');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/reconciliations/${reconciliationId}/transactions`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transactions = (response.json ?? []) as unknown[];

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
