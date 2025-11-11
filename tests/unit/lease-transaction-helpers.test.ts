import { describe, expect, it } from 'vitest';
import {
  buildDepositLines,
  buildLinesFromAllocations,
  mapPaymentMethodToBuildium,
  mapRefundMethodToBuildium,
  amountsRoughlyEqual,
} from '@/lib/lease-transaction-helpers';

describe('buildLinesFromAllocations', () => {
  it('maps allocations to Buildium GL lines', () => {
    const map = new Map<string, number>([
      ['rent', 4000],
      ['fee', 5000],
    ]);
    const lines = buildLinesFromAllocations(
      [
        { account_id: 'rent', amount: 100 },
        { account_id: 'fee', amount: 25.5, memo: 'Late fee' },
      ],
      map,
    );

    expect(lines).toEqual([
      { GLAccountId: 4000, Amount: 100, Memo: undefined },
      { GLAccountId: 5000, Amount: 25.5, Memo: 'Late fee' },
    ]);
  });

  it('throws when a GL account mapping is missing', () => {
    const map = new Map<string, number>([['rent', 4000]]);
    expect(() =>
      buildLinesFromAllocations([{ account_id: 'fee', amount: 50 }], map),
    ).toThrow(/Buildium mapping/);
  });
});

describe('buildDepositLines', () => {
  it('returns debit and credit lines with correct totals', () => {
    const map = new Map<string, number>([
      ['deposit', 2100],
      ['rent', 4000],
    ]);
    const { lines, debitTotal, depositBuildiumAccountId } = buildDepositLines({
      allocations: [{ account_id: 'rent', amount: 125 }],
      depositAccountId: 'deposit',
      glAccountMap: map,
      memo: 'Apply deposit',
    });

    expect(debitTotal).toBe(125);
    expect(depositBuildiumAccountId).toBe(2100);
    expect(lines).toEqual([
      { GLAccountId: 4000, Amount: 125, Memo: undefined },
      { GLAccountId: 2100, Amount: -125, Memo: 'Apply deposit' },
    ]);
  });

  it('throws when allocations do not include a positive amount', () => {
    const map = new Map<string, number>([
      ['deposit', 2100],
      ['rent', 4000],
    ]);
    expect(() =>
      buildDepositLines({
        allocations: [{ account_id: 'rent', amount: 0 }],
        depositAccountId: 'deposit',
        glAccountMap: map,
      }),
    ).toThrow(/positive amount/);
  });
});

describe('mapPaymentMethodToBuildium', () => {
  it('maps known methods to Buildium compatible strings', () => {
    expect(mapPaymentMethodToBuildium('Check')).toBe('Check');
    expect(mapPaymentMethodToBuildium('MoneyOrder')).toBe('Check');
    expect(mapPaymentMethodToBuildium('DirectDeposit')).toBe('BankTransfer');
    expect(mapPaymentMethodToBuildium('ElectronicPayment')).toBe('OnlinePayment');
  });
});

describe('mapRefundMethodToBuildium', () => {
  it('maps refund methods', () => {
    expect(mapRefundMethodToBuildium('check')).toBe('Check');
    expect(mapRefundMethodToBuildium('eft')).toBe('BankTransfer');
  });
});

describe('amountsRoughlyEqual', () => {
  it('honors tolerance when comparing amounts', () => {
    expect(amountsRoughlyEqual(100, 100.004)).toBe(true);
    expect(amountsRoughlyEqual(100, 100.02)).toBe(false);
  });
});
