import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumDepositUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: depositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, depositId, action: 'get_buildium_deposit' }, 'Fetching Buildium deposit details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/deposits/${depositId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const deposit = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: deposit
    });

  } catch (error) {
    logger.error({ error, depositId }, 'Error fetching Buildium deposit details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium deposit details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: depositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, depositId, action: 'update_buildium_deposit' }, 'Updating Buildium deposit');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumDepositUpdateSchema);

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/deposits/${depositId}`, undefined, data, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedDeposit = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedDeposit
    });

  } catch (error) {
    logger.error({ error, depositId }, 'Error updating Buildium deposit');
    return NextResponse.json(
      { error: 'Failed to update Buildium deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
