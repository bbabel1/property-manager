#!/usr/bin/env npx tsx
/**
 * Cleanup bank lines:
 *  - Remove bank lines on non-cash Bills/Charges (no payment component).
 *  - Add bank Credit lines for OwnerDraw/OwnerDistribution outflows missing bank lines.
 *
 * Usage:
 *   npx tsx scripts/cleanup-bank-lines.ts --property <propertyId> [--apply]
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const propIdx = args.indexOf('--property')
if (propIdx === -1 || !args[propIdx + 1]) {
  console.error('Usage: cleanup-bank-lines --property <propertyId> [--apply]')
  process.exit(1)
}
const propertyId = args[propIdx + 1]

const BANK_GL_NAME = 'Trust account' // fallback; we will resolve by property

async function getPropertyBankGlAccountId(pid: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
    .eq('id', pid)
    .maybeSingle()
  if (error) throw error
  return (
    (data as any)?.operating_bank_gl_account_id ??
    (data as any)?.deposit_trust_gl_account_id ??
    null
  )
}

const OUTFLOW_TYPES = ['billpayment', 'owner', 'distribution']
const NONCASH_TYPES = ['bill', 'charge']

async function main() {
  const bankGlId = await getPropertyBankGlAccountId(propertyId)
  if (!bankGlId) {
    console.error('No bank GL configured for property:', propertyId)
    process.exit(1)
  }

  // Fetch transactions for the property
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('id, transaction_type, total_amount, date, lease_id, buildium_transaction_id')
    .limit(5000)
  if (txErr) throw txErr

  // Get lines per transaction
  const txIds = (txs || []).map((t) => t.id)
  const { data: lines, error: linesErr } = await supabase
    .from('transaction_lines')
    .select(
      'id, transaction_id, gl_account_id, amount, posting_type, property_id, unit_id, lease_id, gl_accounts(name, is_bank_account, type, sub_type, exclude_from_cash_balances)',
    )
    .in('transaction_id', txIds)
  if (linesErr) throw linesErr

  const linesByTx = new Map<string, any[]>()
  for (const l of lines || []) {
    const arr = linesByTx.get(l.transaction_id) || []
    arr.push(l)
    linesByTx.set(l.transaction_id, arr)
  }

  let removed = 0
  let added = 0

  for (const tx of txs || []) {
    const type = (tx.transaction_type || '').toString().toLowerCase()
    const txLines = linesByTx.get(tx.id) || []
    const bankLines = txLines.filter(
      (l) => l.gl_accounts?.is_bank_account && !l.gl_accounts?.exclude_from_cash_balances,
    )
    const hasBank = bankLines.length > 0
    const totalAbs = Math.abs(Number(tx.total_amount) || 0)

    const isNonCash = NONCASH_TYPES.some((t) => type.includes(t))
    const isOutflow = OUTFLOW_TYPES.some((t) => type.includes(t))

    // Remove bank lines on non-cash Bills/Charges
    if (isNonCash && hasBank) {
      if (isApply) {
        const { error } = await supabase
          .from('transaction_lines')
          .delete()
          .in(
            'id',
            bankLines.map((b) => b.id),
          )
        if (error) throw error
      }
      removed += bankLines.length
      console.log(
        `${isApply ? '[removed]' : '[would remove]'} bank lines on non-cash tx=${tx.id} type=${tx.transaction_type} count=${bankLines.length}`,
      )
      continue
    }

    // Add bank Credit for outflows missing bank
    if (isOutflow && !hasBank && totalAbs > 0) {
      const lineDate = tx.date ?? new Date().toISOString().slice(0, 10)
      const nowIso = new Date().toISOString()
      const bankLine = {
        transaction_id: tx.id,
        gl_account_id: bankGlId,
        amount: totalAbs,
        posting_type: 'Credit',
        date: lineDate,
        account_entity_type: 'Rental',
        property_id: tx.property_id ?? propertyId,
        lease_id: tx.lease_id ?? null,
        unit_id: null,
        created_at: nowIso,
        updated_at: nowIso,
      }
      if (isApply) {
        const { error } = await supabase.from('transaction_lines').insert(bankLine)
        if (error) throw error
      }
      added++
      console.log(`${isApply ? '[added]' : '[would add]'} bank Credit for outflow tx=${tx.id} type=${tx.transaction_type} amount=${totalAbs}`)
    }
  }

  console.log('\nCleanup complete.')
  console.log(`Bank lines removed: ${removed}`)
  console.log(`Bank lines added (outflows): ${added}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
