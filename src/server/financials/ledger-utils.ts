import type { Database } from '@/types/database';

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

export function signedAmount(line: LedgerLine): number {
  const type = (line.glAccountType || '').toLowerCase();
  const creditNormal =
    type === 'liability' || type === 'equity' || type === 'income';
  const isDebit = line.postingType === 'Debit';
  if (creditNormal) {
    return isDebit ? -line.amount : line.amount;
  }
  return isDebit ? line.amount : -line.amount;
}

export function buildLedgerGroups(
  priorLines: LedgerLine[],
  periodLines: LedgerLine[],
): LedgerGroup[] {
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

  for (const line of priorLines) {
    const group = ensureGroup(line);
    group.prior += signedAmount(line);
  }

  for (const line of periodLines) {
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

