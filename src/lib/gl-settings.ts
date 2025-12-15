import { supabase as supa, supabaseAdmin, type TypedSupabaseClient } from '@/lib/db'

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
  const db: TypedSupabaseClient = supabaseAdmin || supa
  const { data, error } = await db
    .from('settings_gl_accounts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(`GL account settings missing for org ${orgId}`)
  }

  const settings: OrgGlSettings = {
    org_id: data.org_id,
    ar_lease: data.ar_lease,
    rent_income: data.rent_income,
    cash_operating: data.cash_operating,
    cash_trust: data.cash_trust,
    tenant_deposit_liability: data.tenant_deposit_liability,
    late_fee_income: data.late_fee_income,
    write_off: data.write_off,
  }

  for (const k of REQUIRED_KEYS) {
    if (!settings[k]) throw new Error(`GL setting ${k} missing for org ${orgId}`)
  }

  return settings
}
