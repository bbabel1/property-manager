import type { PostgrestError } from '@supabase/supabase-js';

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { traceAsync } from '@/lib/metrics/trace';
import {
  calculateFinancialSummary,
} from '@/lib/monthly-log-calculations';
import {
  calculateNetToOwnerValue,
  normalizeFinancialSummary,
  type MonthlyLogFinancialSummary,
  type MonthlyLogTransaction,
} from '@/types/monthly-log';

type TransactionLineRow = {
  amount?: number | string | null;
  posting_type?: string | null;
  unit_id?: string | null;
  created_at?: string | null;
  gl_accounts?: {
    name?: string | null;
    account_number?: string | null;
    gl_account_category?: {
      category?: string | null;
    } | null;
  } | null;
};

type TransactionRow = {
  id: string;
  total_amount: number | string | null;
  memo: string | null;
  date: string;
  transaction_type: string;
  lease_id: number | null;
  monthly_log_id: string | null;
  reference_number: string | null;
  created_at?: string | null;
  effective_amount?: number | string | null;
  account_name?: string | null;
  transaction_lines?: TransactionLineRow[] | null;
};

const DEFAULT_UNASSIGNED_LIMIT = 50;

export type TransactionsBundle = {
  transactions: MonthlyLogTransaction[];
  summary: MonthlyLogFinancialSummary | null;
};

export type UnassignedPageResult = {
  items: MonthlyLogTransaction[];
  nextCursor: string | null;
};

type NormalizeOptions = {
  unitId?: string | null;
};

const CREDIT_KEYWORD = 'credit';
const DEBIT_KEYWORD = 'debit';
const TAX_ESCROW_KEYWORD = 'tax escrow';
const OWNER_DRAW_KEYWORD = 'owner draw';

const normalizeNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeDisplayAmount = (
  line: TransactionLineRow | null | undefined,
  _options: NormalizeOptions = {},
): number | null => {
  if (!line) return null;

  const amount = normalizeNumber(line.amount ?? 0);
  if (!Number.isFinite(amount)) return null;

  const postingType = (line.posting_type ?? '').toLowerCase();
  const category = (line.gl_accounts?.gl_account_category?.category ?? '').toLowerCase();
  const accountName = (line.gl_accounts?.name ?? '').toLowerCase();
  const isDepositAccount = category === 'deposit' || accountName.includes('tax escrow');

  if (isDepositAccount) {
    // For escrow/deposit accounts: Credit increases escrow (shown as negative),
    // Debit decreases escrow (shown as positive)
    if (postingType.includes(CREDIT_KEYWORD)) {
      return -Math.abs(amount);
    }
    if (postingType.includes(DEBIT_KEYWORD)) {
      return Math.abs(amount);
    }
  }

  // For other accounts, use absolute value
  return Math.abs(amount);
};

const pickDisplayLine = (
  lines: TransactionLineRow[] | null | undefined,
  options: NormalizeOptions,
): TransactionLineRow | null => {
  if (!lines || lines.length === 0) return null;

  const ownerDrawLine = lines.find((line) => {
    const name = (line.gl_accounts?.name ?? '').toLowerCase();
    return name.includes(OWNER_DRAW_KEYWORD);
  });
  if (ownerDrawLine) {
    return ownerDrawLine;
  }

  const unitId = options.unitId ?? null;
  const postingWeight = (line?: TransactionLineRow | null) => {
    const posting = (line?.posting_type ?? '').toLowerCase();
    return posting.includes(CREDIT_KEYWORD) ? 1 : 0;
  };

  const sorted = [...lines].sort((a, b) => {
    const aUnitMatch = unitId && a.unit_id && a.unit_id === unitId ? 0 : 1;
    const bUnitMatch = unitId && b.unit_id && b.unit_id === unitId ? 0 : 1;
    if (aUnitMatch !== bUnitMatch) {
      return aUnitMatch - bUnitMatch;
    }

    const aPosting = postingWeight(a);
    const bPosting = postingWeight(b);
    if (aPosting !== bPosting) {
      return aPosting - bPosting;
    }

    const aCategory = (a.gl_accounts?.gl_account_category?.category ?? '').toLowerCase();
    const bCategory = (b.gl_accounts?.gl_account_category?.category ?? '').toLowerCase();
    const aName = (a.gl_accounts?.name ?? '').toLowerCase();
    const bName = (b.gl_accounts?.name ?? '').toLowerCase();
    const aIsDeposit = aCategory === 'deposit' || aName.includes('tax escrow') ? 0 : 1;
    const bIsDeposit = bCategory === 'deposit' || bName.includes('tax escrow') ? 0 : 1;
    if (aIsDeposit !== bIsDeposit) {
      return aIsDeposit - bIsDeposit;
    }

    const aCreated = a.created_at ?? '';
    const bCreated = b.created_at ?? '';
    if (aCreated !== bCreated) {
      return aCreated.localeCompare(bCreated);
    }

    return 0;
  });

  return sorted[0] ?? null;
};

