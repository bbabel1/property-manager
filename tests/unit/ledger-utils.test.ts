import { describe, expect, it } from 'vitest';
import {
  buildLedgerGroups,
  signedAmount,
  type LedgerLine,
} from '@/server/financials/ledger-utils';

const baseLine = (overrides: Partial<LedgerLine>): LedgerLine => ({
  id: overrides.id ?? 'line-1',
  date: overrides.date ?? '2024-01-01',
  amount: overrides.amount ?? 0,
  postingType: overrides.postingType ?? 'Debit',
  memo: overrides.memo ?? null,
  createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
  propertyId: overrides.propertyId ?? 'property-1',
  propertyLabel: overrides.propertyLabel ?? 'Property',
  unitId: overrides.unitId ?? null,
  unitLabel: overrides.unitLabel ?? null,
  glAccountId: overrides.glAccountId ?? 'account-1',
  glAccountName: overrides.glAccountName ?? 'Operating Account',
  glAccountNumber: overrides.glAccountNumber ?? '1000',
  glAccountType: overrides.glAccountType ?? 'Asset',
  transactionId: overrides.transactionId ?? 'txn-1',
  transactionType: overrides.transactionType ?? 'Journal',
  transactionMemo: overrides.transactionMemo ?? null,
  transactionReference: overrides.transactionReference ?? null,
});

describe('ledger-utils', () => {
  it('computes signed amounts from posting type', () => {
    const debit = baseLine({ amount: 250, postingType: 'Debit' });
    const credit = baseLine({ amount: 125, postingType: 'Credit' });

    expect(signedAmount(debit)).toBe(250);
    expect(signedAmount(credit)).toBe(-125);
  });

  it('aggregates prior and period activity into account groups', () => {
    const prior = [
      baseLine({ id: 'prior-1', amount: 150, postingType: 'Debit' }),
      baseLine({ id: 'prior-2', amount: 40, postingType: 'Credit' }),
    ];
    const period = [
      baseLine({ id: 'period-1', amount: 75, postingType: 'Debit', memo: 'Rent collected' }),
      baseLine({ id: 'period-2', amount: 25, postingType: 'Credit', memo: 'Adjustment' }),
    ];

    const groups = buildLedgerGroups(prior, period);
    expect(groups).toHaveLength(1);

    const [group] = groups;
    expect(group.id).toBe('account-1');
    expect(group.name).toBe('Operating Account');
    expect(group.prior).toBe(110); // 150 debit - 40 credit
    expect(group.net).toBe(50); // 75 debit - 25 credit
    expect(group.lines).toHaveLength(2);
    expect(group.lines.map((line) => line.line.id)).toEqual(['period-1', 'period-2']);
  });

  it('sorts groups by type then name to stabilize rendering order', () => {
    const prior: LedgerLine[] = [];
    const period = [
      baseLine({
        id: 'liability',
        glAccountId: 'liability',
        glAccountName: 'Security Deposits',
        glAccountType: 'Liability',
      }),
      baseLine({
        id: 'income',
        glAccountId: 'income',
        glAccountName: 'Rental Income',
        glAccountType: 'Income',
      }),
      baseLine({
        id: 'asset',
        glAccountId: 'asset',
        glAccountName: 'Cash',
        glAccountType: 'Asset',
      }),
    ];

    const groups = buildLedgerGroups(prior, period);
    expect(groups.map((group) => group.id)).toEqual(['asset', 'income', 'liability']);
  });
});


