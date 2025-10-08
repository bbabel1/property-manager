import type { Database } from '@/types/database'

export type OwnerDB = Database['public']['Tables']['owners']['Row']

export interface Owner {
  id: string
  contactId: number | null
  managementAgreementStartDate?: string | null
  managementAgreementEndDate?: string | null
  comment?: string | null
  etfAccountType?: string | null
  etfAccountNumber?: number | null
  etfRoutingNumber?: number | null
  createdAt: string
  updatedAt: string
}

export function mapOwnerFromDB(dbOwner: OwnerDB): Owner {
  return {
    id: dbOwner.id,
    contactId: dbOwner.contact_id ?? null,
    managementAgreementStartDate: dbOwner.management_agreement_start_date,
    managementAgreementEndDate: dbOwner.management_agreement_end_date,
    comment: dbOwner.comment,
    etfAccountType: dbOwner.etf_account_type,
    etfAccountNumber: dbOwner.etf_account_number,
    etfRoutingNumber: dbOwner.etf_routing_number,
    createdAt: dbOwner.created_at,
    updatedAt: dbOwner.updated_at,
  }
}
