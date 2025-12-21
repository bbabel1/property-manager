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

  it('treats Undeposited Funds as cash for income recognition on cash basis', () => {
    const txId = 'tx-undeposited';
    const incomeLine = makeLine({ id: 'income-undep', transactionId: txId });
    const undepositedLine = makeLine({
      id: 'undeposited',
      transactionId: txId,
      glAccountId: 'gl-undeposited',
      glAccountName: 'Undeposited Funds',
      glAccountType: 'asset',
      glIsBankAccount: false,
      postingType: 'Debit',
    });

    const groups = buildLedgerGroups([], [incomeLine, undepositedLine], { basis: 'cash' });

    const incomeGroup = groups.find((group) => group.id === 'gl-income');
    expect(incomeGroup?.lines.map(({ line }) => line.id)).toEqual(['income-undep']);

    const undepositedGroup = groups.find((group) => group.id === 'gl-undeposited');
    expect(undepositedGroup?.lines.map(({ line }) => line.id)).toEqual(['undeposited']);
  });

  it('keeps non-income non-bank lines when a bank line exists on the same transaction', () => {
    const txId = 'tx-expense';
    const expenseLine = makeLine({
      id: 'expense',
      transactionId: txId,
      glAccountId: 'gl-expense',
      glAccountName: 'Electric',
      glAccountType: 'expense',
      postingType: 'Debit',
      amount: 50,
    });
    const bankLine = makeLine({
      id: 'bank-expense',
      transactionId: txId,
      glAccountId: 'bank-2',
      glAccountName: 'Operating Bank',
      glAccountType: 'asset',
      glIsBankAccount: true,
      postingType: 'Credit',
      amount: 50,
    });

    const groups = buildLedgerGroups([], [expenseLine, bankLine], { basis: 'cash' });

    const expenseGroup = groups.find((group) => group.id === 'gl-expense');
    expect(expenseGroup?.lines.map(({ line }) => line.id)).toEqual(['expense']);

    const bankGroup = groups.find((group) => group.id === 'bank-2');
    expect(bankGroup?.lines.map(({ line }) => line.id)).toEqual(['bank-expense']);
  });

  it('keeps non-income lines even without a bank line on cash basis', () => {
    const liabilityLine = makeLine({
      id: 'liability',
      transactionId: 'tx-liability',
      glAccountId: 'gl-liability',
      glAccountName: 'Security Deposit Liability',
      glAccountType: 'liability',
      postingType: 'Credit',
      amount: 5000,
    });

    const expenseLine = makeLine({
      id: 'expense-no-bank',
      transactionId: 'tx-expense',
      glAccountId: 'gl-expense',
      glAccountName: 'Electric',
      glAccountType: 'expense',
      postingType: 'Debit',
      amount: 50,
    });

    const groups = buildLedgerGroups([], [liabilityLine, expenseLine], { basis: 'cash' });
    const liabilityGroup = groups.find((group) => group.id === 'gl-liability');
    expect(liabilityGroup?.lines.map(({ line }) => line.id)).toEqual(['liability']);

    const expenseGroup = groups.find((group) => group.id === 'gl-expense');
    expect(expenseGroup?.lines.map(({ line }) => line.id)).toEqual(['expense-no-bank']);
  });
});
