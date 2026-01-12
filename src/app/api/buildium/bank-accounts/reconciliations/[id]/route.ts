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
    
    logger.info({ userId: user.id, reconciliationId, action: 'get_buildium_reconciliation' }, 'Fetching Buildium reconciliation details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/reconciliations/${reconciliationId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const reconciliation = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: reconciliation
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error fetching Buildium reconciliation details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliation details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'update_buildium_reconciliation' }, 'Updating Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/reconciliations/${reconciliationId}`, undefined, body, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedReconciliation = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedReconciliation
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error updating Buildium reconciliation');
    return NextResponse.json(
      { error: 'Failed to update Buildium reconciliation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
