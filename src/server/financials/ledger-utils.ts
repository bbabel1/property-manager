import type { Database } from '@/types/database';
import { signedAmountFromLine } from '@/lib/finance/model';

type TransactionLineRow = {
  id?: string | number | null;
  date?: string | null;
  amount?: string | number | null;
  posting_type?: string | null;
  memo?: string | null;
  created_at?: string | null;
  property_id?: string | number | null;
  unit_id?: string | number | null;
  transaction_id?: string | number | null;
  gl_account_id?: string | number | null;
  gl_accounts?: {
    name?: string | null;
    account_number?: string | null;
    type?: string | null;
    is_bank_account?: boolean | null;
    exclude_from_cash_balances?: boolean | null;
  } | null;
  units?: {
    unit_number?: string | null;
    unit_name?: string | null;
  } | null;
  transactions?: {
    id?: string | number | null;
    transaction_type?: string | null;
    memo?: string | null;
    reference_number?: string | null;
  } | null;
  properties?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
};

export type LedgerLine = {
  id: string | null;
  date: string;
  amount: number;
  postingType: 'Debit' | 'Credit';
  memo: string | null;
  createdAt: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  unitId: string | null;
  unitLabel: string | null;
  glAccountId: string;
  glAccountName: string;
  glAccountNumber: string | null;
  glAccountType: string | null;
  glIsBankAccount: boolean;
  glExcludeFromCash: boolean;
  transactionId: string | null;
  transactionType: string | null;
  transactionMemo: string | null;
  transactionReference: string | null;
};

export type LedgerGroup = {
  id: string;
  name: string;
  number: string | null;
  type: string | null;
  prior: number;
  net: number;
  lines: Array<{ line: LedgerLine; signed: number }>;
};

export function mapTransactionLine(row: TransactionLineRow): LedgerLine {
  const posting = String(row.posting_type || '').toLowerCase() === 'debit' ? 'Debit' : 'Credit';
  const propertyId = row.properties?.id ?? row.property_id ?? null;
  const propertyLabel = row.properties?.name ?? null;
  const unitLabel = row.units?.unit_number || row.units?.unit_name || null;
  const transactionId =
    row.transactions?.id ?? row.transaction_id ?? null;

  return {
    id: row.id != null ? String(row.id) : null,
    date: row.date ? String(row.date) : '',
    amount: Number(row.amount ?? 0) || 0,
    postingType: posting,
    memo: typeof row.memo === 'string' ? row.memo : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    propertyId: propertyId != null ? String(propertyId) : null,
    propertyLabel: propertyLabel ? String(propertyLabel) : null,
    unitId: row.unit_id != null ? String(row.unit_id) : null,
    unitLabel,
    glAccountId: row.gl_account_id != null ? String(row.gl_account_id) : '',
    glAccountName: row.gl_accounts?.name || 'Unknown account',
    glAccountNumber: row.gl_accounts?.account_number || null,
    glAccountType: row.gl_accounts?.type || null,
    glIsBankAccount: Boolean(row.gl_accounts?.is_bank_account),
    glExcludeFromCash: Boolean(row.gl_accounts?.exclude_from_cash_balances),
    transactionId: transactionId != null ? String(transactionId) : null,
    transactionType: row.transactions?.transaction_type
      ? String(row.transactions.transaction_type)
      : null,
    transactionMemo: row.transactions?.memo ? String(row.transactions.memo) : null,
    transactionReference: row.transactions?.reference_number
      ? String(row.transactions.reference_number)
      : null,
  };
}

export const signedAmount = (line: LedgerLine): number =>
  signedAmountFromLine({
    amount: line.amount,
    posting_type: line.postingType,
    gl_accounts: {
      type: line.glAccountType,
      name: line.glAccountName,
      is_bank_account: line.glIsBankAccount,
    },
  });

const shouldExcludePaymentToIncome = (line: LedgerLine, basis: 'cash' | 'accrual'): boolean => {
  if (basis === 'cash') return false;

  const txType = (line.transactionType || '').toLowerCase();
  if (!txType.includes('payment')) return false;

  const glType = (line.glAccountType || '').toLowerCase();
  const glName = (line.glAccountName || '').toLowerCase();

  // On accrual-basis reporting we omit payments posted directly to income (e.g., Rent Income).
  return glType === 'income' || glName.includes('income');
};

