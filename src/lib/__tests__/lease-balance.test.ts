import { describe, expect, it } from 'vitest';
import { resolveLeaseBalances } from '../lease-balance';

const rentCharge = {
  transaction_type: 'rent income charge',
  total_amount: 0,
  transaction_lines: [
    { amount: 5000, posting_type: 'debit', gl_accounts: { type: 'asset' } },
    { amount: 5000, posting_type: 'credit', gl_accounts: { type: 'income' } },
  ],
};

const rentPayment = {
  transaction_type: 'rent income payment',
  total_amount: 0,
  transaction_lines: [
    { amount: 5000, posting_type: 'debit', gl_accounts: { type: 'asset' } },
    { amount: 5000, posting_type: 'credit', gl_accounts: { type: 'income' } },
  ],
};

describe('resolveLeaseBalances', () => {
  it('falls back to local transactions when remote balance is zero', () => {
    const balances = resolveLeaseBalances(
      { balance: 0, prepayments: 0, depositsHeld: 0 },
      [rentCharge, rentPayment, rentPayment],
    );

    expect(balances.balance).toBe(-5000);
    expect(balances.prepayments).toBe(0);
    expect(balances.depositsHeld).toBe(0);
  });
});
