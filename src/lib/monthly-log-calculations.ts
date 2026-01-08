/**
 * Monthly Log Calculation Functions
 *
 * Centralized calculation logic for monthly log financial computations.
 * These functions implement the business rules defined in the monthly log enhancement plan.
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { parseISO, format } from 'date-fns';
import { calculateNetToOwnerValue } from '@/types/monthly-log';

/**
 * Get previous lease balance from prior month's monthly log
 *
 * Formula: Sum of open/partial charges (amount_open) due before current period
 *
 * @param unitId - UUID of the unit (used if leaseId is not provided)
 * @param periodStart - ISO date string (YYYY-MM-DD) for current period
 * @param leaseId - Optional lease id to scope charges directly
 * @returns Previous lease balance amount
 */
export async function getPreviousLeaseBalance(
  unitId: string,
  periodStart: string,
  leaseId?: number | null,
): Promise<number> {
  const resolvedPeriodStart = format(parseISO(periodStart), 'yyyy-MM-dd');
  let resolvedLeaseId = leaseId ?? null;
  if (!resolvedLeaseId) {
    const { data: leaseRow } = await supabaseAdmin
      .from('lease')
      .select('id')
      .eq('unit_id', unitId)
      .eq('status', 'active')
      .order('lease_from_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedLeaseId = leaseRow?.id ?? null;
  }

  if (!resolvedLeaseId) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from('charges')
    .select('amount_open')
    .eq('lease_id', resolvedLeaseId)
    .in('status', ['open', 'partial'])
    .lt('due_date', resolvedPeriodStart);

  if (error) {
    console.error('Error fetching previous lease balance from charges:', error);
    return 0;
  }

  const sum = (data ?? []).reduce((s, row: any) => s + Number(row.amount_open || 0), 0);
  return Number.isFinite(sum) ? sum : 0;
}

export type OwnerDrawTransaction = {
  transactionLineId: string;
  transactionId: string;
  date: string;
  memo: string | null;
  amount: number;
};

export type OwnerDrawSummary = {
  total: number;
  transactions: OwnerDrawTransaction[];
};

const OWNER_DRAW_KEYWORDS = [
  'owner draw',
  'owner distribution',
  'distribution to owner',
  'owner payout',
];

const matchesOwnerDrawAccount = (
  account?: {
    name?: string | null;
    default_account_name?: string | null;
    type?: string | null;
  } | null,
) => {
  const fields = [
    account?.name?.toLowerCase().trim() ?? '',
    account?.default_account_name?.toLowerCase().trim() ?? '',
  ].filter(Boolean);

  if (
    fields.some(
      (value) =>
        OWNER_DRAW_KEYWORDS.some((keyword) => value.includes(keyword)) ||
        (value.includes('owner') && value.includes('distribution')),
    )
  ) {
    return true;
  }

  // As a safety net, allow equity accounts that explicitly mention "owner"
  if (account?.type?.toLowerCase().includes('equity')) {
    return fields.some((value) => value.includes('owner'));
  }

  return false;
};

/**
 * Fetch owner draw transaction lines for a monthly log by filtering GL accounts.
 *
 * @param monthlyLogId - Target monthly log
 * @param db - Supabase client (defaults to admin)
 */
export async function getOwnerDrawSummary(
  monthlyLogId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<OwnerDrawSummary> {
  const { data, error } = await db
    .from('transaction_lines')
    .select(
      `
        id,
        amount,
        transactions!inner(
          id,
          date,
          memo,
          transaction_lines(
            gl_accounts(
              name,
              default_account_name,
              gl_account_category(
                category
              )
            )
          )
        ),
        gl_accounts!inner(
          name,
          default_account_name,
          type,
          gl_account_category(
            category
          )
        )
      `,
    )
    .eq('transactions.monthly_log_id', monthlyLogId);

  if (error) {
    console.error('Error fetching owner draw transactions:', error);
    return { total: 0, transactions: [] };
  }

  const ownerDrawLines = ((data ?? []) as unknown as Array<{
    id: string;
    amount: number | string | null;
    transactions: {
      id: string;
      date: string;
      memo: string | null;
      transaction_lines?: Array<{
        gl_accounts?: {
          name?: string | null;
          default_account_name?: string | null;
          gl_account_category?: {
            category?: string | null;
          } | null;
          type?: string | null;
        } | null;
      }> | null;
    } | null;
    gl_accounts?: {
      name?: string | null;
      default_account_name?: string | null;
      type?: string | null;
      gl_account_category?: {
        category?: string | null;
      } | null;
    } | null;
  }>).filter((row) => matchesOwnerDrawAccount(row.gl_accounts ?? undefined));

  const filteredLines = ownerDrawLines.filter((row) => {
    const accountName = row.gl_accounts?.name?.trim().toLowerCase() ?? '';
    const category = row.gl_accounts?.gl_account_category?.category?.trim().toLowerCase() ?? '';
    const isEscrowAccount = accountName.includes('escrow') || category === 'deposit';
    return !isEscrowAccount;
  });

  const transactions: OwnerDrawTransaction[] = filteredLines.map((row) => ({
    transactionLineId: row.id,
    transactionId: row.transactions?.id ?? row.id,
    date: row.transactions?.date ?? '',
    memo: row.transactions?.memo ?? null,
    amount: Math.abs(Number(row.amount) ?? 0),
  }));

  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const total = transactions.reduce((sum, entry) => sum + entry.amount, 0);

  return { total, transactions };
}

/**
 * Calculate Total Rent Owed
 *
 * Formula: Previous Month Balance + Lease Charges – Lease Credits
 *
 * @param params - Calculation parameters
 * @returns Total rent owed amount
 */
export function calculateTotalRentOwed(params: {
  previousLeaseBalance: number;
  periodOutstandingCharges: number;
}): number {
  return params.previousLeaseBalance + params.periodOutstandingCharges;
}

/**
 * Calculate Remaining Rent Balance
 *
 * Formula: Total Rent Owed – Payments Applied
 *
 * @param params - Calculation parameters
 * @returns Remaining rent balance
 */
export function calculateRemainingRentBalance(params: {
  totalRentOwed: number;
  paymentsApplied: number; // sum of Payment transactions for this lease in this month
}): number {
  return params.totalRentOwed - params.paymentsApplied;
}

/**
 * Get Total Fee Charges (Payment Processing Fees)
 *
 * Queries transaction_lines linked to payments in this log,
 * filtered by processing fee GL account.
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns Total payment processing fees
 */
export async function getTotalFeeCharges(monthlyLogId: string): Promise<number> {
  // Query transaction_lines linked to payments in this log, filtered by processing fee GL account
  const { data, error } = await supabaseAdmin
    .from('transaction_lines')
    .select(
      'amount, transactions!inner(monthly_log_id), gl_accounts!inner(gl_account_category!inner(category))',
    )
    .eq('transactions.monthly_log_id', monthlyLogId)
    .eq('gl_accounts.gl_account_category.category', 'expense')
    .ilike('memo', '%processing fee%');

  if (error) {
    console.error('Error fetching fee charges:', error);
    return 0;
  }

  return data?.reduce((sum, line) => sum + Math.abs(line.amount ?? 0), 0) ?? 0;
}

/**
 * Manually trigger reconciliation of monthly log balance
 *
 * Calls the database function reconcile_monthly_log_balance
 * to recalculate the previous_lease_balance field.
 *
 * @param monthlyLogId - UUID of the monthly log to reconcile
 */
export async function reconcileMonthlyLogBalance(monthlyLogId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('reconcile_monthly_log_balance', {
    p_monthly_log_id: monthlyLogId,
  });

  if (error) {
    console.error('Error reconciling monthly log balance:', error);
    throw new Error(`Failed to reconcile monthly log balance: ${error.message}`);
  }
}

/**
 * Calculate financial summary for a monthly log
 *
 * Aggregates all transaction amounts by type for comprehensive reporting.
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns Financial summary with all calculated totals
 */
type FinancialSummaryOptions = {
  db?: TypedSupabaseClient;
  includeOwnerDrawTransactions?: boolean;
  unitId?: string | null;
};

type EscrowTransactionLine = {
  amount: number | null;
  posting_type: string | null;
  unit_id: string | null;
  gl_accounts?: {
    name?: string | null;
    gl_account_category?: {
      category?: string | null;
    } | null;
  } | null;
};

const normalizeEscrowField = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

export const isEscrowTransactionLine = (
  line: EscrowTransactionLine,
  unitId: string | null,
): boolean => {
  const accountName = normalizeEscrowField(line.gl_accounts?.name);
  const category = normalizeEscrowField(line.gl_accounts?.gl_account_category?.category);
  const isEscrowAccount = category === 'deposit' || accountName.includes('tax escrow');

  if (!isEscrowAccount) {
    return false;
  }

  if (!unitId) {
    return true;
  }

  return line.unit_id === unitId || line.unit_id === null;
};

type SummaryTransactionLine = {
  amount?: number | string | null;
  posting_type?: string | null;
  unit_id?: string | null;
  created_at?: string | null;
  gl_accounts?: {
    name?: string | null;
    account_number?: string | null;
    default_account_name?: string | null;
    gl_account_category?: {
      category?: string | null;
    } | null;
  } | null;
};

type SummaryTransactionRow = {
  id: string;
  total_amount: number | string | null;
  transaction_type: string;
  transaction_lines?: SummaryTransactionLine[] | null;
};

const normalizeNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MANAGEMENT_FEE_KEYWORD = 'management fee';
const PROPERTY_TAX_KEYWORD = 'property tax';
const OWNER_DRAW_KEYWORD = 'owner draw';

const computeLineAmount = (
  line: SummaryTransactionLine | null | undefined,
): number | null => {
  if (!line) return null;

  const amount = normalizeNumber(line.amount);
  if (!Number.isFinite(amount)) return null;

  const postingType = (line.posting_type ?? '').toLowerCase();
  const category = normalizeEscrowField(line.gl_accounts?.gl_account_category?.category);
  const accountName = normalizeEscrowField(line.gl_accounts?.name);
  const isDepositAccount = category === 'deposit' || accountName.includes('tax escrow');

  if (isDepositAccount) {
    if (postingType.includes('credit')) {
      return -Math.abs(amount);
    }
    if (postingType.includes('debit')) {
      return Math.abs(amount);
    }
  }

  return Math.abs(amount);
};

const pickDisplayLineForAmount = (
  lines: SummaryTransactionLine[] | null | undefined,
  unitId: string | null,
): SummaryTransactionLine | null => {
  if (!lines || lines.length === 0) return null;

  const ownerDrawLine = lines.find((line) => {
    const name = normalizeEscrowField(line.gl_accounts?.name);
    return name.includes(OWNER_DRAW_KEYWORD);
  });
  if (ownerDrawLine) {
    return ownerDrawLine;
  }

  const postingWeight = (line?: SummaryTransactionLine | null) => {
    const posting = (line?.posting_type ?? '').toLowerCase();
    return posting.includes('credit') ? 1 : 0;
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

    const aCategory = normalizeEscrowField(a.gl_accounts?.gl_account_category?.category);
    const bCategory = normalizeEscrowField(b.gl_accounts?.gl_account_category?.category);
    const aName = normalizeEscrowField(a.gl_accounts?.name);
    const bName = normalizeEscrowField(b.gl_accounts?.name);
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

const getTransactionEffectiveAmount = (
  transaction: SummaryTransactionRow,
  unitId: string | null,
): number => {
  const displayLine = pickDisplayLineForAmount(transaction.transaction_lines, unitId);
  const lineAmount = computeLineAmount(displayLine);
  if (lineAmount != null) {
    return lineAmount;
  }

  return normalizeNumber(transaction.total_amount ?? 0);
};

const isManagementFeeLine = (line: SummaryTransactionLine | null | undefined): boolean => {
  if (!line) return false;
  const accountName = normalizeEscrowField(line.gl_accounts?.name);
  const defaultName = normalizeEscrowField(line.gl_accounts?.default_account_name);
  return (
    accountName.includes(MANAGEMENT_FEE_KEYWORD) || defaultName.includes(MANAGEMENT_FEE_KEYWORD)
  );
};

const isPropertyTaxLine = (line: SummaryTransactionLine | null | undefined): boolean => {
  if (!line) return false;
  const accountName = normalizeEscrowField(line.gl_accounts?.name);
  const defaultName = normalizeEscrowField(line.gl_accounts?.default_account_name);
  return accountName.includes(PROPERTY_TAX_KEYWORD) || defaultName.includes(PROPERTY_TAX_KEYWORD);
};

const shouldExcludeBillTransaction = (transaction: SummaryTransactionRow): boolean => {
  const lines = transaction.transaction_lines ?? [];
  return lines.some((line) => isManagementFeeLine(line) || isPropertyTaxLine(line));
};

const deriveManagementFeesFromTransactions = (
  transactions: SummaryTransactionRow[],
): number => {
  return transactions.reduce((sum, transaction) => {
    const lines = transaction.transaction_lines ?? [];
    const lineTotal = lines.reduce((lineSum, line) => {
      if (!isManagementFeeLine(line)) return lineSum;
      return lineSum + Math.abs(normalizeNumber(line.amount));
    }, 0);
    return sum + lineTotal;
  }, 0);
};

export async function calculateFinancialSummary(
  monthlyLogId: string,
  options: FinancialSummaryOptions = {},
): Promise<{
  totalCharges: number;
  totalCredits: number;
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
  managementFees: number;
  netToOwner: number;
  ownerDraw: number;
  balance: number;
  previousBalance: number;
  ownerDrawTransactions?: OwnerDrawTransaction[];
}> {
  const db = options.db ?? supabaseAdmin;

  const unitId = options.unitId ?? null;

  const escrowQuery = db
    .from('transaction_lines')
    .select(
      `
        amount,
        posting_type,
        unit_id,
        transactions!inner(monthly_log_id),
        gl_accounts(
          gl_account_category(
            category
          ),
          name
        )
      `,
    )
    .eq('transactions.monthly_log_id', monthlyLogId);

  const managementFeeLinesQuery = db
    .from('transaction_lines')
    .select(
      `
        amount,
        transactions!inner(monthly_log_id),
        gl_accounts!inner(
          name,
          default_account_name
        )
      `,
    )
    .eq('transactions.monthly_log_id', monthlyLogId);

  const [
    transactionsResult,
    logResult,
    ownerDrawSummary,
    escrowLinesResult,
    managementFeeLinesResult,
  ] = await Promise.all([
    db
      .from('transactions')
      .select(
        `
          id,
          total_amount,
          transaction_type,
          transaction_lines(
            amount,
            posting_type,
            unit_id,
            created_at,
            gl_accounts(
              name,
              account_number,
              default_account_name,
              gl_account_category(
                category
              )
            )
          )
        `,
      )
      .eq('monthly_log_id', monthlyLogId),
    db
      .from('monthly_logs')
      .select('escrow_amount, management_fees_amount, previous_lease_balance')
      .eq('id', monthlyLogId)
      .maybeSingle(),
    getOwnerDrawSummary(monthlyLogId, db),
    escrowQuery,
    managementFeeLinesQuery,
  ]);

  const transactionRows = (transactionsResult.data ?? []) as SummaryTransactionRow[];

  if (transactionsResult.error) {
    throw transactionsResult.error;
  }

  if (logResult.error) {
    throw logResult.error;
  }

  let totalCharges = 0;
  let totalCredits = 0;
  let totalPayments = 0;
  let totalBills = 0;
  if (escrowLinesResult.error) {
    console.warn('Error fetching escrow transaction lines for summary:', escrowLinesResult.error);
  }
  if (managementFeeLinesResult.error) {
    console.warn(
      'Error fetching management fee transaction lines for summary:',
      managementFeeLinesResult.error,
    );
  }

  const rawEscrowLines = (escrowLinesResult.data ?? []) as EscrowTransactionLine[];
  const escrowLines = rawEscrowLines.filter((line) => isEscrowTransactionLine(line, unitId));

  const escrowAmount =
    escrowLines.length > 0
      ? escrowLines.reduce((sum, line) => {
          const amount = Math.abs(Number(line.amount ?? 0));
          const postingType = (line.posting_type ?? '').toLowerCase();
          // For escrow accounts: Credit increases escrow (negative in summary),
          // Debit decreases escrow (positive in summary)
          if (postingType.includes('credit')) {
            return sum - amount;
          }
          if (postingType.includes('debit')) {
            return sum + amount;
          }
          return sum;
        }, 0)
      : Number(logResult.data?.escrow_amount ?? 0);
  const managementFeeLinesRaw = (managementFeeLinesResult.data ?? []) as Array<{
    amount?: number | string | null;
    gl_accounts?: { name?: string | null; default_account_name?: string | null } | null;
  }>;
  const managementFeeLines = managementFeeLinesRaw.filter((line) => isManagementFeeLine(line));
  const calculatedManagementFees =
    managementFeeLines.length > 0
      ? managementFeeLines.reduce((sum, line) => sum + Math.abs(Number(line.amount ?? 0)), 0)
      : 0;
  const derivedManagementFees = deriveManagementFeesFromTransactions(transactionRows);
  const denormalizedManagementFees = Number(logResult.data?.management_fees_amount ?? 0);
  const managementFees =
    calculatedManagementFees || derivedManagementFees || denormalizedManagementFees;

  transactionRows.forEach((transaction) => {
    const amount = Math.abs(getTransactionEffectiveAmount(transaction, unitId));
    const isExcludedBill = shouldExcludeBillTransaction(transaction);

    switch (transaction.transaction_type) {
      case 'Charge':
        totalCharges += amount;
        break;
      case 'Credit':
        totalCredits += amount;
        break;
      case 'Payment':
        totalPayments += amount;
        break;
      case 'Bill':
        if (!isExcludedBill) {
          totalBills += amount;
        }
        break;
      default:
        break;
    }
  });

  const ownerDraw = ownerDrawSummary.total;
  const previousBalance = Number(logResult.data?.previous_lease_balance ?? 0);
  const netToOwner = calculateNetToOwnerValue({
    previousBalance,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    ownerDraw,
  });
  const balance = totalCharges - totalCredits - totalPayments;

  const result = {
    totalCharges,
    totalCredits,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    netToOwner,
    ownerDraw,
    balance,
    previousBalance,
  } as {
    totalCharges: number;
    totalCredits: number;
    totalPayments: number;
    totalBills: number;
    escrowAmount: number;
    managementFees: number;
    netToOwner: number;
    ownerDraw: number;
    balance: number;
    previousBalance: number;
    ownerDrawTransactions?: OwnerDrawTransaction[];
  };

  if (options.includeOwnerDrawTransactions) {
    result.ownerDrawTransactions = ownerDrawSummary.transactions;
  }

  return result;
}

/**
 * Persist denormalized monthly log totals so the list view stays in sync
 * with the detailed financial summary calculations.
 *
 * @param monthlyLogId - UUID of the monthly log to refresh
 * @param db - Optional Supabase client (defaults to admin)
 */
export async function refreshMonthlyLogTotals(
  monthlyLogId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<void> {
  const summary = await calculateFinancialSummary(monthlyLogId, { db });

  const { error } = await db
    .from('monthly_logs')
    .update({
      charges_amount: summary.totalCharges,
      payments_amount: summary.totalPayments,
      bills_amount: summary.totalBills,
      escrow_amount: summary.escrowAmount,
      management_fees_amount: summary.managementFees,
      updated_at: new Date().toISOString(),
    })
    .eq('id', monthlyLogId);

  if (error) {
    console.error('[monthly-log] Failed to refresh denormalized totals', error);
    throw new Error(error.message || 'Failed to refresh monthly log totals');
  }
}

export const __test__ = {
  isManagementFeeLine,
  isPropertyTaxLine,
  shouldExcludeBillTransaction,
};
