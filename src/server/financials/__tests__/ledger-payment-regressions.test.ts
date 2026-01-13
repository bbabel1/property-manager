import { describe, expect, it } from 'vitest';

import {
  accountIds,
  combinedPaymentLines,
  depositPaymentLines,
  mixedPaymentLines,
  rentPaymentLines,
} from './__fixtures__/payment-ledger-fixtures';
import { buildLedgerGroups } from '../ledger-utils';

const lineIds = (groupId: string, groups: ReturnType<typeof buildLedgerGroups>) =>
  groups.find((g) => g.id === groupId)?.lines.map(({ line }) => line.id);

const netFor = (groupId: string, groups: ReturnType<typeof buildLedgerGroups>) =>
  groups.find((g) => g.id === groupId)?.net;

describe('payment ledger basis handling', () => {
  it('keeps rent income visible on cash while accrual shows only AR + bank', () => {
    const cash = buildLedgerGroups([], rentPaymentLines, { basis: 'cash' });
    const accrual = buildLedgerGroups([], rentPaymentLines, { basis: 'accrual' });

    expect(lineIds(accountIds.income.id, cash)).toEqual(['rent-income-credit']);
    expect(netFor(accountIds.income.id, cash)).toBe(1200);
    expect(lineIds(accountIds.bank.id, cash)).toEqual(['rent-bank']);

    expect(lineIds(accountIds.ar.id, cash)).toBeUndefined();
    expect(lineIds(accountIds.income.id, accrual)).toBeUndefined();
    expect(lineIds(accountIds.ar.id, accrual)).toEqual(['rent-ar-clear']);
    expect(netFor(accountIds.ar.id, accrual)).toBe(-1200);
    expect(lineIds(accountIds.bank.id, accrual)).toEqual(['rent-bank']);
  });

  it('drops payment balancing liability debits on cash but keeps liability credit + UDF', () => {
    const cash = buildLedgerGroups([], depositPaymentLines, { basis: 'cash' });
    const accrual = buildLedgerGroups([], depositPaymentLines, { basis: 'accrual' });

    expect(lineIds(accountIds.deposit.id, cash)).toEqual(['deposit-liability-credit']);
    expect(netFor(accountIds.deposit.id, cash)).toBe(500);
    expect(lineIds(accountIds.udf.id, cash)).toEqual(['deposit-udf']);
    expect(lineIds(accountIds.ar.id, cash)).toBeUndefined();

    expect(lineIds(accountIds.deposit.id, accrual)).toEqual([
      'deposit-liability-credit',
      'deposit-liability-debit-balancer',
    ]);
    expect(netFor(accountIds.deposit.id, accrual)).toBe(1000);
    expect(lineIds(accountIds.ar.id, accrual)).toEqual(['deposit-ar-clear']);
    expect(netFor(accountIds.ar.id, accrual)).toBe(-500);
  });

  it('keeps AR clearing and drops non-cash balancing debits on cash for mixed payments', () => {
    const cash = buildLedgerGroups([], mixedPaymentLines, { basis: 'cash' });
    const accrual = buildLedgerGroups([], mixedPaymentLines, { basis: 'accrual' });

    expect(lineIds(accountIds.income.id, cash)).toEqual(['mixed-income-credit']);
    expect(lineIds(accountIds.deposit.id, cash)).toEqual(['mixed-deposit-credit']);
    expect(lineIds(accountIds.bank.id, cash)).toEqual(['mixed-bank']);
    expect(lineIds(accountIds.ar.id, cash)).toBeUndefined();

    expect(lineIds(accountIds.deposit.id, accrual)).toEqual([
      'mixed-deposit-credit',
      'mixed-deposit-debit-balancer',
    ]);
    expect(netFor(accountIds.deposit.id, accrual)).toBe(1000);
    expect(lineIds(accountIds.income.id, accrual)).toBeUndefined();
    expect(lineIds(accountIds.ar.id, accrual)).toEqual([
      'mixed-ar-deposit-clear',
      'mixed-ar-income-clear',
    ]);
    expect(netFor(accountIds.ar.id, accrual)).toBe(-1700);
  });

  it('produces a stable ledger snapshot for rent + deposit backfill cases', () => {
    const cash = buildLedgerGroups([], combinedPaymentLines, { basis: 'cash' });
    const accrual = buildLedgerGroups([], combinedPaymentLines, { basis: 'accrual' });

    expect(netFor(accountIds.bank.id, cash)).toBe(1200);
    expect(netFor(accountIds.udf.id, cash)).toBe(500);
    expect(netFor(accountIds.income.id, cash)).toBe(1200);
    expect(netFor(accountIds.deposit.id, cash)).toBe(500);
    expect(netFor(accountIds.ar.id, cash)).toBeUndefined();

    expect(netFor(accountIds.bank.id, accrual)).toBe(1200);
    expect(netFor(accountIds.udf.id, accrual)).toBe(500);
    expect(netFor(accountIds.ar.id, accrual)).toBe(-1700);
    expect(netFor(accountIds.deposit.id, accrual)).toBe(1000);
  });
});
