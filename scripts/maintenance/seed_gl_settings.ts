#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase URL or service role key')
  return createClient(url, key)
}

async function findGlIdByName(
  supabase: any,
  opts: { exact?: string; like?: string }
) {
  if (opts.exact) {
    const { data } = await supabase.from('gl_accounts').select('id, name').eq('name', opts.exact).limit(1)
    if (data && data[0]?.id) return data[0].id as string
  }
  if (opts.like) {
    const { data } = await supabase.from('gl_accounts').select('id, name').ilike('name', `%${opts.like}%`).limit(1)
    if (data && data[0]?.id) return data[0].id as string
  }
  return undefined
}

async function upsertForOrg(supabase: any, orgId: string) {
  const required: Record<string, string | undefined> = {}
  const RENT_NAME = process.env.RENT_INCOME_NAME || 'Rent Income'
  const DEPOSIT_LIAB_NAME = process.env.DEPOSIT_LIABILITY_NAME || 'Security Deposit Liability'
  required.ar_lease = await findGlIdByName(supabase, { like: 'receivable' })
  required.rent_income = await findGlIdByName(supabase, { exact: RENT_NAME, like: 'rent' })
  required.cash_operating = await findGlIdByName(supabase, { like: 'operat' })
  required.tenant_deposit_liability = await findGlIdByName(supabase, { exact: DEPOSIT_LIAB_NAME, like: 'deposit' })
  // Optional/best-effort
  const late_fee_income = await findGlIdByName(supabase, 'late fee')
  const write_off = await findGlIdByName(supabase, 'bad debt')
  const cash_trust = await findGlIdByName(supabase, 'trust')

  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    console.warn(`Org ${orgId}: missing GL mapping for ${missing.join(', ')}. Skipping.`)
    return false
  }

  const payload = {
    org_id: orgId,
    ar_lease: required.ar_lease!,
    rent_income: required.rent_income!,
    cash_operating: required.cash_operating!,
    tenant_deposit_liability: required.tenant_deposit_liability!,
    late_fee_income: late_fee_income || null,
    write_off: write_off || null,
    cash_trust: cash_trust || null,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase.from('settings_gl_accounts').select('org_id').eq('org_id', orgId).maybeSingle()
  if (existing?.org_id) {
    const { error } = await supabase.from('settings_gl_accounts').update(payload).eq('org_id', orgId)
    if (error) throw error
    console.log(`Updated GL settings for org ${orgId}`)
  } else {
    const { error } = await supabase.from('settings_gl_accounts').insert(payload)
    if (error) throw error
    console.log(`Inserted GL settings for org ${orgId}`)
  }
  return true
}

async function main() {
  const supabase = getAdmin()
  const targetOrg = process.env.ORG_ID
  const orgsList = targetOrg ? [{ id: targetOrg }] : ((await supabase.from('organizations').select('id')).data || [])
  let ok = 0
  for (const o of orgsList) {
    try {
      const res = await upsertForOrg(supabase, o.id)
      if (res) ok += 1
    } catch (e: any) {
      console.warn(`Failed seeding GL settings for ${o.id}:`, e?.message || e)
    }
  }
  console.log(`GL settings: processed ${orgsList.length}, upserted ${ok}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
