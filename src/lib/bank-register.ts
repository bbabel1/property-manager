import type { SupabaseClient } from '@supabase/supabase-js'
import type { BankEntryStatus, BankRegisterState } from '@/types/bank-register'

type BankRegisterStateRow = {
  org_id: string
  bank_gl_account_id: string
  transaction_id: string
  buildium_transaction_id: number | null
  status: BankEntryStatus
  current_reconciliation_log_id: string | null
  cleared_at: string | null
  cleared_by_user_id: string | null
  reconciled_at: string | null
  reconciled_by_user_id: string | null
  created_at: string
  updated_at: string
}

function mapBankRegisterState(row: BankRegisterStateRow): BankRegisterState {
  return {
    orgId: row.org_id,
    bankGlAccountId: row.bank_gl_account_id,
    transactionId: row.transaction_id,
    buildiumTransactionId: row.buildium_transaction_id,
    status: row.status,
    currentReconciliationLogId: row.current_reconciliation_log_id,
    clearedAt: row.cleared_at,
    clearedByUserId: row.cleared_by_user_id,
    reconciledAt: row.reconciled_at,
    reconciledByUserId: row.reconciled_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getBankRegisterState(
  client: SupabaseClient,
  params: { transactionId: string; bankGlAccountId: string },
): Promise<BankRegisterState | null> {
  const { data, error } = await client
    .from('bank_register_state')
    .select(
      [
        'org_id',
        'bank_gl_account_id',
        'transaction_id',
        'buildium_transaction_id',
        'status',
        'current_reconciliation_log_id',
        'cleared_at',
        'cleared_by_user_id',
        'reconciled_at',
        'reconciled_by_user_id',
        'created_at',
        'updated_at',
      ].join(', '),
    )
    .eq('transaction_id', params.transactionId)
    .eq('bank_gl_account_id', params.bankGlAccountId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapBankRegisterState(data as BankRegisterStateRow);
}

type UpsertBankRegisterStateArgs = {
  orgId: string
  bankGlAccountId: string
  transactionId: string
  buildiumTransactionId?: number | null
  status?: BankEntryStatus
  currentReconciliationLogId?: string | null
  clearedAt?: string | null
  clearedByUserId?: string | null
  reconciledAt?: string | null
  reconciledByUserId?: string | null
}

export async function upsertBankRegisterState(
  client: SupabaseClient,
  params: UpsertBankRegisterStateArgs,
): Promise<BankRegisterState> {
  const payload = {
    org_id: params.orgId,
    bank_gl_account_id: params.bankGlAccountId,
    transaction_id: params.transactionId,
    buildium_transaction_id: params.buildiumTransactionId ?? null,
    status: params.status ?? 'uncleared',
    current_reconciliation_log_id: params.currentReconciliationLogId ?? null,
    cleared_at: params.clearedAt ?? null,
    cleared_by_user_id: params.clearedByUserId ?? null,
    reconciled_at: params.reconciledAt ?? null,
    reconciled_by_user_id: params.reconciledByUserId ?? null,
  }

  const { data, error } = await client
    .from('bank_register_state')
    .upsert(payload, {
      onConflict: 'org_id,bank_gl_account_id,transaction_id',
    })
    .select(
      [
        'org_id',
        'bank_gl_account_id',
        'transaction_id',
        'buildium_transaction_id',
        'status',
        'current_reconciliation_log_id',
        'cleared_at',
        'cleared_by_user_id',
        'reconciled_at',
        'reconciled_by_user_id',
        'created_at',
        'updated_at',
      ].join(', '),
    )
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error('Failed to upsert bank register state');
  }

  return mapBankRegisterState(data as BankRegisterStateRow);
}
