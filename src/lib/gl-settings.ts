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
  undeposited_funds_account_id?: string | null
}

export type OrgControlAccounts = {
  org_id: string
  ar_account_id: string
  rent_income_account_id: string
  late_fee_income_account_id: string | null
  undeposited_funds_account_id: string | null
}

const REQUIRED_KEYS: (keyof OrgGlSettings)[] = [
  'org_id',
  'ar_lease',
  'rent_income',
  'cash_operating',
  'tenant_deposit_liability',
]

const EXPECTED_ACCOUNT_TYPES = {
  ar: 'asset',
  income: 'income',
  undeposited: 'asset',
} as const

async function validateAccountType(
  db: SupabaseClient,
  accountId: string | null | undefined,
  label: string,
  expectedType: string,
) {
  if (!accountId) {
    throw new Error(`Missing ${label} control account`)
  }
  const { data, error } = await db
    .from('gl_accounts')
    .select('id, type, sub_type, name')
    .eq('id', accountId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(`Control account ${label} not found: ${accountId}`)
  }
  const type = (data.type ?? '').toLowerCase()
  if (type !== expectedType.toLowerCase()) {
    throw new Error(`Control account ${label} (${data.name ?? accountId}) must be type ${expectedType}`)
  }
}

export async function getOrgControlAccountsOrThrow(orgId: string): Promise<OrgControlAccounts> {
  const db: SupabaseClient = (supabaseAdmin || supa) as unknown as SupabaseClient
  const { data, error } = await db
    .from('org_control_accounts')
    .select(
      'org_id, ar_account_id, rent_income_account_id, late_fee_income_account_id, undeposited_funds_account_id'
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(`Control accounts missing for org ${orgId}`)
  }

  await validateAccountType(db, data.ar_account_id, 'AR', EXPECTED_ACCOUNT_TYPES.ar)
  await validateAccountType(db, data.rent_income_account_id, 'rent income', EXPECTED_ACCOUNT_TYPES.income)
  if (data.late_fee_income_account_id) {
    await validateAccountType(db, data.late_fee_income_account_id, 'late fee income', EXPECTED_ACCOUNT_TYPES.income)
  }
  if (data.undeposited_funds_account_id) {
    await validateAccountType(db, data.undeposited_funds_account_id, 'undeposited funds', EXPECTED_ACCOUNT_TYPES.undeposited)
  }

  return {
    org_id: data.org_id,
    ar_account_id: data.ar_account_id,
    rent_income_account_id: data.rent_income_account_id,
    late_fee_income_account_id: data.late_fee_income_account_id,
    undeposited_funds_account_id: data.undeposited_funds_account_id,
  }
}

export async function getOrgGlSettingsOrThrow(orgId: string): Promise<OrgGlSettings> {
  const db: SupabaseClient = (supabaseAdmin || supa) as unknown as SupabaseClient
  const control = await getOrgControlAccountsOrThrow(orgId).catch(() => null)

  const { data, error } = await db
    .from('settings_gl_accounts')
    .select(
      `
      org_id,
      ar_lease,
      rent_income,
      cash_operating,
      cash_trust,
      tenant_deposit_liability,
      late_fee_income,
      write_off
    `,
    )
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  const typedData = data as OrgGlSettings | null
  if (!typedData) {
    throw new Error(`GL account settings missing for org ${orgId}`)
  }

  if (!control) {
    console.warn(`[gl-settings] Control accounts missing for org ${orgId}, falling back to settings_gl_accounts`)
  }

  const settings: OrgGlSettings = {
    org_id: typedData.org_id,
    ar_lease: control?.ar_account_id ?? typedData.ar_lease,
    rent_income: control?.rent_income_account_id ?? typedData.rent_income,
    cash_operating: typedData.cash_operating,
    cash_trust: typedData.cash_trust,
    tenant_deposit_liability: typedData.tenant_deposit_liability,
    late_fee_income: control?.late_fee_income_account_id ?? typedData.late_fee_income,
    write_off: typedData.write_off,
    undeposited_funds_account_id: control?.undeposited_funds_account_id ?? null,
  }

  for (const k of REQUIRED_KEYS) {
    if (!settings[k]) throw new Error(`GL setting ${k} missing for org ${orgId}`)
  }

  return settings
}
