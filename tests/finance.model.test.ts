import { describe, it, expect } from 'vitest';
import { rollupFinances } from '@/lib/finance/model';
import cashBalanceCases from './fixtures/finance-cash-balance-spec.json';

const makeTx = (overrides: Partial<any> = {}) => ({
  id: overrides.id ?? 'tx',
  transaction_type: overrides.transaction_type ?? 'Payment',
  total_amount: overrides.total_amount ?? 0,
});

const makeLine = (overrides: Partial<any> = {}) => ({
  amount: overrides.amount ?? 0,
  posting_type: overrides.posting_type ?? 'credit',
  transaction_id: overrides.transaction_id ?? 'tx',
  gl_accounts: overrides.gl_accounts ?? { type: 'liability', name: 'Security Deposit' },
});

describe('finance model rollup', () => {
  it('handles deposit + rent payments without bank GL lines', () => {
    const lines = [
      makeLine({ amount: 5000, posting_type: 'credit', gl_accounts: { type: 'liability', is_security_deposit_liability: true, name: 'Security Deposit Liability' }, transaction_id: 'deposit-tx' }),
      makeLine({ amount: 5000, posting_type: 'credit', gl_accounts: { type: 'income', name: 'Rent Income' }, transaction_id: 'rent-tx' }),
      makeLine({ amount: 50, posting_type: 'credit', gl_accounts: { type: 'income', name: 'Utility Income' }, transaction_id: 'rent-tx' }),
    ];
    const transactions = [
      makeTx({ id: 'deposit-tx', transaction_type: 'Payment', total_amount: 5000 }),
      makeTx({ id: 'rent-tx', transaction_type: 'Payment', total_amount: 5050 }),
    ];
    const { fin } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(10050);
    expect(fin.security_deposits).toBe(-5000);
    expect(fin.available_balance).toBe(5050);
  });

  it('prefers bank GL lines when present', () => {
    const lines = [
      makeLine({
        amount: 10050,
        posting_type: 'debit',
        gl_accounts: { type: 'asset', is_bank_account: true, name: 'Operating Bank' },
        transaction_id: 'bank-tx',
      }),
      makeLine({
        amount: 5000,
        posting_type: 'credit',
        gl_accounts: { type: 'liability', is_security_deposit_liability: true, name: 'Security Deposit Liability' },
        transaction_id: 'deposit-tx',
      }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(10050);
    expect(fin.security_deposits).toBe(-5000);
    expect(debug.usedBankBalance).toBe(true);
  });

  it('ignores GL lines marked exclude_from_cash_balances', () => {
    const lines = [
      makeLine({
        amount: 1200,
        posting_type: 'debit',
        gl_accounts: {
          type: 'asset',
          is_bank_account: true,
          name: 'Legacy Operating Bank',
          exclude_from_cash_balances: true,
        },
        transaction_id: 'bank-tx',
      }),
      makeLine({
        amount: 450,
        posting_type: 'credit',
        gl_accounts: {
          type: 'liability',
          is_security_deposit_liability: true,
          name: 'Security Deposit Liability',
          exclude_from_cash_balances: true,
        },
        transaction_id: 'deposit-tx',
      }),
    ];
    const transactions = [makeTx({ id: 'bank-tx', transaction_type: 'Payment', total_amount: 750 })];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(750);
    expect(fin.security_deposits).toBe(0);
    expect(debug.bankLineCount).toBe(0);
    expect(debug.usedPaymentFallback).toBe(true);
  });

  it('does not classify generic liabilities as prepay', () => {
    const lines = [
      makeLine({
        amount: 200,
        posting_type: 'credit',
        gl_accounts: { type: 'liability', name: 'Other Liability' },
        transaction_id: 'other',
      }),
    ];
    const { fin } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.security_deposits).toBe(0);
    expect(fin.prepayments).toBe(0);
  });

  it('supports prepayment liabilities', () => {
    const lines = [
      makeLine({
        amount: 300,
        posting_type: 'credit',
        gl_accounts: { type: 'liability', sub_type: 'prepaidrent', name: 'Prepaid Rent' },
        transaction_id: 'prepay',
      }),
    ];
    const { fin } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.prepayments).toBe(300);
    expect(fin.security_deposits).toBe(-300); // liability-normal signing
  });

  it('falls back to payments when bank lines are clearly insufficient', () => {
    const lines = [
      makeLine({
        amount: 225,
        posting_type: 'credit',
        gl_accounts: { type: 'asset', is_bank_account: true, name: 'Operating Bank' },
        transaction_id: 'bank-tx',
      }),
    ];
    const transactions = [
      makeTx({ id: 'deposit-tx', transaction_type: 'Payment', total_amount: 5000 }),
      makeTx({ id: 'rent-tx', transaction_type: 'Payment', total_amount: 5050 }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(10050);
    expect(debug.usedPaymentFallback).toBe(true);
  });

  it('falls back to AR when no bank or payments', () => {
    const lines = [
      makeLine({
        amount: 400,
        posting_type: 'debit',
        gl_accounts: { type: 'asset', sub_type: 'accountsreceivable', name: 'Accounts Receivable' },
        transaction_id: 'ar',
      }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(400);
    expect(debug.usedArFallback).toBe(true);
  });

  it('treats Accounts Receivable with spaces as AR (not bank)', () => {
    const lines = [
      makeLine({
        amount: 400,
        posting_type: 'debit',
        gl_accounts: {
          type: 'asset',
          sub_type: 'Accounts Receivable',
          name: 'Accounts Receivable',
        },
        transaction_id: 'ar-space',
      }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(400);
    expect(debug.usedArFallback).toBe(true);
    expect(debug.bankLineCount).toBe(0);
  });

  it('ignores Accounts Receivable lines when computing bank totals', () => {
    const lines = [
      makeLine({
        amount: 5000,
        posting_type: 'debit',
        gl_accounts: { type: 'asset', is_bank_account: true, name: 'Trust account' },
        transaction_id: 'bank',
      }),
      makeLine({
        amount: 5000,
        posting_type: 'credit',
        gl_accounts: {
          type: 'asset',
          sub_type: 'Accounts Receivable',
          name: 'Accounts Receivable',
        },
        transaction_id: 'ar',
      }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions: [],
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(5000);
    expect(debug.bankLineCount).toBe(1);
  });

  describe('cash balance spec fixtures', () => {
    for (const spec of cashBalanceCases) {
      it(spec.name, () => {
        const { fin, debug } = rollupFinances({
          transactionLines: spec.transactionLines as any,
          transactions: spec.transactions as any,
          propertyReserve: spec.reserve ?? 0,
        });
        if (spec.expected.cash_balance !== undefined) {
          expect(fin.cash_balance).toBe(spec.expected.cash_balance);
        }
        if (spec.expected.security_deposits !== undefined) {
          expect(fin.security_deposits).toBe(spec.expected.security_deposits);
        }
        if (spec.expected.usedBankBalance !== undefined) {
          expect(debug.usedBankBalance).toBe(spec.expected.usedBankBalance);
        }
        if (spec.expected.usedPaymentFallback !== undefined) {
          expect(debug.usedPaymentFallback).toBe(spec.expected.usedPaymentFallback);
        }
        if (spec.expected.usedArFallback !== undefined) {
          expect(debug.usedArFallback).toBe(spec.expected.usedArFallback);
        }
        if (spec.expected.incompleteBankLines !== undefined) {
          expect(debug.incompleteBankLines).toBe(spec.expected.incompleteBankLines);
        }
      });
    }
  });
});
