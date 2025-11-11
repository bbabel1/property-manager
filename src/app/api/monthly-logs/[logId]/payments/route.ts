/**
 * Payments Stage Data API
 *
 * GET: Returns all data needed for the Payments stage including:
 * - Previous lease balance
 * - Current month charges and credits
 * - Payments applied
 * - Calculated totals (rent owed, remaining balance, fee charges)
 *
 * POST: Creates a payment transaction for the monthly log
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { PAYMENT_METHOD_VALUES } from '@/lib/enums/payment-method';
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium';
import {
  getPreviousLeaseBalance,
  calculateTotalRentOwed,
  calculateRemainingRentBalance,
  getTotalFeeCharges,
} from '@/lib/monthly-log-calculations';
import { LeaseTransactionService } from '@/lib/lease-transaction-service';
import {
  assignTransactionToMonthlyLog,
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchMonthlyLogContext,
  fetchTransactionWithLines,
  mapPaymentMethodToBuildium,
  amountsRoughlyEqual,
} from '@/lib/lease-transaction-helpers';

const CreatePaymentSchema = z.object({
  date: z.string().min(1, 'Payment date is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(PAYMENT_METHOD_VALUES),
  memo: z.string().nullable().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account ID is required'),
        amount: z.number().nonnegative('Allocation amount must be non-negative'),
      }),
    )
    .min(1, 'At least one allocation is required'),
});

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch monthly log
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('id, unit_id, property_id, period_start')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Get previous lease balance
    const previousBalance = await getPreviousLeaseBalance(
      monthlyLog.unit_id,
      monthlyLog.period_start,
    );

    // Get transactions for this month
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('id, total_amount, transaction_type, date, memo')
      .eq('monthly_log_id', logId)
      .in('transaction_type', ['Charge', 'Credit', 'Payment']);

    // Calculate totals by type
    let leaseCharges = 0;
    let leaseCredits = 0;
    let paymentsApplied = 0;

    const chargesTransactions: Array<{
      id: string;
      total_amount: number;
      transaction_type: string;
      date: string;
      memo: string | null;
    }> = [];
    const creditsTransactions: Array<{
      id: string;
      total_amount: number;
      transaction_type: string;
      date: string;
      memo: string | null;
    }> = [];
    const paymentsTransactions: Array<{
      id: string;
      total_amount: number;
      transaction_type: string;
      date: string;
      memo: string | null;
    }> = [];

    transactions?.forEach((txn) => {
      // Handle NaN, null, undefined, or invalid numbers
      const safeAmount = isNaN(txn.total_amount) || txn.total_amount == null ? 0 : txn.total_amount;
      const amount = Math.abs(safeAmount);

      if (txn.transaction_type === 'Charge') {
        leaseCharges += amount;
        chargesTransactions.push(txn);
      } else if (txn.transaction_type === 'Credit') {
        leaseCredits += amount;
        creditsTransactions.push(txn);
      } else if (txn.transaction_type === 'Payment') {
        paymentsApplied += amount;
        paymentsTransactions.push(txn);
      }
    });

    // Calculate derived values
    const totalRentOwed = calculateTotalRentOwed({
      previousLeaseBalance: previousBalance,
      leaseCharges,
      leaseCredits,
    });

    const remainingBalance = calculateRemainingRentBalance({
      totalRentOwed,
      paymentsApplied,
    });

    const feeCharges = await getTotalFeeCharges(logId);

    return NextResponse.json({
      previousBalance: isNaN(previousBalance) ? 0 : previousBalance,
      charges: chargesTransactions,
      credits: creditsTransactions,
      payments: paymentsTransactions,
      leaseCharges: isNaN(leaseCharges) ? 0 : leaseCharges,
      leaseCredits: isNaN(leaseCredits) ? 0 : leaseCredits,
      paymentsApplied: isNaN(paymentsApplied) ? 0 : paymentsApplied,
      totalRentOwed: isNaN(totalRentOwed) ? 0 : totalRentOwed,
      remainingBalance: isNaN(remainingBalance) ? 0 : remainingBalance,
      feeCharges: isNaN(feeCharges) ? 0 : feeCharges,
      unitId: monthlyLog.unit_id,
      propertyId: monthlyLog.property_id,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/payments:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const parsed = CreatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message || 'Invalid request data' } },
        { status: 400 },
      );
    }

    const { date, amount, payment_method, memo, allocations } = parsed.data;

    // Validate allocation total matches payment amount
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    if (!amountsRoughlyEqual(totalAllocated, amount)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Total allocations must equal payment amount',
          },
        },
        { status: 400 },
      );
    }

    const context = await fetchMonthlyLogContext(logId);

    const glAccountMap = await fetchBuildiumGlAccountMap(
      allocations.map((allocation) => allocation.account_id),
    );
    const lines = buildLinesFromAllocations(allocations, glAccountMap);

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Payment' as const,
      TransactionDate: date,
      Amount: amount,
      Memo: memo ?? undefined,
      PaymentMethod: mapPaymentMethodToBuildium(payment_method),
    };

    if (lines.length) {
      payload.Lines = lines;
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      context.lease.buildiumLeaseId,
      payload,
    );

    let normalized = null;
    let linesResponse: any[] = [];

    if (result.localId) {
      await assignTransactionToMonthlyLog(result.localId, logId);
      const record = await fetchTransactionWithLines(result.localId);
      if (record) {
        normalized = record.transaction;
        linesResponse = record.lines ?? [];
      }
    }

    if (!normalized) {
      normalized = {
        id: result.localId ?? result.buildium?.Id ?? null,
        transaction_type:
          result.buildium?.TransactionTypeEnum ||
          result.buildium?.TransactionType ||
          'Payment',
        total_amount:
          result.buildium?.TotalAmount ?? result.buildium?.Amount ?? amount,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? date,
        memo: result.buildium?.Memo ?? memo ?? null,
        lease_id: context.lease.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      };
    }

    // Update monthly log payments amount
    const { error: updateError } = await supabaseAdmin
      .from('monthly_logs')
      .update({
        payments_amount: amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Failed to update monthly log payments amount:', updateError);
      // Don't fail the request for this, just log it
    }

    return NextResponse.json(
      {
        data: {
          transaction: normalized,
          lines: linesResponse,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/payments:', error);

    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }

      if (error.message === 'Monthly log not found') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: error.message } },
          { status: 404 },
        );
      }

      if (
        error.message === 'No active lease is associated with this monthly log' ||
        error.message === 'Lease not found' ||
        error.message === 'Lease is missing Buildium identifier' ||
        error.message.includes('Buildium mapping')
      ) {
        return NextResponse.json(
          { error: { code: 'UNPROCESSABLE_ENTITY', message: error.message } },
          { status: 422 },
        );
      }

      return NextResponse.json(
        { error: { code: 'BUILDUM_ERROR', message: error.message } },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
