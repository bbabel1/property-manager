import type { Database } from '@/types/database'

type BankAccountRow = Database['public']['Tables']['bank_accounts']['Row']

export type BankAccountSummary = Pick<
  BankAccountRow,
  | 'id'
  | 'name'
  | 'description'
  | 'bank_account_type'
  | 'account_number'
  | 'routing_number'
  | 'is_active'
  | 'country'
  | 'created_at'
  | 'updated_at'
>

export type CreateBankAccountFormValues = {
  name: string
  description: string
  bank_account_type: string
  account_number: string
  routing_number: string
  country: string
}

export type BankingDetailsFormValues = {
  reserve: number
  operating_bank_account_id: string
  deposit_trust_account_id: string
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
