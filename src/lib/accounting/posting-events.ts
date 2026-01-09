import type { Database } from '@/types/database'

export type PostingEventType =
  | 'rent_charge'
  | 'tenant_payment'
  | 'vendor_bill'
  | 'deposit'
  | 'owner_distribution'
  | 'reversal'
  | 'general_journal_entry'
  | 'recurring_charge'
  | 'late_fee'
  | 'bank_transfer'
  | 'other_transaction'
  | 'nsf_fee';

export type PostingLine = {
  gl_account_id: string
  amount: number
  posting_type: 'Debit' | 'Credit'
  memo?: string
  property_id?: string | null
  unit_id?: string | null
  lease_id?: number | null
}

export type RentChargeEventData = {
  amount: number
  memo?: string
  leaseId?: number | null
  propertyId?: string | null
  unitId?: string | null
  buildiumLeaseId?: number | null
  debitGlAccountId?: string
  creditGlAccountId?: string
}

export type TenantPaymentEventData = {
  amount: number
  memo?: string
  leaseId?: number | null
  bankGlAccountId?: string
  useUndepositedFunds?: boolean
}

export type VendorBillEventData = {
  amount: number
  memo?: string
  expenseGlAccountId: string
  apGlAccountId?: string
  bankGlAccountId?: string
}

export type DepositEventData = {
  amount: number
  memo?: string
  bankGlAccountId: string
  leaseId?: number | null
}

export type OwnerDistributionEventData = {
  amount: number
  memo?: string
  equityGlAccountId: string
  bankGlAccountId: string
}

export type ReversalEventData = {
  originalTransactionId: string
  memo?: string
}

export type BankTransferEventData = {
  amount: number
  memo?: string
  fromBankGlAccountId: string
  toBankGlAccountId: string
}

export type CustomLinesEventData = {
  memo?: string
  transactionType?: Database['public']['Enums']['transaction_type_enum'] | null
  lines: PostingLine[]
}

export type PostingEventData =
  | RentChargeEventData
  | TenantPaymentEventData
  | VendorBillEventData
  | DepositEventData
  | OwnerDistributionEventData
  | ReversalEventData
  | BankTransferEventData
  | CustomLinesEventData

export type PostingMetadataHints = {
  chargeId?: string | null
  paymentId?: string | null
  reversalOfPaymentId?: string | null
  nsfFee?: boolean
  allocations?: unknown
}

export type LeaseContext = {
  lease_id?: number | null
  org_id?: string | null
  property_id?: string | null
  unit_id?: string | null
  buildium_property_id?: number | null
  buildium_unit_id?: number | null
  buildium_lease_id?: number | null
}

export interface PostingEvent {
  eventType: PostingEventType
  eventData: PostingEventData
  orgId: string
  propertyId?: string | null
  unitId?: string | null
  accountEntityType?: 'Company' | 'Rental'
  accountEntityId?: number | null
  postingDate: string
  createdAt?: string
  externalId?: string
  idempotencyKey?: string
  businessAmount?: number
  primaryGlAccountId?: string
  metadata?: PostingMetadataHints
}
