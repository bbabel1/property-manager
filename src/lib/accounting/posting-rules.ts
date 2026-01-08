import { logger } from '@/lib/logger';
import type { OrgGlSettings } from '@/lib/gl-settings';
import type { TypedSupabaseClient } from '@/lib/db';
import type { Database } from '@/types/database';
import type {
  BankTransferEventData,
  CustomLinesEventData,
  DepositEventData,
  LeaseContext,
  OwnerDistributionEventData,
  PostingEvent,
  PostingLine,
  PostingEventType,
  RentChargeEventData,
  ReversalEventData,
  TenantPaymentEventData,
  VendorBillEventData,
} from './posting-events';

export type PostingRuleContext = {
  event: PostingEvent
  glSettings: OrgGlSettings
  leaseContext?: LeaseContext
  scope: { propertyId?: string | null; unitId?: string | null }
  db: TypedSupabaseClient
}

export type PostingRuleResult = {
  lines: PostingLine[]
  headerOverrides?: Partial<Database['public']['Tables']['transactions']['Insert']>
}

export type PostingRule = {
  eventType: PostingEventType
  generateLines: (ctx: PostingRuleContext) => Promise<PostingRuleResult>
  validate?: (event: PostingEvent, glSettings: OrgGlSettings) => Promise<void>
}

const ensureAmount = (raw: number | undefined | null, eventType: PostingEventType) => {
  const amt = Number(raw)
  if (!Number.isFinite(amt) || amt === 0) {
    throw new Error(`Posting rule ${eventType} requires a non-zero amount`)
  }
  return Math.abs(amt)
}

const computeHeaderAmount = (lines: PostingLine[], fallback?: number) => {
  const debitTotal = lines
    .filter((l) => l.posting_type === 'Debit')
    .reduce((sum, l) => sum + Number(l.amount || 0), 0)
  if (debitTotal > 0) return debitTotal

  const creditTotal = lines
    .filter((l) => l.posting_type === 'Credit')
    .reduce((sum, l) => sum + Number(l.amount || 0), 0)
  if (creditTotal > 0) return creditTotal

  const safeFallback = Number(fallback ?? 0)
  return Number.isFinite(safeFallback) ? Math.abs(safeFallback) : 0
}

const rentChargeRule: PostingRule = {
  eventType: 'rent_charge',
  generateLines: async ({ event, glSettings, scope, leaseContext }) => {
    const data = event.eventData as RentChargeEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'rent_charge')
    const memo = data?.memo
    const debitAccount = data?.debitGlAccountId ?? glSettings.ar_lease
    const creditAccount = data?.creditGlAccountId ?? glSettings.rent_income
    const property_id = data?.propertyId ?? scope.propertyId ?? null
    const unit_id = data?.unitId ?? scope.unitId ?? null

    const lines: PostingLine[] = [
      {
        gl_account_id: debitAccount,
        amount,
        posting_type: 'Debit',
        memo,
        property_id,
        unit_id,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
      },
      {
        gl_account_id: creditAccount,
        amount,
        posting_type: 'Credit',
        memo,
        property_id,
        unit_id,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
      },
    ]

    return {
      lines,
      headerOverrides: {
        transaction_type: 'Charge',
        memo,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        buildium_lease_id: data?.buildiumLeaseId ?? leaseContext?.buildium_lease_id ?? null,
        property_id,
        unit_id,
        total_amount: amount,
      },
    }
  },
}

const recurringChargeRule: PostingRule = {
  eventType: 'recurring_charge',
  generateLines: rentChargeRule.generateLines,
}