const normalizeTransactionRow = (
  row: TransactionRow,
  options: NormalizeOptions,
): MonthlyLogTransaction => {
  const effectiveAmount =
    row.effective_amount != null ? normalizeNumber(row.effective_amount) : null;

  const displayLine =
    effectiveAmount == null ? pickDisplayLine(row.transaction_lines, options) : null;

  const amount =
    effectiveAmount != null
      ? effectiveAmount
      : computeDisplayAmount(displayLine, options) ?? normalizeNumber(row.total_amount ?? 0);

  const accountName =
    row.account_name ??
    displayLine?.gl_accounts?.name ??
    displayLine?.gl_accounts?.account_number ??
    null;

  return {
    id: row.id,
    total_amount: amount,
    memo: row.memo ?? null,
    date: row.date,
    transaction_type: row.transaction_type,
    lease_id: row.lease_id ?? null,
    monthly_log_id: row.monthly_log_id ?? null,
    reference_number: row.reference_number ?? null,
    account_name: accountName,
  };
};

const computeTaxEscrowTotal = (transactions: MonthlyLogTransaction[]): number => {
  return transactions.reduce((sum, transaction) => {
    const accountName = (transaction.account_name ?? '').toLowerCase();
    if (accountName.includes(TAX_ESCROW_KEYWORD)) {
      return sum + transaction.total_amount;
    }
    return sum;
  }, 0);
};

const computeOwnerDrawTotal = (transactions: MonthlyLogTransaction[]): {
  total: number;
  hasOwnerDraw: boolean;
} => {
  let total = 0;
  let hasOwnerDraw = false;

  transactions.forEach((transaction) => {
    const accountName = (transaction.account_name ?? '').toLowerCase();
    if (accountName.includes(OWNER_DRAW_KEYWORD)) {
      hasOwnerDraw = true;
      total += transaction.total_amount;
    }
  });

  return { total, hasOwnerDraw };
};

const applyEscrowOverride = (
  transactions: MonthlyLogTransaction[],
  summary: MonthlyLogFinancialSummary | null,
): MonthlyLogFinancialSummary | null => {
  if (!summary) return summary;

  const escrowAmount = computeTaxEscrowTotal(transactions);
  const ownerDrawResult = computeOwnerDrawTotal(transactions);
  const ownerDraw = ownerDrawResult.hasOwnerDraw ? ownerDrawResult.total : 0;
  const netToOwner = calculateNetToOwnerValue({
    previousBalance: summary.previousBalance,
    totalPayments: summary.totalPayments,
    totalBills: summary.totalBills,
    escrowAmount,
    managementFees: summary.managementFees,
    ownerDraw,
  });

  return {
    ...summary,
    escrowAmount,
    ownerDraw,
    netToOwner,
  };
};

