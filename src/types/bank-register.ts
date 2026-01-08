export type BankEntryStatus = 'uncleared' | 'cleared' | 'reconciled'

export const BANK_ENTRY_STATUSES: BankEntryStatus[] = ['uncleared', 'cleared', 'reconciled']

export interface BankRegisterState {
  orgId: string
  bankGlAccountId: string
  transactionId: string
  buildiumTransactionId?: number | null
  status: BankEntryStatus
  currentReconciliationLogId?: string | null
  clearedAt?: string | null
  clearedByUserId?: string | null
  reconciledAt?: string | null
  reconciledByUserId?: string | null
  createdAt: string
  updatedAt: string
}