const lateFeeRule: PostingRule = {
  eventType: 'late_fee',
  generateLines: async ({ event, glSettings, scope, leaseContext }) => {
    const data = event.eventData as RentChargeEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'late_fee')
    const memo = data?.memo ?? 'Late fee'
    const incomeAccount = glSettings.late_fee_income || glSettings.rent_income
    const property_id = data?.propertyId ?? scope.propertyId ?? null
    const unit_id = data?.unitId ?? scope.unitId ?? null

    return {
      lines: [
        {
          gl_account_id: glSettings.ar_lease,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
        {
          gl_account_id: incomeAccount,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
      ],
      headerOverrides: {
        transaction_type: 'Charge',
        memo,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        property_id,
        unit_id,
        total_amount: amount,
      },
    }
  },
}

const tenantPaymentRule: PostingRule = {
  eventType: 'tenant_payment',
  generateLines: async ({ event, glSettings, scope, leaseContext }) => {
    const data = event.eventData as TenantPaymentEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'tenant_payment')
    const useUndeposited = data.useUndepositedFunds ?? false
    const bankGlAccountId = useUndeposited
      ? glSettings.undeposited_funds_account_id ?? null
      : data.bankGlAccountId ?? glSettings.cash_operating
    if (!bankGlAccountId) throw new Error('tenant_payment requires bankGlAccountId or undeposited funds account')
    const memo = data?.memo
    const property_id = scope.propertyId ?? null
    const unit_id = scope.unitId ?? null

    return {
      lines: [
        {
          gl_account_id: data.bankGlAccountId,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
        {
          gl_account_id: glSettings.ar_lease,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
      ],
      headerOverrides: {
        transaction_type: 'Payment',
        memo,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        property_id,
        unit_id,
        metadata: {
          payment_id: event.externalId ?? null,
        } as Database['public']['Tables']['transactions']['Insert']['metadata'],
      },
    }
  },
}

const depositRule: PostingRule = {
  eventType: 'deposit',
  generateLines: async ({ event, glSettings, scope, leaseContext }) => {
    const data = event.eventData as DepositEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'deposit')
    if (!data.bankGlAccountId) throw new Error('deposit requires bankGlAccountId')
    const memo = data?.memo ?? 'Security deposit'
    const property_id = scope.propertyId ?? null
    const unit_id = scope.unitId ?? null

    return {
      lines: [
        {
          gl_account_id: data.bankGlAccountId,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
        {
          gl_account_id: glSettings.tenant_deposit_liability,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
          lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        },
      ],
      headerOverrides: {
        transaction_type: 'Deposit',
        memo,
        lease_id: data?.leaseId ?? leaseContext?.lease_id ?? null,
        property_id,
        unit_id,
      },
    }
  },
}

const vendorBillRule: PostingRule = {
  eventType: 'vendor_bill',
  generateLines: async ({ event, scope }) => {
    const data = event.eventData as VendorBillEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'vendor_bill')
    if (!data.expenseGlAccountId) throw new Error('vendor_bill requires expenseGlAccountId')
    const memo = data?.memo ?? 'Vendor bill'
    const property_id = scope.propertyId ?? null
    const unit_id = scope.unitId ?? null
    const creditAccount = data.apGlAccountId || data.bankGlAccountId
    if (!creditAccount) throw new Error('vendor_bill requires apGlAccountId or bankGlAccountId')

    return {
      lines: [
        {
          gl_account_id: data.expenseGlAccountId,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
        },
        {
          gl_account_id: creditAccount,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
        },
      ],
      headerOverrides: {
        transaction_type: 'Bill',
        memo,
        property_id,
        unit_id,
      },
    }
  },
}

const ownerDistributionRule: PostingRule = {
  eventType: 'owner_distribution',
  generateLines: async ({ event, scope }) => {
    const data = event.eventData as OwnerDistributionEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'owner_distribution')
    if (!data.equityGlAccountId || !data.bankGlAccountId) {
      throw new Error('owner_distribution requires equityGlAccountId and bankGlAccountId')
    }
    const memo = data?.memo ?? 'Owner distribution'
    const property_id = scope.propertyId ?? null
    const unit_id = scope.unitId ?? null

    return {
      lines: [
        {
          gl_account_id: data.equityGlAccountId,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
        },
        {
          gl_account_id: data.bankGlAccountId,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
        },
      ],
      headerOverrides: {
        transaction_type: 'Other',
        memo,
        property_id,
        unit_id,
      },
    }
  },
}

