import { describe, expect, it } from 'vitest';

import { resolveTransactionCreateSuffix, ensureDateField } from '@/lib/lease-transaction-service';
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium';

describe('resolveTransactionCreateSuffix', () => {
  it('maps known transaction types to their v1 endpoints', () => {
    expect(resolveTransactionCreateSuffix({ TransactionType: 'Payment' } as any)).toBe('/payments');
    expect(resolveTransactionCreateSuffix({ TransactionType: 'Charge' } as any)).toBe('/charges');
    expect(resolveTransactionCreateSuffix({ TransactionType: 'Credit' } as any)).toBe('/credits');
    expect(resolveTransactionCreateSuffix({ TransactionType: 'Refund' } as any)).toBe('/refunds');
    expect(resolveTransactionCreateSuffix({ TransactionType: 'ApplyDeposit' } as any)).toBe(
      '/applydeposit',
    );
  });

  it('falls back to legacy transactions endpoint for unknown types', () => {
    expect(resolveTransactionCreateSuffix({ TransactionType: 'Misc' } as any)).toBe('/transactions');
    expect(resolveTransactionCreateSuffix({} as any)).toBe('/transactions');
  });
});

describe('ensureDateField', () => {
  it('copies TransactionDate into Date when missing', () => {
    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Payment',
      TransactionDate: '2025-10-05',
      Amount: 100,
      Lines: [],
    };
    const result = ensureDateField(payload);
    expect(result.Date).toBe('2025-10-05');
    expect(result.TransactionDate).toBe('2025-10-05');
  });

  it('preserves existing Date field', () => {
    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Payment',
      TransactionDate: '2025-10-05',
      Date: '2025-10-01',
      Amount: 100,
      Lines: [],
    } as any;
    const result = ensureDateField(payload);
    expect(result.Date).toBe('2025-10-01');
  });
});
