import { type LedgerLine } from '@/server/financials/ledger-utils';

const baseLine: LedgerLine = {
  id: 'line-base',
  date: '2024-05-01',
  amount: 0,
  postingType: 'Credit',
  memo: null,
  createdAt: '2024-05-01T00:00:00Z',
  propertyId: 'property-1',
  propertyLabel: 'Property One',
  unitId: 'unit-1',
  unitLabel: '1A',
  glAccountId: 'gl-base',
  glAccountName: 'Base',
  glAccountNumber: null,
  glAccountType: null,
  glIsBankAccount: false,
  glExcludeFromCash: false,
  transactionId: 'tx-base',
  transactionType: 'Payment',
  transactionMemo: null,
  transactionReference: null,
};

const makeLine = (overrides: Partial<LedgerLine>): LedgerLine => ({
  ...baseLine,
  ...overrides,
});

const accounts = {
  income: { id: 'gl-income', name: 'Rent Income', type: 'income' as const },
  deposit: { id: 'gl-deposit-liability', name: 'Security Deposit Liability', type: 'liability' as const },
  ar: { id: 'gl-ar', name: 'Accounts Receivable', type: 'asset' as const },
  bank: { id: 'gl-bank', name: 'Operating Bank', type: 'asset' as const },
  udf: { id: 'gl-udf', name: 'Undeposited Funds', type: 'asset' as const },
};

export const rentPaymentLines: LedgerLine[] = [
  makeLine({
    id: 'rent-income-credit',
    transactionId: 'tx-rent',
    amount: 1200,
    glAccountId: accounts.income.id,
    glAccountName: accounts.income.name,
    glAccountType: accounts.income.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'rent-income-debit-balancer',
    transactionId: 'tx-rent',
    amount: 1200,
    glAccountId: accounts.income.id,
    glAccountName: accounts.income.name,
    glAccountType: accounts.income.type,
    postingType: 'Debit',
  }),
  makeLine({
    id: 'rent-ar-clear',
    transactionId: 'tx-rent',
    amount: 1200,
    glAccountId: accounts.ar.id,
    glAccountName: accounts.ar.name,
    glAccountType: accounts.ar.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'rent-bank',
    transactionId: 'tx-rent',
    amount: 1200,
    glAccountId: accounts.bank.id,
    glAccountName: accounts.bank.name,
    glAccountType: accounts.bank.type,
    glIsBankAccount: true,
    postingType: 'Debit',
  }),
];

export const depositPaymentLines: LedgerLine[] = [
  makeLine({
    id: 'deposit-liability-credit',
    transactionId: 'tx-deposit',
    amount: 500,
    glAccountId: accounts.deposit.id,
    glAccountName: accounts.deposit.name,
    glAccountType: accounts.deposit.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'deposit-liability-debit-balancer',
    transactionId: 'tx-deposit',
    amount: 500,
    glAccountId: accounts.deposit.id,
    glAccountName: accounts.deposit.name,
    glAccountType: accounts.deposit.type,
    postingType: 'Debit',
  }),
  makeLine({
    id: 'deposit-ar-clear',
    transactionId: 'tx-deposit',
    amount: 500,
    glAccountId: accounts.ar.id,
    glAccountName: accounts.ar.name,
    glAccountType: accounts.ar.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'deposit-udf',
    transactionId: 'tx-deposit',
    amount: 500,
    glAccountId: accounts.udf.id,
    glAccountName: accounts.udf.name,
    glAccountType: accounts.udf.type,
    glIsBankAccount: false,
    postingType: 'Debit',
  }),
];

export const mixedPaymentLines: LedgerLine[] = [
  makeLine({
    id: 'mixed-income-credit',
    transactionId: 'tx-mixed',
    amount: 1200,
    glAccountId: accounts.income.id,
    glAccountName: accounts.income.name,
    glAccountType: accounts.income.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'mixed-income-debit-balancer',
    transactionId: 'tx-mixed',
    amount: 1200,
    glAccountId: accounts.income.id,
    glAccountName: accounts.income.name,
    glAccountType: accounts.income.type,
    postingType: 'Debit',
  }),
  makeLine({
    id: 'mixed-deposit-credit',
    transactionId: 'tx-mixed',
    amount: 500,
    glAccountId: accounts.deposit.id,
    glAccountName: accounts.deposit.name,
    glAccountType: accounts.deposit.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'mixed-deposit-debit-balancer',
    transactionId: 'tx-mixed',
    amount: 500,
    glAccountId: accounts.deposit.id,
    glAccountName: accounts.deposit.name,
    glAccountType: accounts.deposit.type,
    postingType: 'Debit',
  }),
  makeLine({
    id: 'mixed-ar-income-clear',
    transactionId: 'tx-mixed',
    amount: 1200,
    glAccountId: accounts.ar.id,
    glAccountName: accounts.ar.name,
    glAccountType: accounts.ar.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'mixed-ar-deposit-clear',
    transactionId: 'tx-mixed',
    amount: 500,
    glAccountId: accounts.ar.id,
    glAccountName: accounts.ar.name,
    glAccountType: accounts.ar.type,
    postingType: 'Credit',
  }),
  makeLine({
    id: 'mixed-bank',
    transactionId: 'tx-mixed',
    amount: 1700,
    glAccountId: accounts.bank.id,
    glAccountName: accounts.bank.name,
    glAccountType: accounts.bank.type,
    glIsBankAccount: true,
    postingType: 'Debit',
  }),
];

export const combinedPaymentLines: LedgerLine[] = [
  ...rentPaymentLines,
  ...depositPaymentLines,
];

export const accountIds = accounts;
