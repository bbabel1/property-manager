import type { SupabaseClient } from '@supabase/supabase-js'
import type { BankEntryStatus, BankRegisterState } from '@/types/bank-register'
import type { Database, Tables, TablesInsert } from '@/types/database'

type BankRegisterStateRow = Tables<'bank_register_state'>
type BankRegisterStateInsert = TablesInsert<'bank_register_state'>
type TypedSupabaseClient = SupabaseClient<Database>

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
  client: TypedSupabaseClient,
  params: { transactionId: string; bankGlAccountId: string },
): Promise<BankRegisterState | null> {
  const { data, error } = await client
    .from('bank_register_state')
    .select('*')
    .eq('transaction_id', params.transactionId)
    .eq('bank_gl_account_id', params.bankGlAccountId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapBankRegisterState(data);
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
  client: TypedSupabaseClient,
  params: UpsertBankRegisterStateArgs,
): Promise<BankRegisterState> {
  const nowIso = new Date().toISOString();
  const payload: BankRegisterStateInsert = {
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
    updated_at: nowIso,
  }

  const { data, error } = await client
    .from('bank_register_state')
    .upsert(payload, {
      onConflict: 'org_id,bank_gl_account_id,transaction_id',
    })
    .select('*')
    .maybeSingle<BankRegisterStateRow>();

  if (error || !data) {
    throw error ?? new Error('Failed to upsert bank register state');
  }

  return mapBankRegisterState(data);
}
