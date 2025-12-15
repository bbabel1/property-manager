import { calculateNetToOwnerValue } from '@/types/monthly-log';

type Numeric = number | string | null | undefined;

export type StatementSummaryInput = {
  totalCharges?: Numeric;
  totalCredits?: Numeric;
  totalPayments?: Numeric;
  totalBills?: Numeric;
  escrowAmount?: Numeric;
  managementFees?: Numeric;
  ownerDraw?: Numeric;
  previousLeaseBalance?: Numeric;
};

export type StatementSummary = {
  totalCharges: number;
  totalCredits: number;
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
  managementFees: number;
  ownerDraw: number;
  previousBalance: number;
  netToOwner: number;
  balance: number;
};

const toNumber = (value: Numeric, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Builds a normalized statement summary with explicit sign conventions:
 * - ownerDraw: positive internal value (displayed as negative)
 * - escrowAmount: signed as provided (positive increases net to owner)
 * - netToOwner: previousBalance + payments - bills - managementFees - ownerDraw + escrowAmount
 * - balance: charges - credits - payments
 */
export function buildStatementFinancialSummary(input: StatementSummaryInput): StatementSummary {
  const totalCharges = toNumber(input.totalCharges);
  const totalCredits = toNumber(input.totalCredits);
  const totalPayments = toNumber(input.totalPayments);
  const totalBills = toNumber(input.totalBills);
  const escrowAmount = toNumber(input.escrowAmount);
  const managementFees = toNumber(input.managementFees);
  const ownerDraw = Math.abs(toNumber(input.ownerDraw));
  const previousBalance = toNumber(input.previousLeaseBalance);

  const netToOwner = calculateNetToOwnerValue({
    previousBalance,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    ownerDraw,
  });
  const balance = totalCharges - totalCredits - totalPayments;

  return {
    totalCharges,
    totalCredits,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    ownerDraw,
    previousBalance,
    netToOwner,
    balance,
  };
}

export function assertStatementTotalsWithSummary(
  summary: StatementSummary,
  incomeTotal: number,
  expenseTotal: number,
  escrowTotal: number,
): void {
  const tolerance = 0.01;
  const diffs: Array<{ field: string; expected: number; actual: number; diff: number }> = [];

  const pairs: Array<[string, number, number]> = [
    ['totalIncome', summary.totalPayments, incomeTotal],
    ['totalExpenses', -(Math.abs(summary.totalBills) + Math.abs(summary.managementFees)), expenseTotal],
    ['totalEscrow', summary.escrowAmount, escrowTotal],
    ['endingBalance', summary.netToOwner, incomeTotal + expenseTotal + escrowTotal - Math.abs(summary.ownerDraw)],
  ];

  pairs.forEach(([field, expected, actual]) => {
    const diff = Math.abs(expected - actual);
    if (diff > tolerance) {
      diffs.push({ field, expected, actual, diff });
    }
  });

  if (diffs.length > 0) {
    console.warn('[statement-summary] Totals diverged from normalized summary', { diffs, summary });
  }
}
