import { describe, it, expect } from 'vitest';
import { rollupFinances } from '@/lib/finance/model';
import type { FinanceRollupParams } from '@/lib/finance/model';
import cashBalanceCases from './fixtures/finance-cash-balance-spec.json';

type TxShape = NonNullable<FinanceRollupParams['transactions']>[number];
type LineShape = NonNullable<FinanceRollupParams['transactionLines']>[number];

const makeTx = (overrides: Partial<TxShape> = {}): TxShape => ({
  id: overrides.id ?? 'tx',
  transaction_type: overrides.transaction_type ?? 'Payment',
  total_amount: overrides.total_amount ?? 0,
});

const makeLine = (overrides: Partial<LineShape> = {}): LineShape => ({
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

  it('does not treat deposit charges without payment as deposits held', () => {
    const lines = [
      makeLine({
        amount: 2500,
        posting_type: 'credit',
        gl_accounts: { type: 'liability', is_security_deposit_liability: true, name: 'Security Deposit Liability' },
        transaction_id: 'deposit-charge',
      }),
    ];
    const transactions = [makeTx({ id: 'deposit-charge', transaction_type: 'Charge', total_amount: 2500 })];
    const { fin } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(0);
    expect(fin.security_deposits).toBe(0);
    expect(fin.available_balance).toBe(0);
  });

  it('ignores payment-like labels on charge transactions when computing cash', () => {
    const lines = [
      makeLine({
        amount: 2500,
        posting_type: 'debit',
        gl_accounts: {
          type: 'asset',
          sub_type: 'accountsreceivable',
          name: 'Accounts Receivable',
        },
        transaction_id: 'payment-charge',
      }),
    ];
    const transactions = [
      makeTx({ id: 'payment-charge', transaction_type: 'Payment Charge', total_amount: 2500 }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.cash_balance).toBe(0);
    expect(debug.usedPaymentFallback).toBe(false);
    expect(debug.totals.arFallback).toBe(2500);
  });

  it('ignores deposit liabilities when transaction is a charge even if labeled payment', () => {
    const lines = [
      makeLine({
        amount: 1500,
        posting_type: 'credit',
        gl_accounts: {
          type: 'liability',
          is_security_deposit_liability: true,
          name: 'Security Deposit Liability',
        },
        transaction_id: 'deposit-payment-charge',
      }),
    ];
    const transactions = [
      makeTx({
        id: 'deposit-payment-charge',
        transaction_type: 'Deposit Payment Charge',
        total_amount: 1500,
      }),
    ];
    const { fin, debug } = rollupFinances({
      transactionLines: lines,
      transactions,
      propertyReserve: 0,
    });
    expect(fin.security_deposits).toBe(0);
    expect(fin.cash_balance).toBe(0);
    expect(debug.usedPaymentFallback).toBe(false);
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

  it('does not treat AR-only charges as cash when no bank or payments', () => {
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
    expect(fin.cash_balance).toBe(0);
    expect(debug.usedArFallback).toBe(false);
    expect(debug.totals.arFallback).toBe(400);
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
    expect(fin.cash_balance).toBe(0);
    expect(debug.usedArFallback).toBe(false);
    expect(debug.bankLineCount).toBe(0);
    expect(debug.totals.arFallback).toBe(400);
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
          transactionLines: spec.transactionLines as FinanceRollupParams['transactionLines'],
          transactions: spec.transactions as FinanceRollupParams['transactions'],
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
