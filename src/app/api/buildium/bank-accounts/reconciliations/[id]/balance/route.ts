import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { supabaseAdmin } from '@/lib/db'

type BalanceResponse = {
  EndingBalance?: number | null
  endingBalance?: number | null
  TotalChecksAndWithdrawals?: number | null
  totalChecksAndWithdrawals?: number | null
  TotalDepositsAndAdditions?: number | null
  totalDepositsAndAdditions?: number | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    await requireRole('platform_admin')
    const reconciliationId = (await params).id;
    
    logger.info({ reconciliationId, action: 'get_buildium_reconciliation_balance' }, 'Fetching Buildium reconciliation balance');

    // Get bank account ID from reconciliation_log (required for balance endpoint)
    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
    }

    const { data: recLog } = await admin
      .from('reconciliation_log')
      .select('buildium_bank_account_id')
      .eq('buildium_reconciliation_id', Number(reconciliationId))
      .maybeSingle()

    if (!recLog?.buildium_bank_account_id) {
      return NextResponse.json(
        { error: 'Reconciliation not found in local database or missing bank account ID' },
        { status: 404 }
      )
    }

    const buildiumBankAccountId = recLog.buildium_bank_account_id

    // Buildium API call - balance endpoint requires bank account ID in path
    const response = await buildiumFetch(
      'GET',
      `/bankaccounts/${buildiumBankAccountId}/reconciliations/${reconciliationId}/balance`,
      undefined,
      undefined,
      undefined,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const balance = (response.json ?? {}) as BalanceResponse;

    return NextResponse.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error fetching Buildium reconciliation balance');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliation balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    await requireRole('platform_admin')
    const reconciliationId = (await params).id;
    
    logger.info({ reconciliationId, action: 'update_buildium_reconciliation_balance' }, 'Updating Buildium reconciliation balance');

    // Parse request body
    const body = (await request.json()) as Record<string, unknown>;

    // Get bank account ID from reconciliation_log (required for balance endpoint)
    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
    }

    const { data: recLog } = await admin
      .from('reconciliation_log')
      .select('buildium_bank_account_id')
      .eq('buildium_reconciliation_id', Number(reconciliationId))
      .maybeSingle()

    if (!recLog?.buildium_bank_account_id) {
      return NextResponse.json(
        { error: 'Reconciliation not found in local database or missing bank account ID' },
        { status: 404 }
      )
    }

    const buildiumBankAccountId = recLog.buildium_bank_account_id

    // Buildium API call - balance endpoint requires bank account ID in path
    const response = await buildiumFetch(
      'PUT',
      `/bankaccounts/${buildiumBankAccountId}/reconciliations/${reconciliationId}/balance`,
      undefined,
      body,
      undefined,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedBalance = (response.json ?? {}) as BalanceResponse;

    // Upsert balance fields into reconciliation_log
    try {
      const admin = supabaseAdmin
      if (admin) {
        const recId = Number(reconciliationId)
        const payload: Record<string, unknown> = {
          buildium_reconciliation_id: recId,
          ending_balance: updatedBalance?.EndingBalance ?? updatedBalance?.endingBalance ?? null,
          total_checks_withdrawals: updatedBalance?.TotalChecksAndWithdrawals ?? updatedBalance?.totalChecksAndWithdrawals ?? null,
          total_deposits_additions: updatedBalance?.TotalDepositsAndAdditions ?? updatedBalance?.totalDepositsAndAdditions ?? null,
        }
        await admin.from('reconciliation_log').upsert(payload, { onConflict: 'buildium_reconciliation_id' })
      }
    } catch {
      logger.warn({ reconciliationId }, 'Reconciliation log upsert (balance) failed; continuing')
    }

    return NextResponse.json({
      success: true,
      data: updatedBalance
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error updating Buildium reconciliation balance');
    return NextResponse.json(
      { error: 'Failed to update Buildium reconciliation balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
