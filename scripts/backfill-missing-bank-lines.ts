#!/usr/bin/env npx tsx
/**
 * Backfill missing bank GL lines for Payment/ApplyDeposit transactions.
 *
 * - Dry-run by default; pass --apply to insert the missing bank lines.
 * - Uses property operating_bank_gl_account_id (fallback: deposit_trust_gl_account_id).
 * - Keeps double-entry integrity: adds a single bank line for the debit/credit difference.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const isApply = process.argv.includes('--apply')
const pageSize = 500

// Resolve key GLs once
async function getGlIdByName(name: string): Promise<string | null> {
  const { data } = await supabase.from('gl_accounts').select('id').ilike('name', name).maybeSingle()
  return (data as any)?.id ?? null
}

type TxLineGlAccount = {
  name?: string | null
  type?: string | null
  sub_type?: string | null
  is_security_deposit_liability?: boolean | null
  is_bank_account?: boolean | null
  exclude_from_cash_balances?: boolean | null
}

type TxLine = {
  id: string
  transaction_id: string
  property_id: string | null
  unit_id: string | null
  lease_id: number | null
  gl_account_id: string
  amount: number
  posting_type: 'Debit' | 'Credit' | string
  date: string | null
  gl_accounts: TxLineGlAccount | TxLineGlAccount[] | null
}

type TxRow = {
  id: string
  transaction_type: string
  total_amount: number | null
  date: string | null
  lease_id: number | null
  buildium_transaction_id: number | null
  transaction_lines: TxLine[]
}

const propertyBankCache = new Map<
  string,
  { bankGlId: string | null; depositTrustGlId: string | null }
>()
const leaseCache = new Map<string, { property_id: string | null; unit_id: string | null }>()

async function getPropertyBankGlAccountId(propertyId: string | null): Promise<string | null> {
  if (!propertyId) return null
  const cached = propertyBankCache.get(propertyId)
  if (cached) return cached.bankGlId ?? cached.depositTrustGlId ?? null

  const { data, error } = await supabase
    .from('properties')
    .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
    .eq('id', propertyId)
    .maybeSingle()
  if (error) throw error

  const bankGlId = (data as any)?.operating_bank_gl_account_id ?? null
  const depositTrustGlId = (data as any)?.deposit_trust_gl_account_id ?? null
  propertyBankCache.set(propertyId, { bankGlId, depositTrustGlId })
  return bankGlId ?? depositTrustGlId ?? null
}

async function getLeaseMeta(leaseId: number | null): Promise<{ property_id: string | null; unit_id: string | null }> {
  if (leaseId == null) return { property_id: null, unit_id: null }
  const key = String(leaseId)
  const cached = leaseCache.get(key)
  if (cached) return cached

  const { data, error } = await supabase
    .from('lease')
    .select('property_id, unit_id')
    .eq('id', leaseId)
    .maybeSingle()
  if (error) throw error

  const meta = {
    property_id: (data as any)?.property_id ?? null,
    unit_id: (data as any)?.unit_id ?? null,
  }
  leaseCache.set(key, meta)
  return meta
}

async function backfill() {
  let offset = 0
  let scanned = 0
  const alreadyHasBank = 0
  let missingProperty = 0
  let missingBankGl = 0
  let balancedSkip = 0
  let inserted = 0

  console.log(`Starting backfill (dry-run=${!isApply})…`)

  const accountsReceivableGlId = await getGlIdByName('Accounts Receivable')
  const accountsPayableGlId = await getGlIdByName('Accounts Payable')

  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `
          id,
          transaction_type,
          total_amount,
          date,
          lease_id,
          buildium_transaction_id,
          transaction_lines (
            id,
            transaction_id,
            property_id,
            unit_id,
            lease_id,
            gl_account_id,
            amount,
            posting_type,
            date,
            gl_accounts (
              name,
              type,
              sub_type,
              is_security_deposit_liability,
              is_bank_account,
              exclude_from_cash_balances
            )
          )
        `,
      )
      .in('transaction_type', ['Payment', 'ApplyDeposit'])
      .order('date', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const rows = (data as TxRow[]) || []
    if (!rows.length) break

    for (const tx of rows) {
      scanned++

      const firstLineWithProperty =
        tx.transaction_lines.find((l) => l.property_id) ?? tx.transaction_lines[0]
      const leaseMeta = await getLeaseMeta(tx.lease_id)
      const propertyId = firstLineWithProperty?.property_id ?? leaseMeta.property_id
      const unitId = firstLineWithProperty?.unit_id ?? leaseMeta.unit_id

      if (!propertyId) {
        missingProperty++
        console.warn(
          `[skip][missing property] tx=${tx.id} buildium_tx=${tx.buildium_transaction_id ?? 'n/a'}`,
        )
        continue
      }

      const bankGlId = await getPropertyBankGlAccountId(propertyId)
      if (!bankGlId) {
        missingBankGl++
        console.warn(`[skip][missing bank gl] tx=${tx.id} property=${propertyId}`)
        continue
      }

      const rebuilt: any[] = []
      const nowIso = new Date().toISOString()
      const defaultDate =
        tx.date ?? firstLineWithProperty?.date ?? new Date().toISOString().slice(0, 10)

      let fallbackCredits = 0

      for (const line of tx.transaction_lines || []) {
        const gl = Array.isArray(line.gl_accounts) ? line.gl_accounts[0] : line.gl_accounts
        const isBank = Boolean(gl?.is_bank_account)
        if (isBank) continue
        const acc: TxLineGlAccount = gl || {}
        const type = (acc.type || '').toLowerCase()
        const sub = (acc.sub_type || '').toLowerCase()
        const name = (acc.name || '').toLowerCase()
        const isDepositLiability =
          acc.is_security_deposit_liability ||
          (type === 'liability' && (sub.includes('deposit') || name.includes('deposit')))
        const amt = Math.abs(Number(line.amount) || 0)
        if (isDepositLiability) {
          fallbackCredits += amt
          continue
        }
        if (!amt) continue
        const isVendorPayment = !tx.lease_id && tx.transaction_type === 'Payment'
        const glId =
          isVendorPayment && accountsPayableGlId
            ? accountsPayableGlId
            : accountsReceivableGlId ?? line.gl_account_id
        rebuilt.push({
          transaction_id: tx.id,
          gl_account_id: glId,
          amount: amt,
          posting_type: isVendorPayment ? 'Debit' : 'Credit', // vendor payments clear A/P (debit), tenant payments credit A/R
          date: line.date ?? defaultDate,
          account_entity_type: 'Rental',
          property_id: line.property_id ?? propertyId,
          lease_id: line.lease_id ?? tx.lease_id,
          unit_id: line.unit_id ?? unitId,
          created_at: nowIso,
          updated_at: nowIso,
        })
      }

      let totalCredits = rebuilt.reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0)
      if (totalCredits === 0) {
        totalCredits = Math.abs(Number(tx.total_amount) || 0) || fallbackCredits
      }
      if (totalCredits === 0) {
        balancedSkip++
        console.warn(`[skip][no credit amount] tx=${tx.id} property=${propertyId}`)
        continue
      }

      const isVendorPayment = !tx.lease_id && tx.transaction_type === 'Payment'

      // Add a single bank line to balance (debit for inflow, credit for vendor payment outflow)
      rebuilt.push({
        transaction_id: tx.id,
        gl_account_id: bankGlId,
        amount: totalCredits,
        posting_type: isVendorPayment ? 'Credit' : 'Debit',
        date: defaultDate,
        account_entity_type: 'Rental',
        property_id: propertyId,
        lease_id: tx.lease_id,
        unit_id: unitId,
        created_at: nowIso,
        updated_at: nowIso,
      })

      if (isApply) {
        // Replace lines atomically: delete then insert
        const { error: delErr } = await supabase
          .from('transaction_lines')
          .delete()
          .eq('transaction_id', tx.id)
        if (delErr) throw delErr
        const { error: insErr } = await supabase.from('transaction_lines').insert(rebuilt)
        if (insErr) throw insErr
      }

      inserted++
      console.log(
        `${isApply ? '[rebuilt]' : '[dry-run]'} tx=${tx.id} property=${propertyId} credits=${totalCredits} bank_gl=${bankGlId}`,
      )
    }

    offset += pageSize
  }

  console.log('\nBackfill complete.')
  console.log(`Scanned: ${scanned}`)
  console.log(`Has bank line already: ${alreadyHasBank}`)
  console.log(`Missing property: ${missingProperty}`)
  console.log(`Missing bank GL on property: ${missingBankGl}`)
  console.log(`Balanced (skipped): ${balancedSkip}`)
  console.log(`${isApply ? 'Inserted' : 'Would insert'}: ${inserted}`)
}

backfill().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
