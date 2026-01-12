#!/usr/bin/env npx tsx
/**
 * Retry Buildium sync for deposits whose deposit_meta.buildium_sync_status = 'failed'.
 *
 * Usage:
 *   npx tsx scripts/buildium/sync/retry-failed-deposits.ts [--limit 20]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client'
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

type DepositMetaRow = {
  transaction_id: string
  deposit_id: string | null
  org_id: string | null
  buildium_deposit_id: number | null
  status: 'posted' | 'reconciled' | 'voided' | null
}

type TransactionRow = {
  id: string
  date: string | null
  memo: string | null
  org_id: string | null
  bank_gl_account_id: string | null
  buildium_transaction_id: number | null
  total_amount: number | null
  gl_accounts: { buildium_gl_account_id: number | null } | null
}

type TransactionLineRow = {
  gl_account_id: string | null
  amount: number | null
  property_id: string | null
  unit_id: string | null
  posting_type: string | null
}

type GlAccountRow = { id: string; buildium_gl_account_id: number | null }
type PropertyRow = { id: string; buildium_property_id: number | null }
type UnitRow = { id: string; buildium_unit_id: number | null }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const argLimit = (() => {
  const idx = process.argv.findIndex((a) => a === '--limit')
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1])
    if (Number.isFinite(n) && n > 0) return Math.min(n, 200)
  }
  return 50
})()

const nowIso = () => new Date().toISOString()

async function fetchFailedDeposits(limit: number): Promise<DepositMetaRow[]> {
  const { data, error } = await admin
    .from('deposit_meta')
    .select('transaction_id, deposit_id, org_id, buildium_deposit_id, status')
    .eq('buildium_sync_status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(limit)
    .returns<DepositMetaRow[]>()
  if (error) throw error
  return data || []
}

async function markSyncResult(
  transactionId: string,
  result: { status: 'synced' | 'failed'; error?: string | null; buildiumDepositId?: number | null },
) {
  await admin
    .from('deposit_meta')
    .update({
      buildium_sync_status: result.status,
      buildium_sync_error: result.error ?? null,
      buildium_last_synced_at: nowIso(),
      buildium_deposit_id:
        typeof result.buildiumDepositId === 'number' ? result.buildiumDepositId : undefined,
      updated_at: nowIso(),
    })
    .eq('transaction_id', transactionId)
}

async function retryDeposit(meta: DepositMetaRow) {
  const { transaction_id: transactionId } = meta
  const { data: tx, error: txErr } = await admin
    .from('transactions')
    .select(
      `
      id,
      date,
      memo,
      org_id,
      bank_gl_account_id,
      buildium_transaction_id,
      total_amount,
      gl_accounts:gl_accounts!transactions_bank_gl_account_id_fkey(buildium_gl_account_id)
    `,
    )
    .eq('id', transactionId)
    .maybeSingle<TransactionRow>()

  if (txErr) throw txErr
  if (!tx) {
    console.warn(`Skipping ${transactionId}: transaction not found`)
    return
  }

  const buildiumDepositId =
    meta.buildium_deposit_id ??
    (typeof tx.buildium_transaction_id === 'number' ? tx.buildium_transaction_id : null)

  const bankBuildiumId =
    (tx.gl_accounts?.buildium_gl_account_id as number | null | undefined) ?? null

  if (!buildiumDepositId || !bankBuildiumId) {
    console.warn(
      `Skipping ${transactionId}: missing Buildium IDs (deposit:${buildiumDepositId}, bank:${bankBuildiumId})`,
    )
    return
  }

  const orgId = tx.org_id ?? meta.org_id ?? null
  const udfGlAccountId = await resolveUndepositedFundsGlAccountId(admin as any, orgId)

  const { data: splits } = await admin
    .from('transaction_payment_transactions')
    .select('buildium_payment_transaction_id')
    .eq('transaction_id', transactionId)
    .not('buildium_payment_transaction_id', 'is', null)
  const paymentBuildiumIds = (splits || [])
    .map((row: any) => Number(row?.buildium_payment_transaction_id))
    .filter((n) => Number.isFinite(n)) as number[]

  const { data: lines } = await admin
    .from('transaction_lines')
    .select('gl_account_id, amount, property_id, unit_id, posting_type')
    .eq('transaction_id', transactionId)
    .eq('posting_type', 'Credit')
    .returns<TransactionLineRow[]>()

  const creditLines = (lines || []).filter((l) => {
    const glId = l?.gl_account_id
    if (!glId) return false
    if (glId === tx.bank_gl_account_id) return false
    if (udfGlAccountId && glId === udfGlAccountId) return false
    return true
  })

  const glIds = Array.from(new Set(creditLines.map((l) => l.gl_account_id).filter(Boolean))).map(
    String,
  )
  const propertyIds = Array.from(
    new Set(creditLines.map((l) => l.property_id).filter(Boolean)),
  ).map(String)
  const unitIds = Array.from(new Set(creditLines.map((l) => l.unit_id).filter(Boolean))).map(String)

  const { data: glRows } = glIds.length
    ? await admin.from('gl_accounts').select('id, buildium_gl_account_id').in('id', glIds)
    : { data: [] as GlAccountRow[] }
  const glBuildiumById = new Map<string, number>()
  ;(glRows || []).forEach((g) => {
    if (typeof g?.buildium_gl_account_id === 'number')
      glBuildiumById.set(String(g.id), g.buildium_gl_account_id)
  })

  const { data: propRows } = propertyIds.length
    ? await admin.from('properties').select('id, buildium_property_id').in('id', propertyIds)
    : { data: [] as PropertyRow[] }
  const propertyBuildiumById = new Map<string, number>()
  ;(propRows || []).forEach((p) => {
    if (typeof p?.buildium_property_id === 'number')
      propertyBuildiumById.set(String(p.id), p.buildium_property_id)
  })

  const { data: unitRows } = unitIds.length
    ? await admin.from('units').select('id, buildium_unit_id').in('id', unitIds)
    : { data: [] as UnitRow[] }
  const unitBuildiumById = new Map<string, number>()
  ;(unitRows || []).forEach((u) => {
    if (typeof u?.buildium_unit_id === 'number')
      unitBuildiumById.set(String(u.id), u.buildium_unit_id)
  })

  const otherLines = creditLines
    .map((l) => {
      const glBuildiumId = glBuildiumById.get(String(l.gl_account_id))
      if (typeof glBuildiumId !== 'number') return null
      const buildiumPropertyId = l?.property_id ? propertyBuildiumById.get(String(l.property_id)) : undefined
      const buildiumUnitId = l?.unit_id ? unitBuildiumById.get(String(l.unit_id)) : undefined
      const accountingEntity =
        typeof buildiumPropertyId === 'number'
          ? {
              Id: buildiumPropertyId,
              AccountingEntityType: 'Rental',
              UnitId: typeof buildiumUnitId === 'number' ? buildiumUnitId : undefined,
            }
          : null
      const amount = Number(l?.amount ?? 0)
      return {
        GLAccountId: glBuildiumId,
        AccountingEntity: accountingEntity ?? undefined,
        Amount: amount,
      }
    })
    .filter(Boolean)

  const buildiumPayload: Record<string, unknown> = {
    EntryDate: tx.date ?? undefined,
    Memo: tx.memo || undefined,
    PaymentTransactionIds: paymentBuildiumIds,
    Lines: otherLines,
  }

  const client = await getOrgScopedBuildiumClient(orgId ?? undefined)

  await client.makeRequest(
    'PUT',
    `/bankaccounts/${bankBuildiumId}/deposits/${buildiumDepositId}`,
    buildiumPayload,
  )

  await markSyncResult(transactionId, {
    status: 'synced',
    error: null,
    buildiumDepositId,
  })
  console.log(`✅ Synced deposit ${meta.deposit_id ?? transactionId} to Buildium (id ${buildiumDepositId})`)
}

async function main() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  console.log(`🔁 Retrying failed deposit Buildium syncs (limit ${argLimit})`)
  const failed = await fetchFailedDeposits(argLimit)
  if (!failed.length) {
    console.log('No failed deposits to retry.')
    return
  }

  for (const meta of failed) {
    try {
      await retryDeposit(meta)
    } catch (err) {
      console.error(
        `❌ Failed to sync deposit ${meta.deposit_id ?? meta.transaction_id}:`,
        (err as any)?.message ?? String(err),
      )
      await markSyncResult(meta.transaction_id, {
        status: 'failed',
        error: (err as any)?.message ?? String(err),
        buildiumDepositId: meta.buildium_deposit_id ?? null,
      })
    }
  }
}

main().catch((err) => {
  console.error('Fatal error running retry job:', err)
  process.exit(1)
})