export async function loadAssignedTransactionsBundle(
  monthlyLogId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<TransactionsBundle> {
  const { data: monthlyLogContext, error: monthlyLogError } = await db
    .from('monthly_logs')
    .select('unit_id')
    .eq('id', monthlyLogId)
    .maybeSingle();

  if (monthlyLogError) {
    console.warn('[monthly-log] Failed to load monthly log context', monthlyLogError);
  }

  const normalizeOptions: NormalizeOptions = {
    unitId: monthlyLogContext?.unit_id ?? null,
  };

  // Disable RPC path due to missing supporting view in some environments; rely on fallback query.
  return fallbackAssignedBundle(monthlyLogId, db, undefined, normalizeOptions);
}

async function fallbackAssignedBundle(
  monthlyLogId: string,
  db: TypedSupabaseClient,
  cause?: unknown,
  normalizeOptions: NormalizeOptions = {},
): Promise<TransactionsBundle> {
  if (cause) {
    console.warn('[monthly-log] RPC bundle unavailable, falling back to manual query.', cause);
  }

  try {
    const fallbackResult = await traceAsync('monthlyLog.bundle.fallback', async () => {
      return await db
        .from('transactions')
        .select(
          `
          id,
          total_amount,
          memo,
          date,
          transaction_type,
          lease_id,
          monthly_log_id,
          reference_number,
          transaction_lines(
            amount,
            posting_type,
            unit_id,
            created_at,
            gl_accounts(
              name,
              account_number,
              gl_account_category(
                category
              )
            )
          )
        `,
        )
        .eq('monthly_log_id', monthlyLogId)
        .order('date', { ascending: false });
    });

    const { data, error } = fallbackResult as { data: unknown; error: PostgrestError | null };

    if (error) {
      throw error;
    }

    const fallbackRows = (Array.isArray(data) ? data : []) as TransactionRow[];
    const transactions = fallbackRows.map((row) => normalizeTransactionRow(row, normalizeOptions));
    // Use admin client to avoid RLS gaps on GL accounts/lines
    const summary = await calculateFinancialSummary(monthlyLogId, {
      db: supabaseAdmin,
      unitId: normalizeOptions.unitId ?? null,
    });

    const normalizedSummary = normalizeFinancialSummary(summary);

    return {
      transactions,
      summary: applyEscrowOverride(transactions, normalizedSummary),
    };
  } catch (error) {
    console.error('[monthly-log] Failed to load assigned transactions via fallback.', {
      monthlyLogId,
      error,
    });
    return {
      transactions: [],
      summary: null,
    };
  }
}

export async function loadUnassignedTransactionsPage(
  params: {
    leaseId?: number | null;
    unitId?: string | null;
    scope?: 'lease' | 'unit';
    cursor?: string | null;
    limit?: number;
  },
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<UnassignedPageResult> {
  const scope = params.scope ?? 'lease';
  const leaseId = params.leaseId ?? null;
  const unitId = params.unitId ?? null;

  if (scope === 'lease' && !leaseId) {
    return { items: [], nextCursor: null };
  }

  if (scope === 'unit' && !unitId) {
    return { items: [], nextCursor: null };
  }

  const limit = clampLimit(params.limit);
  let lineTransactionIds: string[] = [];
  let leaseIdsForUnit: number[] = [];

  if (scope === 'unit' && unitId) {
    const { data: unitRow } = await db
      .from('units')
      .select('buildium_unit_id')
      .eq('id', unitId)
      .maybeSingle();

    const lineFilters: string[] = [`unit_id.eq.${unitId}`];
    if (unitRow?.buildium_unit_id != null) {
      lineFilters.push(`buildium_unit_id.eq.${unitRow.buildium_unit_id}`);
    }

    if (lineFilters.length) {
      const { data: lineRows } = await db
        .from('transaction_lines')
        .select('transaction_id')
        .or(lineFilters.join(','))
        .not('transaction_id', 'is', null);
      const txIdsFromLines =
        lineRows?.map((row) => row.transaction_id as string).filter(Boolean) ?? [];
      lineTransactionIds = Array.from(new Set(txIdsFromLines));
    }

    const { data: leaseRows } = await db.from('lease').select('id').eq('unit_id', unitId);
    leaseIdsForUnit = (leaseRows ?? []).map((row) => Number(row.id)).filter((id) =>
      Number.isFinite(id),
    );
  }

  let query = db
    .from('transactions')
    .select(
      `
      id,
      total_amount,
      memo,
      date,
      transaction_type,
      lease_id,
      monthly_log_id,
      reference_number,
      created_at,
      transaction_lines(
        amount,
        posting_type,
        unit_id,
        created_at,
        gl_accounts(
          name,
          account_number,
          gl_account_category(
            category
          )
        )
      )
    `,
    )
    .in('transaction_type', ['Charge', 'Credit'])
    .is('monthly_log_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (scope === 'lease') {
    if (leaseId == null) {
      return { items: [], nextCursor: null };
    }
    query = query.eq('lease_id', leaseId);
  } else if (scope === 'unit') {
    const ors: string[] = [];
    if (leaseIdsForUnit.length) {
      ors.push(`lease_id.in.(${leaseIdsForUnit.join(',')})`);
    }
    if (lineTransactionIds.length) {
      ors.push(`id.in.(${lineTransactionIds.join(',')})`);
    }
    if (ors.length === 1) {
      query = query.or(ors[0]);
    } else if (ors.length > 1) {
      query = query.or(ors.join(','));
    } else {
      return { items: [], nextCursor: null };
    }
  }

  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  const unassignedResult = await traceAsync('monthlyLog.unassigned.page', async () => {
    return await query;
  });

  const { data, error } = unassignedResult as { data: unknown; error: PostgrestError | null };

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<TransactionRow & { created_at: string }>;
  const items = rows.map((row) =>
    normalizeTransactionRow(row, { unitId: scope === 'unit' ? unitId : null }),
  );
  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null;

  return {
    items,
    nextCursor,
  };
}

function clampLimit(limit?: number | null): number {
  if (!Number.isFinite(limit ?? NaN)) {
    return DEFAULT_UNASSIGNED_LIMIT;
  }
  const normalized = Number(limit);
  if (normalized <= 0) return DEFAULT_UNASSIGNED_LIMIT;
  return Math.min(Math.max(normalized, 10), 200);
}

export const __test__ = {
  normalizeTransactionRow,
  pickDisplayLine,
  computeDisplayAmount,
  computeTaxEscrowTotal,
  computeOwnerDrawTotal,
  applyEscrowOverride,
};
