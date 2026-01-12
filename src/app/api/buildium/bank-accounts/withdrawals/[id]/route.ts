import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumWithdrawalUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: withdrawalId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, withdrawalId, action: 'get_buildium_withdrawal' }, 'Fetching Buildium withdrawal details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/withdrawals/${withdrawalId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const withdrawal = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: withdrawal
    });

  } catch (error) {
    logger.error({ error, withdrawalId }, 'Error fetching Buildium withdrawal details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium withdrawal details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: withdrawalId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, withdrawalId, action: 'update_buildium_withdrawal' }, 'Updating Buildium withdrawal');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumWithdrawalUpdateSchema);

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/withdrawals/${withdrawalId}`, undefined, data, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedWithdrawal = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedWithdrawal
    });

  } catch (error) {
    logger.error({ error, withdrawalId }, 'Error updating Buildium withdrawal');
    return NextResponse.json(
      { error: 'Failed to update Buildium withdrawal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
