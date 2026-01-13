import { describe, it, expect } from 'vitest';

import { rollupFinances, type FinanceRollupParams } from '@/lib/finance/model';
import { buildLedgerGroups, type LedgerLine } from '@/server/financials/ledger-utils';

type TxShape = NonNullable<FinanceRollupParams['transactions']>[number];
type LineShape = NonNullable<FinanceRollupParams['transactionLines']>[number];

const makeTx = (overrides: Partial<TxShape> = {}): TxShape => ({
  id: overrides.id ?? 'tx-1',
  transaction_type: overrides.transaction_type ?? 'Payment',
  total_amount: overrides.total_amount ?? 0,
});

const makeLine = (overrides: Partial<LineShape> = {}): LineShape => ({
  amount: overrides.amount ?? 0,
  posting_type: overrides.posting_type ?? 'credit',
  transaction_id: overrides.transaction_id ?? 'tx-1',
  gl_accounts: {
    type: overrides.gl_accounts?.type ?? 'income',
    sub_type: overrides.gl_accounts?.sub_type,
    name: overrides.gl_accounts?.name ?? 'Rent Income',
    gl_account_category: overrides.gl_accounts?.gl_account_category,
    is_bank_account: overrides.gl_accounts?.is_bank_account ?? false,
    is_security_deposit_liability:
      overrides.gl_accounts?.is_security_deposit_liability ?? false,
    exclude_from_cash_balances:
      overrides.gl_accounts?.exclude_from_cash_balances ?? false,
  },
});

const makeLedgerLineFrom = (
  id: string,
  line: LineShape,
  tx: TxShape,
  overrides: Partial<LedgerLine> = {},
): LedgerLine => {
  const postingRaw = String(line.posting_type || '').toLowerCase();
  const postingType: LedgerLine['postingType'] =
    postingRaw === 'debit' || postingRaw === 'dr' ? 'Debit' : 'Credit';

  const account = line.gl_accounts ?? {};

  return {
    id,
    date: '2026-01-01',
    amount: Number(line.amount ?? 0) || 0,
    postingType,
    memo: null,
    createdAt: '2026-01-01T00:00:00Z',
    propertyId: 'prop-1',
    propertyLabel: 'Property',
    unitId: 'unit-1',
    unitLabel: '10J',
    glAccountId: overrides.glAccountId ?? `${String(account.name || 'Account')}`,
    glAccountName: String(account.name || 'Account'),
    glAccountNumber: null,
    glAccountType: (account as { type?: string | null }).type ?? null,
    glIsBankAccount: Boolean(
      (account as { is_bank_account?: boolean | null }).is_bank_account,
    ),
    glExcludeFromCash: Boolean(
      (account as { exclude_from_cash_balances?: boolean | null })
        .exclude_from_cash_balances,
    ),
    transactionId: tx.id != null ? String(tx.id) : null,
    transactionType:
      typeof tx.transaction_type === 'string' ? tx.transaction_type : null,
    transactionMemo: null,
    transactionReference: null,
    ...overrides,
  };
};

describe('cash-basis alignment between ledger and rollup', () => {
  it('treats a simple rent payment consistently', () => {
    const rentTx = makeTx({
      id: 'rent-tx',
      transaction_type: 'Payment',
      total_amount: 2500,
    });

    const rentIncomeLine = makeLine({
      amount: 2500,
      posting_type: 'credit',
      transaction_id: 'rent-tx',
      gl_accounts: { type: 'income', name: 'Rent Income' },
    });

    const undepositedLine = makeLine({
      amount: 2500,
      posting_type: 'debit',
      transaction_id: 'rent-tx',
      gl_accounts: {
        type: 'asset',
        name: 'Undeposited Funds',
        is_bank_account: false,
      },
    });

    const { fin } = rollupFinances({
      transactionLines: [rentIncomeLine, undepositedLine],
      transactions: [rentTx],
      propertyReserve: 0,
    });

    const ledgerLines: LedgerLine[] = [
      makeLedgerLineFrom('rent-income', rentIncomeLine, rentTx, {
        glAccountId: 'gl-income',
      }),
      makeLedgerLineFrom('undeposited', undepositedLine, rentTx, {
        glAccountId: 'gl-undeposited',
      }),
    ];

    const groups = buildLedgerGroups([], ledgerLines, { basis: 'cash' });
    const incomeGroup = groups.find((group) => group.id === 'gl-income');
    const undepositedGroup = groups.find(
      (group) => group.id === 'gl-undeposited',
    );

    expect(fin.cash_balance).toBe(2500);
    expect(incomeGroup?.net).toBe(2500);
    expect(undepositedGroup?.net).toBe(2500);
    expect(fin.cash_balance).toBe(undepositedGroup?.net);
  });

  it('drops deposit charges but keeps deposit payments on cash basis', () => {
    const depositChargeTx = makeTx({
      id: 'deposit-charge',
      transaction_type: 'Charge',
      total_amount: 2500,
    });
    const depositPaymentTx = makeTx({
      id: 'deposit-payment',
      transaction_type: 'Payment',
      total_amount: 2500,
    });

    const depositChargeLine = makeLine({
      amount: 2500,
      posting_type: 'credit',
      transaction_id: 'deposit-charge',
      gl_accounts: {
        type: 'liability',
        name: 'Security Deposit Liability',
        is_security_deposit_liability: true,
      },
    });

    const depositPaymentLiabilityLine = makeLine({
      amount: 2500,
      posting_type: 'credit',
      transaction_id: 'deposit-payment',
      gl_accounts: {
        type: 'liability',
        name: 'Security Deposit Liability',
        is_security_deposit_liability: true,
      },
    });

    const depositPaymentBankLine = makeLine({
      amount: 2500,
      posting_type: 'debit',
      transaction_id: 'deposit-payment',
      gl_accounts: {
        type: 'asset',
        name: 'Undeposited Funds',
        is_bank_account: false,
      },
    });

    const lines = [
      depositChargeLine,
      depositPaymentLiabilityLine,
      depositPaymentBankLine,
    ];

    const { fin } = rollupFinances({
      transactionLines: lines,
      transactions: [depositChargeTx, depositPaymentTx],
      propertyReserve: 0,
    });

    const ledgerLines: LedgerLine[] = [
      makeLedgerLineFrom('deposit-charge', depositChargeLine, depositChargeTx, {
        glAccountId: 'gl-deposit',
      }),
      makeLedgerLineFrom(
        'deposit-payment',
        depositPaymentLiabilityLine,
        depositPaymentTx,
        { glAccountId: 'gl-deposit' },
      ),
      makeLedgerLineFrom(
        'deposit-bank',
        depositPaymentBankLine,
        depositPaymentTx,
        { glAccountId: 'gl-undeposited' },
      ),
    ];

    const groups = buildLedgerGroups([], ledgerLines, { basis: 'cash' });
    const depositGroup = groups.find((group) => group.id === 'gl-deposit');
    const undepositedGroup = groups.find(
      (group) => group.id === 'gl-undeposited',
    );

    expect(fin.cash_balance).toBe(2500);
    expect(Math.abs(fin.security_deposits)).toBe(2500);

    expect(undepositedGroup?.net).toBe(2500);
    expect(depositGroup?.net).toBe(2500);
    expect(depositGroup?.lines.map(({ line }) => line.id)).toEqual([
      'deposit-payment',
    ]);

    expect(fin.cash_balance).toBe(undepositedGroup?.net);
  });
});

