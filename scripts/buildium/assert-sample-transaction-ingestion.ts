#!/usr/bin/env tsx

import { z } from 'zod'

import {
  extractLeaseTransactionLineMetadataFromBuildiumLine,
  mapDepositPaymentSplitsFromBuildium,
  mapLeaseTransactionFromBuildium,
} from '@/lib/buildium-mappers'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const HeaderSchema = z.object({
  payee_name: z.string().nullable().optional(),
  payee_buildium_id: z.number().nullable().optional(),
  payee_buildium_type: z.string().nullable().optional(),
  is_internal_transaction: z.boolean().nullable().optional(),
  internal_transaction_is_pending: z.boolean().nullable().optional(),
  internal_transaction_result_date: z.string().nullable().optional(),
  internal_transaction_result_code: z.string().nullable().optional(),
  bank_gl_account_buildium_id: z.number().nullable().optional(),
  buildium_unit_id: z.number().nullable().optional(),
  buildium_unit_number: z.string().nullable().optional(),
  unit_agreement_id: z.number().nullable().optional(),
  unit_agreement_type: z.string().nullable().optional(),
  unit_agreement_href: z.string().nullable().optional(),
  payment_method_raw: z.string().nullable().optional(),
})

const SplitSchema = z.object({
  transaction_id: z.string(),
  buildium_payment_transaction_id: z.number().nullable().optional(),
  accounting_entity_id: z.number().nullable().optional(),
  accounting_entity_type: z.string().nullable().optional(),
  accounting_entity_href: z.string().nullable().optional(),
  accounting_unit_id: z.number().nullable().optional(),
  accounting_unit_href: z.string().nullable().optional(),
  amount: z.any().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

async function main() {
  const nowIso = new Date('2026-04-02T12:00:00.000Z').toISOString()

  // Minimal representative Buildium payload covering:
  // - PaymentDetail
  // - DepositDetails (BankGLAccountId + PaymentTransactions)
  // - Line metadata (ReferenceNumber, IsCashPosting, AccountingEntityType)
  const sampleTx: any = {
    Id: 974788,
    Date: '2025-12-18',
    LeaseId: 18615,
    TransactionTypeEnum: 'Payment',
    TotalAmount: 5000,
    UnitId: 2222,
    UnitNumber: '1A',
    LastUpdatedDateTime: '2025-12-18T10:20:30Z',
    Application: { Id: 3333 },
    UnitAgreement: { Id: 4444, Type: 'Lease', Href: 'https://example.invalid/ua/4444' },
    PaymentDetail: {
      PaymentMethod: 'Check',
      Payee: { Id: 9991, Type: 'Vendor', Name: 'Acme Plumbing', Href: 'https://example.invalid/payee/9991' },
      IsInternalTransaction: true,
      InternalTransactionStatus: { IsPending: true, ResultDate: '2025-12-18', ResultCode: 'PENDING' },
    },
    DepositDetails: {
      BankGLAccountId: 7777,
      PaymentTransactions: [
        {
          Id: 5555,
          Amount: 5000,
          AccountingEntity: {
            Id: 8888,
            AccountingEntityType: 'Rental',
            Href: 'https://example.invalid/rental/8888',
            Unit: { Id: 2222, Href: 'https://example.invalid/unit/2222' },
          },
        },
      ],
    },
    Lines: [
      {
        Amount: 5000,
        PostingType: 'Debit',
        Memo: 'Tenant payment',
        GLAccountId: 2,
        ReferenceNumber: 'RCPT-123',
        IsCashPosting: true,
        AccountingEntity: { AccountingEntityType: 'Rental' },
      },
    ],
  }

  const header = mapLeaseTransactionFromBuildium(sampleTx)
  const parsedHeader = HeaderSchema.parse(header)

  assert(parsedHeader.payee_name === 'Acme Plumbing', 'Expected payee_name to map from PaymentDetail.Payee.Name')
  assert(parsedHeader.payee_buildium_id === 9991, 'Expected payee_buildium_id to map from PaymentDetail.Payee.Id')
  assert(parsedHeader.is_internal_transaction === true, 'Expected is_internal_transaction=true')
  assert(parsedHeader.internal_transaction_is_pending === true, 'Expected internal_transaction_is_pending=true')
  assert(parsedHeader.bank_gl_account_buildium_id === 7777, 'Expected bank_gl_account_buildium_id from DepositDetails.BankGLAccountId')
  assert(parsedHeader.buildium_unit_id === 2222, 'Expected buildium_unit_id from UnitId/Unit.Id')
  assert(parsedHeader.buildium_unit_number === '1A', 'Expected buildium_unit_number from UnitNumber')
  assert(parsedHeader.payment_method_raw === 'Check', 'Expected payment_method_raw from PaymentDetail.PaymentMethod')

  const meta = extractLeaseTransactionLineMetadataFromBuildiumLine(sampleTx.Lines[0])
  assert(meta.reference_number === 'RCPT-123', 'Expected line reference_number from ReferenceNumber')
  assert(meta.is_cash_posting === true, 'Expected line is_cash_posting=true from IsCashPosting')
  assert(meta.accounting_entity_type_raw === 'Rental', 'Expected accounting_entity_type_raw from AccountingEntity.AccountingEntityType')

  const transactionId = '00000000-0000-0000-0000-000000000001'
  const splits = mapDepositPaymentSplitsFromBuildium(sampleTx, { transactionId, nowIso })
  assert(splits.length === 1, 'Expected exactly one mapped split')
  const split = SplitSchema.parse(splits[0])

  assert(split.transaction_id === transactionId, 'Expected split.transaction_id to match provided transactionId')
  assert(split.buildium_payment_transaction_id === 5555, 'Expected split buildium_payment_transaction_id from PaymentTransactions[].Id')
  assert(split.accounting_entity_id === 8888, 'Expected split accounting_entity_id from AccountingEntity.Id')
  assert(split.accounting_entity_type === 'Rental', 'Expected split accounting_entity_type from AccountingEntity.AccountingEntityType')
  assert(split.accounting_unit_id === 2222, 'Expected split accounting_unit_id from AccountingEntity.Unit.Id')

  console.log('✅ Sample Buildium Payment/Deposit mapping assertion passed (header, line metadata, splits).')
}

main().catch((err) => {
  console.error('❌ Sample Buildium mapping assertion failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})


