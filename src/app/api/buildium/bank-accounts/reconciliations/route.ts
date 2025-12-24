import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'

type ReconciliationResponse = Record<string, unknown>

const coerceNumericId = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export async function GET(_request: NextRequest) {
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
    const body = (await request.json()) as Record<string, unknown>;

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

    const newReconciliation = (await response.json()) as ReconciliationResponse;

    // Upsert reconciliation_log (pending)
    try {
      const admin = supabaseAdmin
      if (admin) {
        const buildiumReconciliationId =
          coerceNumericId(newReconciliation?.Id) ?? coerceNumericId(newReconciliation?.id)
        const buildiumBankAccountId =
          coerceNumericId(body?.BankAccountId) ??
          coerceNumericId(body?.bankAccountId) ??
          coerceNumericId(newReconciliation?.BankAccountId) ??
          coerceNumericId(newReconciliation?.bankAccountId)
        const statementEndingDate =
          (body?.StatementEndingDate as string | undefined) ??
          (body?.statementEndingDate as string | undefined) ??
          (newReconciliation?.StatementEndingDate as string | undefined) ??
          (newReconciliation?.statementEndingDate as string | undefined)

	        // Resolve local bank/gl/property
        let bank_gl_account_id: string | null = null
        let gl_account_id: string | null = null
        let property_id: string | null = null
        if (buildiumBankAccountId != null) {
	          const { data: bankGl } = await admin
	            .from('gl_accounts')
	            .select('id')
	            .eq('buildium_gl_account_id', buildiumBankAccountId)
	            .maybeSingle<{ id: string }>()

          if (bankGl) {
            bank_gl_account_id = bankGl.id
            gl_account_id = bankGl.id
	          }

		          // Map to property via operating/deposit linkage (bank GL FK model)
	          if (bank_gl_account_id) {
	            const { data: prop } = await admin
		              .from('properties')
		              .select('id')
		              .or(
		                [
		                  bank_gl_account_id ? `operating_bank_gl_account_id.eq.${bank_gl_account_id}` : null,
		                  bank_gl_account_id ? `deposit_trust_gl_account_id.eq.${bank_gl_account_id}` : null,
		                ].filter(Boolean).join(','),
		              )
		              .limit(1)
		              .maybeSingle<{ id: string }>()
	            if (prop) property_id = prop.id
	          }
	        }

        const payload: Record<string, unknown> = {
          buildium_reconciliation_id: buildiumReconciliationId,
          buildium_bank_account_id: buildiumBankAccountId ?? null,
          statement_ending_date: statementEndingDate ?? null,
          is_finished: Boolean(newReconciliation?.IsFinished ?? newReconciliation?.isFinished ?? false),
		          ending_balance: null,
	          total_checks_withdrawals: null,
	          total_deposits_additions: null,
	          bank_gl_account_id,
	          gl_account_id,
	          property_id,
	        }

        await admin.from('reconciliation_log')
          .upsert(payload, { onConflict: 'buildium_reconciliation_id' })
      }
    } catch {
      logger.warn('Reconciliation log upsert (create) failed; continuing')
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
