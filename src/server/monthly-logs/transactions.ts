import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { traceAsync } from '@/lib/metrics/trace';
import { calculateFinancialSummary, getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import {
  normalizeFinancialSummary,
  type MonthlyLogFinancialSummary,
  type MonthlyLogTransaction,
} from '@/types/monthly-log';

type TransactionRow = {
  id: string;
  total_amount: number;
  memo: string | null;
  date: string;
  transaction_type: string;
  lease_id: number | null;
  monthly_log_id: string | null;
  reference_number: string | null;
  created_at?: string;
  transaction_lines?: Array<{
    gl_accounts?: {
      name?: string | null;
      account_number?: string | null;
    } | null;
  }> | null;
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

export async function loadAssignedTransactionsBundle(
  monthlyLogId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<TransactionsBundle> {
  try {
    const { data, error } = await traceAsync('monthlyLog.rpc.bundle', () =>
      db.rpc('monthly_log_transaction_bundle', {
        p_monthly_log_id: monthlyLogId,
      }),
    );

    if (error) {
      return fallbackAssignedBundle(monthlyLogId, db, error);
    }

    const parsed =
      data && typeof data === 'string'
        ? (JSON.parse(data) as { transactions?: unknown; summary?: unknown })
        : ((data ?? {}) as { transactions?: unknown; summary?: unknown });

    const transactions = Array.isArray(parsed.transactions)
      ? parsed.transactions.map((row) =>
          normalizeTransactionRow(row as TransactionRow),
        )
      : [];

    const ownerDrawSummary = await getOwnerDrawSummary(monthlyLogId, db);
    const summary = parsed.summary
      ? normalizeFinancialSummary({
          ...(parsed.summary as Partial<MonthlyLogFinancialSummary>),
          ownerDraw: ownerDrawSummary.total,
        })
      : null;

    return { transactions, summary };
  } catch (error) {
    return fallbackAssignedBundle(monthlyLogId, db, error);
  }
}

async function fallbackAssignedBundle(
  monthlyLogId: string,
  db: TypedSupabaseClient,
  cause?: unknown,
): Promise<TransactionsBundle> {
  if (cause) {
    console.warn('[monthly-log] RPC bundle unavailable, falling back to manual query.', cause);
  }

  const { data, error } = await traceAsync('monthlyLog.bundle.fallback', () =>
    db
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
          gl_accounts(
            name,
            account_number
          )
        )
      `,
      )
      .eq('monthly_log_id', monthlyLogId)
      .order('date', { ascending: false }),
  );

  if (error) {
    throw error;
  }

  const transactions = (data ?? []).map((row) => normalizeTransactionRow(row as TransactionRow));
  const summary = await calculateFinancialSummary(monthlyLogId);

  return { transactions, summary: normalizeFinancialSummary(summary) };
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
        gl_accounts(
          name,
          account_number
        )
      )
    `,
    )
    .in('transaction_type', ['Charge', 'Credit'])
    .is('monthly_log_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (scope === 'lease') {
    query = query.eq('lease_id', leaseId);
  } else {
    query = query.eq('unit_id', unitId).is('lease_id', null);
  }

  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  const { data, error } = await traceAsync('monthlyLog.unassigned.page', () => query);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<TransactionRow & { created_at: string }>;
  const items = rows.map((row) => normalizeTransactionRow(row));
  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null;

  return {
    items,
    nextCursor,
  };
}

function normalizeTransactionRow(row: TransactionRow): MonthlyLogTransaction {
  const accountEntry = row.transaction_lines?.find(
    (line) => line?.gl_accounts && typeof line.gl_accounts === 'object',
  );
  const account =
    accountEntry && accountEntry.gl_accounts
      ? accountEntry.gl_accounts
      : { name: null, account_number: null };

  return {
    id: row.id,
    total_amount: typeof row.total_amount === 'number' ? row.total_amount : Number(row.total_amount ?? 0),
    memo: row.memo ?? null,
    date: row.date,
    transaction_type: row.transaction_type,
    lease_id: row.lease_id ?? null,
    monthly_log_id: row.monthly_log_id ?? null,
    reference_number: row.reference_number ?? null,
    account_name: account?.name ?? account?.account_number ?? null,
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
