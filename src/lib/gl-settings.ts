import { supabase as supa, supabaseAdmin } from '@/lib/db'
import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgGlSettings = {
  org_id: string
  ar_lease: string
  rent_income: string
  cash_operating: string
  cash_trust: string | null
  tenant_deposit_liability: string
  late_fee_income: string | null
  write_off: string | null
}

const REQUIRED_KEYS: (keyof OrgGlSettings)[] = [
  'org_id',
  'ar_lease',
  'rent_income',
  'cash_operating',
  'tenant_deposit_liability',
]

export async function getOrgGlSettingsOrThrow(orgId: string): Promise<OrgGlSettings> {
  const db: SupabaseClient = (supabaseAdmin || supa) as unknown as SupabaseClient
  const { data, error } = await db
    .from('settings_gl_accounts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  const typedData = data as OrgGlSettings | null
  if (!typedData) {
    throw new Error(`GL account settings missing for org ${orgId}`)
  }

  const settings: OrgGlSettings = {
    org_id: typedData.org_id,
    ar_lease: typedData.ar_lease,
    rent_income: typedData.rent_income,
    cash_operating: typedData.cash_operating,
    cash_trust: typedData.cash_trust,
    tenant_deposit_liability: typedData.tenant_deposit_liability,
    late_fee_income: typedData.late_fee_income,
    write_off: typedData.write_off,
  }

  for (const k of REQUIRED_KEYS) {
    if (!settings[k]) throw new Error(`GL setting ${k} missing for org ${orgId}`)
  }

  return settings
}
