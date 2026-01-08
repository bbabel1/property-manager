import type { SupabaseClient } from '@supabase/supabase-js'

export async function validateBankTransactionEditable(
  supabase: SupabaseClient,
  params: { transactionId: string; bankGlAccountId?: string | null },
): Promise<{ editable: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('has_reconciled_bank_lines', {
    p_transaction_id: params.transactionId,
    p_bank_gl_account_id: params.bankGlAccountId ?? null,
  })

  if (error) throw error
  if (data) {
    return {
      editable: false,
      reason: 'Bank-side transaction is part of a locked reconciliation. Only metadata (memo, date) can be edited.',
    }
  }
  return { editable: true }
}
