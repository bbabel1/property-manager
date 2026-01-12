import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'unclear_reconciliation_transactions' }, 'Unclearing Buildium reconciliation transactions');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', `/bankaccounts/reconciliations/${reconciliationId}/uncleartransactions`, undefined, body, orgId);

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
    logger.error({ error, reconciliationId: (await params).id }, 'Error unclearing Buildium reconciliation transactions');
    return NextResponse.json(
      { error: 'Failed to unclear Buildium reconciliation transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
