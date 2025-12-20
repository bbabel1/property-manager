import { describe, expect, it } from 'vitest';

import {
  mapGLEntryHeaderFromBuildium,
  mapLeaseTransactionFromBuildium,
  mapPaymentMethodToEnum,
} from '../buildium-mappers';

describe('mapLeaseTransactionFromBuildium', () => {
  it('normalizes dates, amounts, and payment method', () => {
    const tx = mapLeaseTransactionFromBuildium({
      Id: 42,
      Date: '2024-05-15T10:00:00Z',
      TransactionTypeEnum: 'Payment',
      TotalAmount: 1250.55,
      CheckNumber: 'CHK-9',
      LeaseId: 77,
      PayeeTenantId: 88,
      PaymentMethod: 'ach',
      Memo: 'Paid online',
    });

    expect(tx).toMatchObject({
      buildium_transaction_id: 42,
      date: '2024-05-15',
      transaction_type: 'Payment',
      total_amount: 1250.55,
      check_number: 'CHK-9',
      buildium_lease_id: 77,
      payee_tenant_id: 88,
      payment_method: 'DirectDeposit',
      memo: 'Paid online',
    });
  });

  it('falls back across date fields and handles amount/coercion', () => {
    const tx = mapLeaseTransactionFromBuildium({
      TransactionDate: '2024-01-02',
      Amount: 500,
      PaymentMethod: 'credit card',
      Journal: { Memo: 'Journal memo wins', Lines: [] },
    });

    expect(tx.date).toBe('2024-01-02');
    expect(tx.total_amount).toBe(500);
    expect(tx.payment_method).toBe('CreditCard');
    expect(tx.memo).toBe('Journal memo wins');
  });
});

describe('mapGLEntryHeaderFromBuildium', () => {
  it('calculates totals from provided TotalAmount and parses ids', () => {
    const header = mapGLEntryHeaderFromBuildium({
      Id: '123',
      Date: '2024-08-01T00:00:00Z',
      TotalAmount: 300,
      CheckNumber: 'A1',
      Memo: 'GL entry memo',
    });

    expect(header).toMatchObject({
      buildium_transaction_id: 123,
      date: '2024-08-01',
      total_amount: 300,
      check_number: 'A1',
      memo: 'GL entry memo',
      transaction_type: 'JournalEntry',
    });
    expect(typeof header.updated_at).toBe('string');
  });

  it('sums absolute line amounts when TotalAmount missing', () => {
    const header = mapGLEntryHeaderFromBuildium({
      Id: 55,
      Date: '2024-02-10',
      Lines: [
        { Amount: -100.5 },
        { Amount: 50 },
        { Amount: '25' }, // coerced to number
      ],
    });

    expect(header.total_amount).toBe(175.5);
  });
});

describe('mapPaymentMethodToEnum', () => {
  it('normalizes common variants', () => {
    expect(mapPaymentMethodToEnum('ACH')).toBe('DirectDeposit');
    expect(mapPaymentMethodToEnum('cashier check')).toBe('CashierCheck');
    expect(mapPaymentMethodToEnum('online payment')).toBe('ElectronicPayment');
  });
});
