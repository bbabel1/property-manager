#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

config({ path: '.env.local' })

type Supabase = ReturnType<typeof createClient<Database>>

const nowIso = () => new Date().toISOString()

const mask = (value: string | null | undefined) => {
  if (!value) return null
  const s = String(value)
  if (s.length <= 4) return s
  return `****${s.slice(-4)}`
}

// Deterministic-ish placeholder Buildium GL account id for local-only GL rows.
// Kept within 900,000,000..900,099,999 to reduce collision with real Buildium IDs.
function computeLocalGlId(seed: string, bump: number = 0): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  const base = 900_000_000 + (Math.abs(h) % 100_000)
  return base + (bump % 100_000)
}

async function ensureUniqueBuildiumGlAccountId(db: Supabase, seed: string): Promise<number> {
  for (let bump = 0; bump < 25; bump++) {
    const candidate = computeLocalGlId(seed, bump)
    const { data } = await db
      .from('gl_accounts')
      .select('id')
      .eq('buildium_gl_account_id', candidate)
      .limit(1)
      .maybeSingle()
    if (!data) return candidate
  }
  throw new Error('Failed to generate a unique placeholder buildium_gl_account_id after 25 attempts')
}

async function splitDuplicateGlAccountGroups(db: Supabase, apply: boolean) {
  const { data: bankAccounts, error } = await db
    .from('bank_accounts')
    .select('id, org_id, gl_account, name, description, bank_account_type, account_number, routing_number, country, balance, buildium_balance, check_printing_info, electronic_payments, buildium_bank_id, updated_at, created_at, last_source, last_source_ts')
    .not('gl_account', 'is', null)

  if (error) throw error
  const rows = (bankAccounts ?? []) as any[]

  const groups = new Map<string, any[]>()
  for (const row of rows) {
    const key = String(row.gl_account)
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1)
  if (!dupGroups.length) {
    console.log('✅ No duplicate bank_accounts.gl_account groups found.')
    return
  }

  console.log(`⚠️ Found ${dupGroups.length} gl_account(s) referenced by multiple bank_accounts.`)

  for (const [glAccountId, list] of dupGroups) {
    // Choose deterministic first: most recently updated.
    list.sort((a, b) => {
      const au = a.updated_at ? Date.parse(a.updated_at) : 0
      const bu = b.updated_at ? Date.parse(b.updated_at) : 0
      return bu - au
    })
    const [primary, ...extras] = list

    console.log(`\n- gl_account=${glAccountId} has ${list.length} bank_accounts:`)
    for (const b of list) {
      console.log(`  - bank_accounts.id=${b.id} name=${b.name} buildium_bank_id=${b.buildium_bank_id ?? 'null'} acct=${mask(b.account_number)}`)
    }

    if (!extras.length) continue

    const { data: baseGl, error: glErr } = await db
      .from('gl_accounts')
      .select('*')
      .eq('id', glAccountId)
      .maybeSingle()
    if (glErr) throw glErr
    if (!baseGl) {
      console.log(`  ❌ Missing gl_accounts row for id=${glAccountId}; skipping group.`)
      continue
    }

    for (const extra of extras) {
      const seed = `${baseGl.org_id ?? extra.org_id ?? 'org'}:${extra.id}`
      const placeholderBuildiumGlId = await ensureUniqueBuildiumGlAccountId(db, seed)

      const newGlPayload: any = {
        buildium_gl_account_id: placeholderBuildiumGlId,
        account_number: baseGl.account_number,
        name: extra.name ?? baseGl.name,
        description: extra.description ?? baseGl.description,
        type: baseGl.type ?? 'Asset',
        sub_type: baseGl.sub_type,
        is_default_gl_account: false,
        default_account_name: baseGl.default_account_name,
        is_contra_account: baseGl.is_contra_account,
        is_bank_account: true,
        cash_flow_classification: baseGl.cash_flow_classification,
        exclude_from_cash_balances: baseGl.exclude_from_cash_balances,
        is_active: baseGl.is_active ?? true,
        buildium_parent_gl_account_id: baseGl.buildium_parent_gl_account_id,
        is_credit_card_account: baseGl.is_credit_card_account,
        sub_accounts: baseGl.sub_accounts,
        org_id: baseGl.org_id ?? extra.org_id ?? null,
        is_security_deposit_liability: baseGl.is_security_deposit_liability ?? false,
        updated_at: nowIso(),
        created_at: nowIso(),
        buildium_bank_account_id: extra.buildium_bank_id ?? null,
        bank_account_type: extra.bank_account_type ?? null,
        bank_account_number: extra.account_number ?? null,
        bank_routing_number: extra.routing_number ?? null,
        bank_country: extra.country ?? null,
        bank_check_printing_info: extra.check_printing_info ?? null,
        bank_electronic_payments: extra.electronic_payments ?? null,
        bank_balance: extra.balance ?? 0,
        bank_buildium_balance: extra.buildium_balance ?? 0,
        bank_last_source: extra.last_source ?? null,
        bank_last_source_ts: extra.last_source_ts ?? null,
      }

      console.log(`  → Would create new gl_accounts row for bank_accounts.id=${extra.id} (placeholder buildium_gl_account_id=${placeholderBuildiumGlId})`)
      if (!apply) continue

      const { data: inserted, error: insErr } = await db
        .from('gl_accounts')
        .insert(newGlPayload)
        .select('id')
        .single()
      if (insErr) throw insErr

      const newGlId = inserted.id

      // Update the bank_accounts.gl_account so it becomes a true 1:1 mapping.
      const { error: updBankErr } = await db
        .from('bank_accounts')
        .update({ gl_account: newGlId, updated_at: nowIso() })
        .eq('id', extra.id)
      if (updBankErr) throw updBankErr

      // Update newly-added FK columns to point to the new GL id for rows that referenced this bank account id.
      await Promise.all([
        db.from('properties').update({ operating_bank_gl_account_id: newGlId } as any).eq('operating_bank_account_id', extra.id),
        db.from('properties').update({ deposit_trust_gl_account_id: newGlId } as any).eq('deposit_trust_account_id', extra.id),
        db.from('transactions').update({ bank_gl_account_id: newGlId } as any).eq('bank_account_id', extra.id),
        db.from('reconciliation_log').update({ bank_gl_account_id: newGlId } as any).eq('bank_account_id', extra.id),
      ])

      console.log(`  ✅ Created gl_accounts.id=${newGlId} and rewired references for bank_accounts.id=${extra.id}`)
    }

    // Ensure the primary gl_account row has bank fields populated from the chosen primary bank account.
    const primaryUpdate: any = {
      is_bank_account: true,
      buildium_bank_account_id: primary.buildium_bank_id ?? null,
      bank_account_type: primary.bank_account_type ?? null,
      bank_account_number: primary.account_number ?? null,
      bank_routing_number: primary.routing_number ?? null,
      bank_country: primary.country ?? null,
      bank_check_printing_info: primary.check_printing_info ?? null,
      bank_electronic_payments: primary.electronic_payments ?? null,
      bank_balance: primary.balance ?? 0,
      bank_buildium_balance: primary.buildium_balance ?? 0,
      bank_last_source: primary.last_source ?? null,
      bank_last_source_ts: primary.last_source_ts ?? null,
      updated_at: nowIso(),
    }

    if (apply) {
      const { error: updGlErr } = await db
        .from('gl_accounts')
        .update(primaryUpdate)
        .eq('id', glAccountId)
      if (updGlErr) throw updGlErr
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const splitDuplicates = process.argv.includes('--split-duplicates')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local)')
  }

  const db = createClient<Database>(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  })

  console.log(`🚀 Phase 2 migration helper (${apply ? 'APPLY' : 'DRY RUN'})`)
  console.log('This script is intended to be run AFTER the Phase 2 SQL migrations are applied.')

  if (splitDuplicates) {
    await splitDuplicateGlAccountGroups(db, apply)
  } else {
    console.log('ℹ️ Skipping duplicate splitting (pass --split-duplicates to enable).')
  }

  console.log('✅ Done.')
}

main().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})

