export type DepositStatus = 'posted' | 'reconciled' | 'voided'
export const DEPOSIT_STATUSES: DepositStatus[] = ['posted', 'reconciled', 'voided']

export type DepositBuildiumSyncStatus = 'pending' | 'synced' | 'failed'
export const DEPOSIT_BUILDIUM_SYNC_STATUSES: DepositBuildiumSyncStatus[] = ['pending', 'synced', 'failed']

export interface DepositMeta {
  id: string
  transactionId: string
  orgId: string
  depositId: string
  status: DepositStatus
  buildiumDepositId?: number | null
  buildiumSyncStatus: DepositBuildiumSyncStatus
  buildiumSyncError?: string | null
  buildiumLastSyncedAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface DepositItem {
  id: string
  depositTransactionId: string
  paymentTransactionId: string
  buildiumPaymentTransactionId?: number | null
  amount: number
  createdAt: string
  updatedAt: string
}