const filterOutInvalidPaymentLines = (lines: LedgerLine[], basis: 'cash' | 'accrual'): LedgerLine[] =>
  lines.filter((line) => !shouldExcludePaymentToIncome(line, basis));

const isArOrAp = (line: LedgerLine): boolean => {
  const name = (line.glAccountName || '').toLowerCase();
  return name.includes('accounts receivable') || name.includes('accounts payable');
};

const isBankLine = (line: LedgerLine): boolean => {
  if (line.glExcludeFromCash) return false;
  if (line.glIsBankAccount) return true;
  const type = (line.glAccountType || '').toLowerCase();
  const name = (line.glAccountName || '').toLowerCase();
  const isReceivable = name.includes('receivable');
  if (isReceivable) return false;
  if (type === 'asset') {
    return (
      name.includes('bank') ||
      name.includes('checking') ||
      name.includes('operating') ||
      name.includes('trust') ||
      name.includes('cash') ||
      name.includes('undeposited')
    );
  }
  return false;
};

const filterForCashBasis = (lines: LedgerLine[]): LedgerLine[] => {
  if (!lines.length) return lines;

  const txBankMap = new Map<string, boolean>();
  for (const line of lines) {
    if (!line.transactionId) continue;
    if (isBankLine(line)) {
      txBankMap.set(line.transactionId, true);
    }
  }

  return lines.filter((line) => {
    if (line.glExcludeFromCash) return false;
    if (isArOrAp(line)) return false;
    if (isBankLine(line)) return true;

    // If the line isn't linked to a transaction (e.g., orphaned or system adjustments),
    // keep it unless it's AR/AP.
    if (!line.transactionId) return true;

    const glType = (line.glAccountType || '').toLowerCase();

    // Income needs cash to be recognized on cash basis.
    if (glType === 'income') {
      return txBankMap.get(line.transactionId) === true;
    }

    // Non-income (expense, liability, equity, etc.) stays visible on cash basis.
    return true;
  });
};

export function buildLedgerGroups(
  priorLines: LedgerLine[],
  periodLines: LedgerLine[],
  options?: { basis?: 'cash' | 'accrual' },
): LedgerGroup[] {
  const basis: 'cash' | 'accrual' = options?.basis === 'cash' ? 'cash' : 'accrual';
  const basisFilteredPrior = basis === 'cash' ? filterForCashBasis(priorLines) : priorLines;
  const basisFilteredPeriod = basis === 'cash' ? filterForCashBasis(periodLines) : periodLines;

  const sanitizedPrior = filterOutInvalidPaymentLines(basisFilteredPrior, basis);
  const sanitizedPeriod = filterOutInvalidPaymentLines(basisFilteredPeriod, basis);

  const groupMap = new Map<string, LedgerGroup>();

  const ensureGroup = (line: LedgerLine): LedgerGroup => {
    const key = line.glAccountId;
    const existing = groupMap.get(key);
    if (existing) return existing;

    const created: LedgerGroup = {
      id: key,
      name: line.glAccountName,
      number: line.glAccountNumber,
      type: line.glAccountType,
      prior: 0,
      net: 0,
      lines: [],
    };
    groupMap.set(key, created);
    return created;
  };

  for (const line of sanitizedPrior) {
    const group = ensureGroup(line);
    group.prior += signedAmount(line);
  }

  for (const line of sanitizedPeriod) {
    const group = ensureGroup(line);
    const signed = signedAmount(line);
    group.net += signed;
    group.lines.push({ line, signed });
  }

  return Array.from(groupMap.values()).sort((a, b) => {
    const typeA = a.type || 'Other';
    const typeB = b.type || 'Other';
    const typeCmp = typeA.localeCompare(typeB);
    if (typeCmp !== 0) return typeCmp;
    return a.name.localeCompare(b.name);
  });
}

export type SupabaseTransactionLine =
  Database['public']['Tables']['transaction_lines']['Row'];
