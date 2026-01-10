import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { buildiumFetch } from '@/lib/buildium-http'
import { logger } from '@/lib/logger'
import type { Database as DatabaseSchema } from '@/types/database'
import { syncBuildiumReconciliationTransactions } from '@/lib/buildium-reconciliation-sync'

type BankAccountRow = Pick<DatabaseSchema['public']['Tables']['gl_accounts']['Row'], 'id' | 'buildium_gl_account_id'>
type PropertyAccountRow = Pick<
  DatabaseSchema['public']['Tables']['properties']['Row'],
  'operating_bank_gl_account_id' | 'deposit_trust_gl_account_id'
>
type ReconciliationInsert = DatabaseSchema['public']['Tables']['reconciliation_log']['Insert']
type ReconciliationRow = Pick<
  DatabaseSchema['public']['Tables']['reconciliation_log']['Row'],
  'id' | 'is_finished' | 'ending_balance' | 'statement_ending_date'
>

type BuildiumReconciliation = {
  Id?: number
  id?: number
  StatementEndingDate?: string
  statementEndingDate?: string
  IsFinished?: boolean
  isFinished?: boolean
}

type BuildiumBalance = {
  EndingBalance?: number
  endingBalance?: number
  TotalChecksAndWithdrawals?: number
  totalChecksAndWithdrawals?: number
  TotalDepositsAndAdditions?: number
  totalDepositsAndAdditions?: number
}
type ReconciliationVarianceAlertRow = { property_id: string | null }
type ReconciliationAlertRow = { property_id: string | null }

