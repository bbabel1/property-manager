import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quickDepositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, quickDepositId, action: 'get_buildium_quick_deposit' }, 'Fetching Buildium quick deposit details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/quickdeposits/${quickDepositId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Quick deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const quickDeposit = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: quickDeposit
    });

  } catch (error) {
    logger.error({ error, quickDepositId }, 'Error fetching Buildium quick deposit details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium quick deposit details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quickDepositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, quickDepositId, action: 'update_buildium_quick_deposit' }, 'Updating Buildium quick deposit');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/quickdeposits/${quickDepositId}`, undefined, body, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Quick deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedQuickDeposit = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedQuickDeposit
    });

  } catch (error) {
    logger.error({ error, quickDepositId: (await params).id }, 'Error updating Buildium quick deposit');
    return NextResponse.json(
      { error: 'Failed to update Buildium quick deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
