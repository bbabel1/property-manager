import { supabase as supa, supabaseAdmin } from '@/lib/db'

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
  const db = supabaseAdmin || supa
  const { data, error } = await db
    .from('settings_gl_accounts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(`GL account settings missing for org ${orgId}`)
  }
  for (const k of REQUIRED_KEYS) {
    if (!data[k]) throw new Error(`GL setting ${k} missing for org ${orgId}`)
  }
  return data as OrgGlSettings
}