const reversalRule: PostingRule = {
  eventType: 'reversal',
  generateLines: async ({ event, db }) => {
    const data = event.eventData as ReversalEventData
    const originalId = data.originalTransactionId
    if (!originalId) throw new Error('reversal requires originalTransactionId')

    const { data: lines, error } = await db
      .from('transaction_lines')
      .select('gl_account_id, amount, posting_type, memo, property_id, unit_id, lease_id')
      .eq('transaction_id', originalId)
    if (error) throw error
    if (!lines || lines.length === 0) throw new Error(`No lines found for transaction ${originalId}`)

    const reversed: PostingLine[] = lines.map((l) => ({
      gl_account_id: l.gl_account_id as string,
      amount: Number(l.amount || 0),
      posting_type: l.posting_type === 'Debit' ? 'Credit' : 'Debit',
      memo: data.memo || l.memo || 'Reversal',
      property_id: l.property_id,
      unit_id: l.unit_id,
      lease_id: l.lease_id ?? null,
    }))

    return {
      lines: reversed,
      headerOverrides: {
        transaction_type: 'GeneralJournalEntry',
        memo: data.memo || 'Reversal',
        reversal_of_transaction_id: originalId,
      },
    }
  },
}

const generalJournalRule: PostingRule = {
  eventType: 'general_journal_entry',
  generateLines: async ({ event }) => {
    const data = event.eventData as CustomLinesEventData
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      throw new Error('general_journal_entry requires lines')
    }
    return {
      lines: data.lines,
      headerOverrides: {
        transaction_type: data.transactionType ?? 'GeneralJournalEntry',
        memo: data.memo,
      },
    }
  },
}

const bankTransferRule: PostingRule = {
  eventType: 'bank_transfer',
  generateLines: async ({ event, scope }) => {
    const data = event.eventData as BankTransferEventData
    const amount = ensureAmount(data?.amount ?? event.businessAmount, 'bank_transfer')
    if (!data.fromBankGlAccountId || !data.toBankGlAccountId) {
      throw new Error('bank_transfer requires fromBankGlAccountId and toBankGlAccountId')
    }
    const memo = data?.memo ?? 'Bank transfer'
    const property_id = scope.propertyId ?? null
    const unit_id = scope.unitId ?? null

    return {
      lines: [
        {
          gl_account_id: data.toBankGlAccountId,
          amount,
          posting_type: 'Debit',
          memo,
          property_id,
          unit_id,
        },
        {
          gl_account_id: data.fromBankGlAccountId,
          amount,
          posting_type: 'Credit',
          memo,
          property_id,
          unit_id,
        },
      ],
      headerOverrides: {
        transaction_type: 'ElectronicFundsTransfer',
        memo,
        property_id,
        unit_id,
      },
    }
  },
}

const otherTransactionRule: PostingRule = {
  eventType: 'other_transaction',
  generateLines: async ({ event }) => {
    const data = event.eventData as CustomLinesEventData
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      throw new Error('other_transaction requires lines')
    }
    const totalAmount = computeHeaderAmount(data.lines, event.businessAmount)
    return {
      lines: data.lines,
      headerOverrides: {
        transaction_type: data.transactionType ?? 'Other',
        memo: data.memo,
        total_amount: totalAmount,
      },
    }
  },
}

export const postingRules: Record<PostingEventType, PostingRule> = {
  rent_charge: rentChargeRule,
  recurring_charge: recurringChargeRule,
  late_fee: lateFeeRule,
  tenant_payment: tenantPaymentRule,
  vendor_bill: vendorBillRule,
  deposit: depositRule,
  owner_distribution: ownerDistributionRule,
  reversal: reversalRule,
  general_journal_entry: generalJournalRule,
  bank_transfer: bankTransferRule,
  other_transaction: otherTransactionRule,
}

export function computeNetAmount(lines: PostingLine[]): number {
  return lines.reduce((sum, l) => {
    const amt = Number(l.amount || 0)
    if (!Number.isFinite(amt)) return sum
    return sum + (l.posting_type === 'Debit' ? amt : -amt)
  }, 0)
}

export function logRuleEvent(event: PostingEvent, transactionId: string) {
  try {
    logger.info({ eventType: event.eventType, transactionId, orgId: event.orgId }, 'PostingEngine posted')
  } catch {
    /* noop */
  }
}
