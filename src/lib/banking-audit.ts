import type { SupabaseClient } from '@supabase/supabase-js'

export type BankingAuditAction =
  | 'transaction_cleared'
  | 'transaction_uncleared'
  | 'transaction_reconciled'
  | 'reconciliation_created'
  | 'reconciliation_locked'
  | 'reconciliation_unlocked'
  | 'reconciliation_finalized'
  | 'edit_blocked_reconciled'
  | 'status_change_blocked'
  | 'system_sync'

type FieldChange = Record<string, { old: unknown; new: unknown }>

export async function logBankingAuditEvent(
  supabase: SupabaseClient,
  params: {
    orgId: string
    actorUserId: string | null
    action: BankingAuditAction
    transactionId?: string
    bankGlAccountId?: string
    reconciliationId?: string
    fieldChanges?: FieldChange
  },
) {
  const { error } = await supabase.from('banking_audit_log').insert({
    org_id: params.orgId,
    actor_user_id: params.actorUserId,
    action: params.action,
    transaction_id: params.transactionId,
    bank_gl_account_id: params.bankGlAccountId,
    reconciliation_id: params.reconciliationId,
    field_changes: params.fieldChanges ?? {},
  })

  if (error) {
    // Audit failures should not block primary operations; log to console for observability.
    console.error('Failed to log banking audit event:', error)
  }
}
