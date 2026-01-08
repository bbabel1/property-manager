#!/usr/bin/env npx tsx
/**
 * Sync Buildium reconciliations to local database
 * Usage: npx tsx scripts/buildium/sync/sync-reconciliations.ts [--includeFinished]
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Try loading .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'
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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:')
    if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient<DatabaseSchema>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const includeFinished = process.argv.includes('--includeFinished') || process.argv.includes('--include-finished')
  const bankAccountId = process.argv.find(arg => arg.startsWith('--bankAccountId='))?.split('=')[1]
  const propertyId = process.argv.find(arg => arg.startsWith('--propertyId='))?.split('=')[1]

  console.log('🔄 Starting reconciliation sync...')
  if (includeFinished) console.log('   Including finished reconciliations')
  if (bankAccountId) console.log(`   Filtering by bank account: ${bankAccountId}`)
  if (propertyId) console.log(`   Filtering by property: ${propertyId}`)

  let bankAccounts: BankAccountRow[] = []
  try {
    let query = admin.from('gl_accounts').select('id, buildium_gl_account_id').eq('is_bank_account', true)
    if (bankAccountId) query = query.eq('id', bankAccountId)
    const { data, error } = await query
    if (error) throw error
    bankAccounts = data || []
    console.log(`   Found ${bankAccounts.length} bank account(s)`)
  } catch (e) {
    logger.error({ e }, 'Failed to list bank accounts for sync')
    console.error('❌ Failed to list bank accounts:', e)
    process.exit(1)
  }

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
    console.log(`\n📊 Processing bank account ${ba.id} (Buildium: ${buildiumBankAccountId})`)
    try {
      // Fetch reconciliations per Buildium bank account
      const res = await buildiumFetch('GET', `/bankaccounts/${buildiumBankAccountId}/reconciliations`, undefined, undefined, undefined)
      if (!res.ok) {
        logger.warn({ bank: buildiumBankAccountId, status: res.status }, 'Reconciliations fetch failed')
        console.warn(`   ⚠️  Reconciliations fetch failed: ${res.status}`)
        continue
      }
      const recs = (res.json ?? []) as BuildiumReconciliation[]
      console.log(`   Found ${recs.length} reconciliation(s)`)
      for (const r of recs) {
        totalRecs++
        // Map to local property via properties.operating_bank_gl_account_id or deposit_trust_gl_account_id
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
        // Check if reconciliation exists first (since unique index was dropped)
        const { data: existing } = await admin
          .from('reconciliation_log')
          .select('id, is_finished, ending_balance, statement_ending_date')
          .eq('buildium_reconciliation_id', buildiumRecId)
          .maybeSingle<ReconciliationRow>()

        let recRow: ReconciliationRow | null = null
        let upErr: Error | null = null

        if (existing) {
          // Update existing
          const { data: updated, error: updateErr } = await admin
            .from('reconciliation_log')
            .update(payload)
            .eq('buildium_reconciliation_id', buildiumRecId)
            .select('id, is_finished, ending_balance, statement_ending_date')
            .maybeSingle<ReconciliationRow>()
          recRow = updated
          upErr = updateErr ? new Error(updateErr.message) : null
        } else {
          // Insert new
          const { data: inserted, error: insertErr } = await admin
            .from('reconciliation_log')
            .insert(payload)
            .select('id, is_finished, ending_balance, statement_ending_date')
            .maybeSingle<ReconciliationRow>()
          recRow = inserted
          upErr = insertErr ? new Error(insertErr.message) : null
        }

        if (upErr) {
          logger.warn(
            { err: upErr.message, recId: buildiumRecId, bank: buildiumBankAccountId },
            'Upsert reconciliation failed',
          )
          console.warn(`   ⚠️  Upsert failed for reconciliation ${buildiumRecId}: ${upErr.message}`)
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
              console.warn(`   ⚠️  Balance upsert failed for reconciliation ${bid}: ${balUpErr.message}`)
            }
          } else {
            logger.warn(
              { status: balRes.status, recId: bid, bank: buildiumBankAccountId },
              'Balance fetch failed',
            )
            console.warn(`   ⚠️  Balance fetch failed for reconciliation ${bid}: ${balRes.status}`)
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
            if (syncResult.synced > 0 || syncResult.unmatched.length > 0) {
              console.log(`   ✓ Reconciliation ${bid}: ${syncResult.synced} synced, ${syncResult.unmatched.length} unmatched`)
            }
          }
        }
      }
    } catch (e) {
      logger.warn({ e, bank: buildiumBankAccountId }, 'Sync loop error for bank account')
      console.warn(`   ⚠️  Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Alert plumbing: log counts for variance and stale alerts
  try {
    const { data: varRows } = await admin.from('v_reconciliation_variance_alerts').select('property_id').eq('over_24h', true)
    const { data: staleRows } = await admin.from('v_reconciliation_stale_alerts').select('property_id')
    const varCount = Array.isArray(varRows) ? varRows.length : 0
    const staleCount = Array.isArray(staleRows) ? staleRows.length : 0
    if (varCount > 0 || staleCount > 0) {
      logger.warn({ varCount, staleCount }, 'Reconciliation alerts present after sync')
      console.warn(`\n⚠️  Alerts: ${varCount} variance, ${staleCount} stale`)
    }
  } catch {}

  const result = {
    success: true,
    totalAccounts,
    totalRecs,
    totalBalances,
    changes,
    totalTxnSyncs,
    totalUnmatched,
    syncErrors,
  }

  console.log('\n✅ Sync complete!')
  console.log(JSON.stringify(result, null, 2))
  
  return result
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
