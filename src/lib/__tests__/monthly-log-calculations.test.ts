import { describe, expect, it } from 'vitest';

import { __test__, isEscrowTransactionLine } from '@/lib/monthly-log-calculations';

const { shouldExcludeBillTransaction } = __test__;

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

describe('shouldExcludeBillTransaction', () => {
  const buildLine = (name: string | null, defaultName?: string | null) => ({
    amount: 100,
    gl_accounts: {
      name,
      default_account_name: defaultName ?? null,
    },
  });

  const buildTransaction = (lines: Array<ReturnType<typeof buildLine>>) => ({
    id: 'txn',
    total_amount: 100,
    transaction_type: 'Bill',
    transaction_lines: lines,
  });

  it('excludes management fee bills', () => {
    const transaction = buildTransaction([buildLine('Management Fees')]);
    expect(shouldExcludeBillTransaction(transaction)).toBe(true);
  });

  it('excludes property tax bills by account name', () => {
    const transaction = buildTransaction([buildLine('Property Tax')]);
    expect(shouldExcludeBillTransaction(transaction)).toBe(true);
  });

  it('excludes property tax bills by default account name', () => {
    const transaction = buildTransaction([buildLine(null, 'Property Tax')]);
    expect(shouldExcludeBillTransaction(transaction)).toBe(true);
  });

  it('does not exclude other bill accounts', () => {
    const transaction = buildTransaction([buildLine('Legal and Professional Fees')]);
    expect(shouldExcludeBillTransaction(transaction)).toBe(false);
  });
});
