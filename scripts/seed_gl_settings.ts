#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase URL or service role key')
  return createClient(url, key)
}

async function findGlIdByName(supabase: any, nameLike: string) {
  const { data } = await supabase.from('gl_accounts').select('id, name').ilike('name', `%${nameLike}%`).limit(1)
  return data?.[0]?.id as string | undefined
}

async function upsertForOrg(supabase: any, orgId: string) {
  const required: Record<string, string | undefined> = {}
  required.ar_lease = await findGlIdByName(supabase, 'receivable')
  required.rent_income = await findGlIdByName(supabase, 'rent')
  required.cash_operating = await findGlIdByName(supabase, 'operat')
  required.tenant_deposit_liability = await findGlIdByName(supabase, 'deposit')
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
  const { data: orgs, error } = await supabase.from('organizations').select('id')
  if (error) throw error
  let ok = 0
  for (const o of orgs || []) {
    try {
      const res = await upsertForOrg(supabase, o.id)
      if (res) ok += 1
    } catch (e: any) {
      console.warn(`Failed seeding GL settings for ${o.id}:`, e?.message || e)
    }
  }
  console.log(`GL settings: processed ${orgs?.length || 0}, upserted ${ok}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

