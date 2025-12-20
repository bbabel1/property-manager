import { describe, expect, it } from 'vitest';
import { signedAmountFromTransaction } from '../finance/model';

describe('signedAmountFromTransaction', () => {
  it('falls back to transaction lines when header totals are zero', () => {
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

    const balance = [rentCharge, rentPayment, rentPayment].reduce(
      (sum, tx) => sum + signedAmountFromTransaction(tx as any),
      0,
    );

    expect(balance).toBe(-5000);
  });
});
