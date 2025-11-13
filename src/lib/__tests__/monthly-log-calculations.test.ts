import { describe, expect, it } from 'vitest';

import { isEscrowTransactionLine } from '@/lib/monthly-log-calculations';

describe('isEscrowTransactionLine', () => {
  const baseLine = {
    amount: 100,
    posting_type: 'credit',
    unit_id: null,
    gl_accounts: {
      name: 'Primary Escrow',
      gl_account_category: { category: 'deposit' },
    },
  } as const;

  it('matches deposit category regardless of name', () => {
    const result = isEscrowTransactionLine(baseLine, null);
    expect(result).toBe(true);
  });

  it('matches tax escrow by name even without category', () => {
    const line = {
      ...baseLine,
      gl_accounts: {
        name: 'Property Tax Escrow',
        gl_account_category: { category: null },
      },
    };

    expect(isEscrowTransactionLine(line, null)).toBe(true);
  });

  it('requires unit match when unitId is provided', () => {
    const mismatched = {
      ...baseLine,
      unit_id: 'a-different-unit',
    };

    expect(isEscrowTransactionLine(mismatched, 'target-unit')).toBe(false);
  });

  it('accepts null unit lines when filtering by unit', () => {
    const withNullUnit = {
      ...baseLine,
      unit_id: null,
    };

    expect(isEscrowTransactionLine(withNullUnit, 'target-unit')).toBe(true);
  });

  it('rejects non-escrow accounts', () => {
    const nonEscrow = {
      ...baseLine,
      gl_accounts: {
        name: 'Operating Account',
        gl_account_category: { category: 'operating' },
      },
    };

    expect(isEscrowTransactionLine(nonEscrow, null)).toBe(false);
  });
});

