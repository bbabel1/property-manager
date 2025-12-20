import { describe, expect, it } from 'vitest';

import { buildLedgerGroups, type LedgerLine } from '@/server/financials/ledger-utils';

const makeLine = (overrides: Partial<LedgerLine> = {}): LedgerLine => ({
  id: 'line-1',
  date: '2025-12-18',
  amount: 5000,
  postingType: 'Credit',
  memo: null,
  createdAt: '2025-12-18T00:00:00Z',
  propertyId: 'prop-1',
  propertyLabel: 'Property',
  unitId: 'unit-1',
  unitLabel: '10J',
  glAccountId: 'gl-income',
  glAccountName: 'Rent Income',
  glAccountNumber: '4000',
  glAccountType: 'income',
  glIsBankAccount: false,
  glExcludeFromCash: false,
  transactionId: 'tx-1',
  transactionType: 'Payment',
  transactionMemo: null,
  transactionReference: null,
  ...overrides,
});

describe('buildLedgerGroups', () => {
  it('drops payment lines that hit income accounts on accrual basis', () => {
    const paymentToIncome = makeLine({ id: 'payment-income' });
    const chargeToIncome = makeLine({
      id: 'charge-income',
      transactionType: 'Charge',
      createdAt: '2025-12-17T00:00:00Z',
    });
    const paymentToBank = makeLine({
      id: 'payment-bank',
      glAccountId: 'bank-1',
      glAccountName: 'Operating Bank',
      glAccountType: 'asset',
      postingType: 'Debit',
      glIsBankAccount: true,
    });

    const groups = buildLedgerGroups([], [paymentToIncome, chargeToIncome, paymentToBank], {
      basis: 'accrual',
    });

    const rentIncomeGroup = groups.find((group) => group.id === 'gl-income');
    expect(rentIncomeGroup?.lines.map(({ line }) => line.id)).toEqual(['charge-income']);
    expect(rentIncomeGroup?.net).toBe(5000);

    const bankGroup = groups.find((group) => group.id === 'bank-1');
    expect(bankGroup?.lines.map(({ line }) => line.id)).toEqual(['payment-bank']);
    expect(bankGroup?.net).toBe(5000);
  });

  it('keeps payment lines to income accounts on cash basis', () => {
    const txId = 'tx-cash';
    const incomeLine = makeLine({ id: 'income', transactionId: txId });
    const bankLine = makeLine({
      id: 'bank',
      transactionId: txId,
      glAccountId: 'bank-1',
      glAccountName: 'Operating Bank',
      glAccountType: 'asset',
      postingType: 'Debit',
      glIsBankAccount: true,
    });
    const unpaidIncome = makeLine({
      id: 'unpaid-income',
      transactionId: 'tx-unpaid',
      glAccountName: 'Rent Income',
      glAccountType: 'income',
    });

    const groups = buildLedgerGroups([], [incomeLine, bankLine, unpaidIncome], { basis: 'cash' });

    const rentIncomeGroup = groups.find((group) => group.id === 'gl-income');
    expect(rentIncomeGroup?.lines.map(({ line }) => line.id)).toEqual(['income']);
    expect(rentIncomeGroup?.net).toBe(5000);

    const bankGroup = groups.find((group) => group.id === 'bank-1');
    expect(bankGroup?.lines.map(({ line }) => line.id)).toEqual(['bank']);
  });
});
