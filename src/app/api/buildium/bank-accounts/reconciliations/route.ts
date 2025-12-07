import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    await requireRole('platform_admin')
    logger.info({ action: 'get_buildium_reconciliations' }, 'Fetching Buildium reconciliations');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/reconciliations', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const reconciliations = await response.json();

    return NextResponse.json({
      success: true,
      data: reconciliations,
      count: Array.isArray(reconciliations) ? reconciliations.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium reconciliations');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    await requireRole('platform_admin')
    logger.info({ action: 'create_buildium_reconciliation' }, 'Creating Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/reconciliations', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newReconciliation = await response.json();

    // Upsert reconciliation_log (pending)
    try {
      const admin = supabaseAdmin
      if (admin) {
        const buildiumReconciliationId = newReconciliation?.Id ?? newReconciliation?.id
        const buildiumBankAccountId = (body?.BankAccountId ?? body?.bankAccountId ?? newReconciliation?.BankAccountId ?? newReconciliation?.bankAccountId) as number | undefined
        const statementEndingDate = (body?.StatementEndingDate ?? body?.statementEndingDate ?? newReconciliation?.StatementEndingDate ?? newReconciliation?.statementEndingDate) as string | undefined

        // Resolve local bank/gl/property
        let bank_account_id: string | null = null
        let gl_account_id: string | null = null
        let property_id: string | null = null
        if (buildiumBankAccountId != null) {
          const { data: bank } = await admin
            .from('bank_accounts')
            .select('id, gl_account')
            .eq('buildium_bank_id', buildiumBankAccountId)
            .maybeSingle()
          if (bank) {
            bank_account_id = bank.id
            gl_account_id = bank.gl_account
            // Map to property via operating/deposit account linkage
            const { data: prop } = await admin
              .from('properties')
              .select('id')
              .or(`operating_bank_account_id.eq.${bank_account_id},deposit_trust_account_id.eq.${bank_account_id}`)
              .limit(1)
              .maybeSingle()
            if (prop) property_id = prop.id
          }
        }

        const payload: any = {
          buildium_reconciliation_id: buildiumReconciliationId,
          buildium_bank_account_id: buildiumBankAccountId ?? null,
          statement_ending_date: statementEndingDate ?? null,
          is_finished: Boolean(newReconciliation?.IsFinished ?? newReconciliation?.isFinished ?? false),
          ending_balance: null,
          total_checks_withdrawals: null,
          total_deposits_additions: null,
          bank_account_id,
          gl_account_id,
          property_id,
        }

        await admin.from('reconciliation_log')
          .upsert(payload, { onConflict: 'buildium_reconciliation_id' })
      }
    } catch (e) {
      logger.warn({ e }, 'Reconciliation log upsert (create) failed; continuing')
    }

    return NextResponse.json({
      success: true,
      data: newReconciliation
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium reconciliation');
    return NextResponse.json(
      { error: 'Failed to create Buildium reconciliation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
