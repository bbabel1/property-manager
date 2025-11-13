/**
 * Monthly Log Calculation Functions
 *
 * Centralized calculation logic for monthly log financial computations.
 * These functions implement the business rules defined in the monthly log enhancement plan.
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { subMonths, parseISO, format } from 'date-fns';
import { calculateNetToOwnerValue } from '@/types/monthly-log';

/**
 * Get previous lease balance from prior month's monthly log
 *
 * Formula: Previous month's (charges - payments)
 *
 * @param unitId - UUID of the unit
 * @param periodStart - ISO date string (YYYY-MM-DD) for current period
 * @returns Previous lease balance amount
 */
export async function getPreviousLeaseBalance(
  unitId: string,
  periodStart: string,
): Promise<number> {
  const priorMonth = subMonths(parseISO(periodStart), 1);
  const priorPeriodStart = format(priorMonth, 'yyyy-MM-01');

  const { data: priorLog } = await supabaseAdmin
    .from('monthly_logs')
    .select('charges_amount, payments_amount')
    .eq('unit_id', unitId)
    .eq('period_start', priorPeriodStart)
    .maybeSingle();

  if (!priorLog) return 0;

  // Previous balance = charges - payments from prior month
  return priorLog.charges_amount - priorLog.payments_amount;
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
              gl_account_category(
                category
              )
            )
          )
        ),
        gl_accounts!inner(name)
      `,
    )
    .eq('transactions.monthly_log_id', monthlyLogId)
    .ilike('gl_accounts.name', 'owner draw');

  if (error) {
    console.error('Error fetching owner draw transactions:', error);
    return { total: 0, transactions: [] };
  }

  const ownerDrawLines = (data ?? []) as Array<{
    id: string;
    amount: number | string | null;
    transactions: {
      id: string;
      date: string;
      memo: string | null;
      transaction_lines?: Array<{
        gl_accounts?: {
          name?: string | null;
          gl_account_category?: {
            category?: string | null;
          } | null;
        } | null;
      }> | null;
    } | null;
  }>;

  const filteredLines = ownerDrawLines.filter((row) => {
    const siblingLines = row.transactions?.transaction_lines ?? [];
    return !siblingLines.some((sibling) => {
      const accountName = sibling.gl_accounts?.name?.trim().toLowerCase() ?? '';
      const category = sibling.gl_accounts?.gl_account_category?.category?.trim().toLowerCase() ?? '';
      return accountName.includes('tax escrow') || category === 'deposit';
    });
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
  leaseCharges: number; // sum of Charge transactions for this lease in this month
  leaseCredits: number; // sum of Credit transactions for this lease in this month
}): number {
  return params.previousLeaseBalance + params.leaseCharges - params.leaseCredits;
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

  return data?.reduce((sum, line) => sum + Math.abs(line.amount), 0) ?? 0;
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

  const [transactionsResult, logResult, ownerDrawSummary, escrowLinesResult] = await Promise.all([
    db
      .from('transactions')
      .select('total_amount, transaction_type')
      .eq('monthly_log_id', monthlyLogId),
    db
      .from('monthly_logs')
      .select('escrow_amount, management_fees_amount, previous_lease_balance')
      .eq('id', monthlyLogId)
      .maybeSingle(),
    getOwnerDrawSummary(monthlyLogId, db),
    escrowQuery,
  ]);

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

  const rawEscrowLines = (escrowLinesResult.data ?? []) as Array<{
    amount: number | null;
    posting_type: string | null;
    unit_id: string | null;
    gl_accounts?: {
      name?: string | null;
      gl_account_category?: {
        category?: string | null;
      } | null;
    } | null;
  }>;

  const escrowLines = rawEscrowLines.filter((line) => {
    const accountName = line.gl_accounts?.name?.trim().toLowerCase() ?? '';
    const category = line.gl_accounts?.gl_account_category?.category?.trim().toLowerCase() ?? '';
    const matchesAccount = category === 'deposit' || accountName.includes('tax escrow');
    if (!matchesAccount) {
      return false;
    }
    if (!unitId) {
      return true;
    }
    return line.unit_id === unitId || line.unit_id === null;
  });

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
  const managementFees = Number(logResult.data?.management_fees_amount ?? 0);

  transactionsResult.data?.forEach((transaction) => {
    const amount = Math.abs(transaction.total_amount);

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
        totalBills += amount;
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