// On-demand sync job for Buildium reconciliations → reconciliation_log
export async function GET(req: NextRequest) {
  const admin = supabaseAdmin
  if (!admin) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

  const url = new URL(req.url)
  const bankAccountId = url.searchParams.get('bankAccountId')
  const propertyId = url.searchParams.get('propertyId')
  const includeFinished = url.searchParams.get('includeFinished') === 'true'

  let bankAccounts: BankAccountRow[] = []
  try {
    // Phase 4: bank accounts are gl_accounts rows flagged is_bank_account=true
    let query = admin.from('gl_accounts').select('id, buildium_gl_account_id').eq('is_bank_account', true)
    if (bankAccountId) query = query.eq('id', bankAccountId)
    const { data, error } = await query
    if (error) throw error
    bankAccounts = data || []
  } catch (e) {
    logger.error({ e }, 'Failed to list bank accounts for sync')
    return NextResponse.json({ error: 'Failed to list bank accounts' }, { status: 500 })
  }

  // This is a platform_admin route, so orgId is undefined (falls back to env vars)

  let totalAccounts = 0
  let totalRecs = 0
  let totalBalances = 0
  let totalTxnSyncs = 0
  let totalUnmatched = 0
  let syncErrors = 0
  let changes = 0

    // If propertyId provided, restrict bank accounts to the property's linked accounts
    if (propertyId) {
      try {
        const { data: pr } = await admin
          .from('properties')
          .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
          .eq('id', propertyId)
          .maybeSingle()
        if (pr) {
          const ids = [
            (pr as PropertyAccountRow).operating_bank_gl_account_id,
            (pr as PropertyAccountRow).deposit_trust_gl_account_id,
          ].filter(Boolean)
          if (ids.length) bankAccounts = bankAccounts.filter(b => ids.includes(b.id))
        }
      } catch {}
    }

  for (const ba of bankAccounts) {
    const buildiumBankAccountId = ba.buildium_gl_account_id
    if (!buildiumBankAccountId || buildiumBankAccountId <= 0) continue
    totalAccounts++
    try {
      // Fetch reconciliations per Buildium bank account
      const res = await buildiumFetch('GET', `/bankaccounts/${buildiumBankAccountId}/reconciliations`, undefined, undefined, undefined)
        if (!res.ok) {
          logger.warn({ bank: buildiumBankAccountId, status: res.status }, 'Reconciliations fetch failed')
          continue
        }
        const recs = (res.json ?? []) as BuildiumReconciliation[]
        for (const r of recs) {
        totalRecs++
        // Map to local property via properties.operating_bank_gl_account_id or deposit_trust_gl_account_id (fallback legacy)
        let property_id: string | null = null
        try {
          const { data: prop } = await admin
            .from('properties')
            .select('id')
            .or(`operating_bank_gl_account_id.eq.${ba.id},deposit_trust_gl_account_id.eq.${ba.id}`)
            .limit(1)
            .maybeSingle()
          if (prop) property_id = prop.id
        } catch {}

        const buildiumRecId = r?.Id ?? r?.id
        if (buildiumRecId == null) continue

        const payload: Partial<ReconciliationInsert> = {
          buildium_reconciliation_id: buildiumRecId,
          buildium_bank_account_id: buildiumBankAccountId,
          bank_gl_account_id: ba.id,
          gl_account_id: ba.id,
          property_id,
          statement_ending_date: r?.StatementEndingDate ?? r?.statementEndingDate ?? null,
          is_finished: Boolean(r?.IsFinished ?? r?.isFinished ?? false),
        }
        const { data: recRow, error: upErr } = await admin
          .from('reconciliation_log')
          .upsert(payload, { onConflict: 'buildium_reconciliation_id' })
          .select('id, is_finished, ending_balance, statement_ending_date')
          .maybeSingle<ReconciliationRow>()
        if (upErr) {
          logger.warn(
            { err: upErr.message, recId: buildiumRecId, bank: buildiumBankAccountId },
            'Upsert reconciliation failed',
          )
        } else {
          changes++
        }

        // Fetch balance for this reconciliation
        const bid = buildiumRecId
        if (bid != null) {
          const balRes = await buildiumFetch(
            'GET',
            `/bankaccounts/${buildiumBankAccountId}/reconciliations/${bid}/balance`,
            undefined,
            undefined,
            undefined,
          )
          if (balRes.ok) {
            totalBalances++
            const b = (balRes.json ?? {}) as BuildiumBalance
            const balPatch: Partial<ReconciliationInsert> = {
              buildium_reconciliation_id: bid,
              ending_balance: b?.EndingBalance ?? b?.endingBalance ?? null,
              total_checks_withdrawals: b?.TotalChecksAndWithdrawals ?? b?.totalChecksAndWithdrawals ?? null,
              total_deposits_additions: b?.TotalDepositsAndAdditions ?? b?.totalDepositsAndAdditions ?? null,
            }
            const { error: balUpErr } = await admin
              .from('reconciliation_log')
              .upsert(balPatch, { onConflict: 'buildium_reconciliation_id' })
            if (balUpErr) {
              logger.warn(
                { err: balUpErr.message, recId: bid, bank: buildiumBankAccountId },
                'Balance upsert failed',
              )
            }
          } else {
            // Graceful fallback: keep syncing transactions; log once
            const msg = `Balance fetch failed: bank=${buildiumBankAccountId}, rec=${bid}, status=${balRes.status}`
            logger.warn({ bank: buildiumBankAccountId, recId: bid, status: balRes.status }, 'Balance fetch failed')
            // Mark sync error for this reconciliation so UI can surface staleness, but don't stop txn sync
            await admin
              .from('reconciliation_log')
              .update({ last_sync_error: msg })
              .eq('buildium_reconciliation_id', bid)
          }
        }

        // Sync reconciliation transactions for open or optionally finished reconciliations
        const isFinished = Boolean(recRow?.is_finished ?? r?.IsFinished ?? r?.isFinished ?? false)
        if (!isFinished || includeFinished) {
          if (recRow?.id) {
            const syncResult = await syncBuildiumReconciliationTransactions(
              recRow.id,
              bid,
              ba.id,
              buildiumBankAccountId,
              admin,
              {
                markReconciled: isFinished,
                endingBalance: recRow.ending_balance ?? null,
                statementEndingDate: recRow.statement_ending_date ?? null,
              },
            )
            totalTxnSyncs += syncResult.synced
            totalUnmatched += syncResult.unmatched.length
            if (syncResult.errors.length) syncErrors += syncResult.errors.length
          }
        }
      }
    } catch (e) {
      logger.warn({ e, bank: buildiumBankAccountId }, 'Sync loop error for bank account')
    }
  }
  // Alert plumbing: log counts for variance and stale alerts
  try {
    // Cast client + view names because these views may lag behind generated Supabase types.
    const adminAny = admin as any
    const varianceQuery = adminAny
      .from('v_reconciliation_variance_alerts' as any)
      .select('property_id')
      .eq('over_24h', true)
    const staleQuery = adminAny.from('v_reconciliation_stale_alerts' as any).select('property_id')

    const { data: rawVarRows } = await varianceQuery
    const { data: rawStaleRows } = await staleQuery
    const varRows = rawVarRows as Pick<ReconciliationVarianceAlertRow, 'property_id'>[] | null
    const staleRows = rawStaleRows as ReconciliationAlertRow[] | null
    const varCount = Array.isArray(varRows) ? varRows.length : 0
    const staleCount = Array.isArray(staleRows) ? staleRows.length : 0
    if (varCount > 0 || staleCount > 0) {
      logger.warn({ varCount, staleCount }, 'Reconciliation alerts present after sync')
    }
  } catch {}

  return NextResponse.json({
    success: true,
    totalAccounts,
    totalRecs,
    totalBalances,
    changes,
    totalTxnSyncs,
    totalUnmatched,
    syncErrors,
  })
}
