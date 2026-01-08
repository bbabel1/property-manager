import type { SupabaseClient } from '@supabase/supabase-js'
import { buildiumFetch } from '@/lib/buildium-http'
import type { Database } from '@/types/database'

type TypedSupabase = SupabaseClient<Database>

type BuildiumReconciliationTransaction = {
  Id?: number
  id?: number
  TransactionId?: number
  transactionId?: number
  BuildiumTransactionId?: number
  buildiumTransactionId?: number
  Status?: string
  status?: string
  IsCleared?: boolean
  isCleared?: boolean
}

type SyncOptions = {
  forceResync?: boolean
  markReconciled?: boolean
}

function normalizeBuildiumTransactionId(tx: BuildiumReconciliationTransaction): number | null {
  const cand =
    tx.Id ??
    tx.id ??
    tx.TransactionId ??
    tx.transactionId ??
    tx.BuildiumTransactionId ??
    tx.buildiumTransactionId
  if (cand === null || cand === undefined) return null
  const asNum = Number(cand)
  return Number.isFinite(asNum) ? asNum : null
}

function inferStatus(
  tx: BuildiumReconciliationTransaction,
  options: SyncOptions | undefined,
): 'uncleared' | 'cleared' | 'reconciled' {
  if (options?.markReconciled) return 'reconciled'
  const rawStatus = tx.Status ?? tx.status
  const isCleared = Boolean(tx.IsCleared ?? tx.isCleared)
  if (typeof rawStatus === 'string') {
    const normalized = rawStatus.toLowerCase()
    if (normalized.includes('reconcil')) return 'reconciled'
    if (normalized.includes('clear')) return 'cleared'
  }
  return isCleared ? 'cleared' : 'uncleared'
}

export async function syncBuildiumReconciliationTransactions(
  reconciliationLogId: string,
  buildiumReconciliationId: number,
  bankGlAccountId: string,
  buildiumBankAccountId: number,
  supabase: TypedSupabase,
  options?: SyncOptions & {
    statementEndingDate?: string | null
    endingBalance?: number | null
    orgId?: string | null
  },
): Promise<{
  synced: number
  unmatched: number[]
  errors: Array<{ transactionId: number | null; error: string }>
  balanceDrift?: number | null
}> {
  const unmatched: number[] = []
  const errors: Array<{ transactionId: number | null; error: string }> = []
  let synced = 0
  const nowIso = new Date().toISOString()
  let balanceDrift: number | null = null

  try {
    const res = await buildiumFetch(
      'GET',
      `/bankaccounts/${buildiumBankAccountId}/reconciliations/${buildiumReconciliationId}/transactions`,
      undefined,
      undefined,
      undefined,
    )
    if (!res.ok) {
      const msg = `Buildium reconciliation transactions fetch failed: ${res.status}`
      await supabase
        .from('reconciliation_log')
        .update({ last_sync_error: msg })
        .eq('id', reconciliationLogId)
      return { synced, unmatched, errors: [{ transactionId: null, error: msg }] }
    }

    const txs = (res.json ?? []) as BuildiumReconciliationTransaction[]
    for (const tx of txs) {
      const buildiumTransactionId = normalizeBuildiumTransactionId(tx)
      if (buildiumTransactionId === null) {
        continue
      }

      const desiredStatus = inferStatus(tx, options)

      const { data: localTx, error: localErr } = await supabase
        .from('transactions')
        .select('id, org_id')
        .eq('buildium_transaction_id', buildiumTransactionId)
        .maybeSingle()

      if (localErr) {
        errors.push({ transactionId: buildiumTransactionId, error: localErr.message })
        continue
      }

      if (!localTx?.id || !localTx.org_id) {
        unmatched.push(buildiumTransactionId)
        continue
      }

      const payload = {
        org_id: localTx.org_id,
        bank_gl_account_id: bankGlAccountId,
        transaction_id: localTx.id,
        buildium_transaction_id: buildiumTransactionId,
        status: desiredStatus,
        current_reconciliation_log_id: reconciliationLogId,
        cleared_at: desiredStatus !== 'uncleared' ? nowIso : null,
        cleared_by_user_id: null,
        reconciled_at: desiredStatus === 'reconciled' ? nowIso : null,
        reconciled_by_user_id: null,
      }

      const { error: upsertErr } = await supabase
        .from('bank_register_state')
        .upsert(payload, {
          onConflict: 'org_id,bank_gl_account_id,transaction_id',
        })

      if (upsertErr) {
        errors.push({ transactionId: buildiumTransactionId, error: upsertErr.message })
        continue
      }

      synced++
    }

    const updates: Record<string, unknown> = {
      last_synced_at: nowIso,
      unmatched_buildium_transaction_ids: unmatched.length ? unmatched : null,
    }

    // Compare local cleared/reconciled balance to Buildium ending balance when context is provided
    if (options?.endingBalance != null && options?.statementEndingDate) {
      const { data: bookBalance, error: balanceErr } = await supabase.rpc('calculate_book_balance', {
        p_bank_gl_account_id: bankGlAccountId,
        p_as_of: options.statementEndingDate,
        p_org_id: options.orgId ?? null,
      })
      if (!balanceErr && typeof bookBalance === 'number') {
        balanceDrift = Number(options.endingBalance ?? 0) - Number(bookBalance ?? 0)
        if (Math.abs(balanceDrift) > 0.01) {
          updates.last_sync_error = `Balance drift: buildium=${options.endingBalance}, local=${bookBalance}, delta=${balanceDrift.toFixed(
            2,
          )}`
        }
      }
    }

    if (!updates.last_sync_error && (unmatched.length || errors.length)) {
      updates.last_sync_error = `Drift detected: unmatched=${unmatched.length}, errors=${errors.length}`
    } else if (!updates.last_sync_error) {
      updates.last_sync_error = null
    }

    const updateQuery = supabase.from('reconciliation_log').update(updates)
    if (typeof (updateQuery as any)?.eq === 'function') {
      await (updateQuery as any).eq('id', reconciliationLogId)
    }

    return { synced, unmatched, errors, balanceDrift }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const updateQuery = supabase
      .from('reconciliation_log')
      .update({ last_sync_error: message })
    if (typeof (updateQuery as any)?.eq === 'function') {
      await (updateQuery as any).eq('id', reconciliationLogId)
    }
    errors.push({ transactionId: null, error: message })
    return { synced, unmatched, errors }
  }
}
