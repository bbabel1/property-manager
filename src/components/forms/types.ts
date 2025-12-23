import type { Database, Json } from '@/types/database'
type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row']

export type BankAccountSummary = {
  id: GlAccountRow['id']
  name: GlAccountRow['name']
  description: GlAccountRow['description']
  bank_account_type: GlAccountRow['bank_account_type']
  account_number: GlAccountRow['bank_account_number']
  routing_number: GlAccountRow['bank_routing_number']
  is_active: GlAccountRow['is_active']
  country: GlAccountRow['bank_country']
  created_at: GlAccountRow['created_at']
  updated_at: GlAccountRow['updated_at']
}

export type BankGlAccountSummary = Pick<
  GlAccountRow,
  | 'id'
  | 'name'
  | 'description'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
> & {
  bank_account_type?: Database['public']['Enums']['bank_account_type_enum'] | null
  account_number?: string | null
  routing_number?: string | null
  country?: Database['public']['Enums']['countries'] | null
  buildium_gl_account_id?: number | null
  bank_balance?: number | null
  bank_buildium_balance?: number | null
  bank_check_printing_info?: Json | null
  bank_electronic_payments?: Json | null
}

export type CreateBankAccountFormValues = {
  name: string
  description: string
  bank_account_type: string
  account_number: string
  routing_number: string
  country: string
  bank_information_lines: string[]
  company_information_lines: string[]
}

export type BankAccountFormValues = CreateBankAccountFormValues

export type BankingDetailsFormValues = {
  reserve: number
  operating_bank_gl_account_id: string
  deposit_trust_gl_account_id: string
}

export type CreateStaffFormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
}

export type StaffSummary = {
  id: number
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  role: string
  is_active: boolean
  displayName?: string
}
