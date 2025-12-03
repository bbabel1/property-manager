import type { MonthlyLogTransaction } from '@/types/monthly-log';

export type AmountTone = 'positive' | 'negative' | 'neutral';

export type AmountDisplay = {
  prefix: string;
  formatted: string;
  tone: AmountTone;
  raw: number;
};

const LEASE_TRANSACTION_LABELS: Record<string, string> = {
  Charge: 'Lease Charge',
  Payment: 'Lease Payment',
  Credit: 'Lease Credit',
  Bill: 'Bill',
};

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

export const formatDate = (value: string): string => {
  const dateString = value?.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: 'numeric',
    year: '2-digit',
    timeZone: 'UTC',
  });
};

export const getTransactionTypeLabel = (type: string): string =>
  LEASE_TRANSACTION_LABELS[type] ?? type;

export const getTransactionScopeLabel = (transaction: MonthlyLogTransaction): string =>
  transaction.lease_id ? 'Lease transaction' : 'Unit transaction';

export const getTransactionAmountDisplay = (
  transaction: MonthlyLogTransaction,
  currencyFormatter: (value: number) => string = formatCurrency,
): AmountDisplay => {
  const type = transaction.transaction_type;
  const raw = Number(transaction.total_amount ?? 0) || 0;
  const isJournalEntry = type === 'GeneralJournalEntry';

  if (isJournalEntry) {
    const tone: AmountTone = raw === 0 ? 'neutral' : raw > 0 ? 'positive' : 'negative';
    return {
      prefix: '',
      formatted: currencyFormatter(Math.abs(raw)),
      tone,
      raw,
    };
  }

  const absoluteAmount = Math.abs(raw);
  const isPositiveType = type === 'Charge';
  const prefix = isPositiveType ? '+' : '-';
  const tone: AmountTone = isPositiveType ? 'positive' : 'negative';

  return {
    prefix,
    formatted: currencyFormatter(absoluteAmount),
    tone,
    raw,
  };
};
