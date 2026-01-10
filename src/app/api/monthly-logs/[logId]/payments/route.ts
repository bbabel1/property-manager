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
import { addMonths, parseISO } from 'date-fns';
import { LeaseTransactionService } from '@/lib/lease-transaction-service';
import { allocationEngine } from '@/lib/allocation-engine';
import {
  assignTransactionToMonthlyLog,
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchMonthlyLogContext,
  fetchTransactionWithLines,
  mapPaymentMethodToBuildium,
  amountsRoughlyEqual,
} from '@/lib/lease-transaction-helpers';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';
import { ensurePaymentToUndepositedFunds } from '@/lib/deposit-service';
import PayerRestrictionsService from '@/lib/payments/payer-restrictions-service';
import type { Charge, PaymentAllocation } from '@/types/ar';

const CreatePaymentSchema = z.object({
  date: z.string().min(1, 'Payment date is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(PAYMENT_METHOD_VALUES),
  memo: z.string().nullable().optional(),
  bypass_udf: z.boolean().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account ID is required'),
        amount: z.number().nonnegative('Allocation amount must be non-negative'),
      }),
    )
    .min(1, 'At least one allocation is required'),
  charge_allocations: z
    .array(
      z.object({
        charge_id: z.string().min(1, 'Charge ID is required'),
        amount: z.number().positive('Allocation amount must be greater than 0'),
      }),
    )
    .optional(),
  allocation_external_id: z.string().nullable().optional(),
  idempotency_key: z.string().min(1).optional(),
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
      .select('id, unit_id, property_id, period_start, tenant_id')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const context = await fetchMonthlyLogContext(logId);
    const periodStart = monthlyLog.period_start;
    const periodEnd = addMonths(parseISO(periodStart), 1);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);

    // Previous balance based on outstanding charges before current period
    const previousBalance = await getPreviousLeaseBalance(
      monthlyLog.unit_id,
      monthlyLog.period_start,
      context.lease.leaseId,
    );

    // Outstanding charges for this period window
    const { data: charges } = await supabaseAdmin
      .from('charges')
      .select('id, amount, amount_open, status, due_date, description, charge_type')
      .eq('lease_id', context.lease.leaseId)
      .in('status', ['open', 'partial'])
      .gte('due_date', periodStart)
      .lt('due_date', periodEndStr)
      .in('charge_type', ['rent', 'late_fee', 'utility']);

    const periodOutstandingCharges = (charges ?? []).reduce(
      (sum, c) => sum + Math.abs(Number(c.amount_open ?? 0)),
      0,
    );

    const { data: payments } = await supabaseAdmin
      .from('transactions')
      .select('id, total_amount, transaction_type, date, memo')
      .eq('monthly_log_id', logId)
      .eq('transaction_type', 'Payment');

    const paymentsApplied = (payments ?? []).reduce(
      (sum, p) => sum + Math.abs(Number(p.total_amount ?? 0)),
      0,
    );

    const totalRentOwed = calculateTotalRentOwed({
      previousLeaseBalance: previousBalance,
      periodOutstandingCharges,
    });

    const remainingBalance = calculateRemainingRentBalance({
      totalRentOwed,
      paymentsApplied,
    });

    const feeCharges = await getTotalFeeCharges(logId);

    return NextResponse.json({
      previousBalance: isNaN(previousBalance) ? 0 : previousBalance,
      charges: charges ?? [],
      payments: payments ?? [],
      outstandingCharges: isNaN(periodOutstandingCharges) ? 0 : periodOutstandingCharges,
      paymentsApplied: isNaN(paymentsApplied) ? 0 : paymentsApplied,
      totalRentOwed: isNaN(totalRentOwed) ? 0 : totalRentOwed,
      remainingBalance: isNaN(remainingBalance) ? 0 : remainingBalance,
      feeCharges: isNaN(feeCharges) ? 0 : feeCharges,
      unitId: monthlyLog.unit_id,
      propertyId: monthlyLog.property_id,
      leaseId: context.lease.leaseId,
      tenantId: monthlyLog.tenant_id ?? null,
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

    const allocationAccountIds = allocations.map((allocation) => allocation.account_id);
    const { data: _allocationAccounts, error: allocationAccountsError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, type')
      .in('id', allocationAccountIds);

    if (allocationAccountsError) {
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load GL accounts for payment allocations',
          },
        },
        { status: 500 },
      );
    }

    const context = await fetchMonthlyLogContext(logId);

    const glAccountMap = await fetchBuildiumGlAccountMap(
      allocations.map((allocation) => allocation.account_id),
    );
    const lines = buildLinesFromAllocations(allocations, glAccountMap);

    // Restriction check before Buildium call
    const payerId = context.log.tenant_id ?? null;
    if (payerId && context.lease.orgId) {
      const restricted = await PayerRestrictionsService.checkRestriction(
        context.lease.orgId,
        payerId,
        payment_method,
      );
      if (restricted) {
        return NextResponse.json(
          {
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message: 'This payer is restricted from using the selected payment method.',
            },
          },
          { status: 422 },
        );
      }
    }

    const shouldUseUdf =
      !parsed.data.bypass_udf &&
      ['ElectronicPayment', 'DirectDeposit', 'CreditCard'].includes(payment_method);
    let bankAccountIdForBuildium: number | undefined;
    if (!shouldUseUdf) {
      // Placeholder for explicit bank selection when bypassing UDF; default undefined keeps Buildium UDF workflow.
      bankAccountIdForBuildium = undefined;
    }

    const udfGlAccountId = await resolveUndepositedFundsGlAccountId(
      supabaseAdmin,
      context.lease.orgId ?? null,
    );
    if (!udfGlAccountId) {
      return NextResponse.json(
        { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Undeposited Funds account is missing for this organization.' } },
        { status: 422 },
      );
    }

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Payment' as const,
      TransactionDate: date,
      Amount: amount,
      Memo: memo ?? undefined,
      PaymentMethod: mapPaymentMethodToBuildium(payment_method),
      BankAccountId: bankAccountIdForBuildium,
    };

    if (lines.length) {
      payload.Lines = lines;
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      context.lease.buildiumLeaseId,
      payload,
      context.lease.orgId ?? undefined,
      { idempotencyKey: parsed.data.idempotency_key, bypassUdf: Boolean(parsed.data.bypass_udf) },
    );

    let intentState: string | null = null;
    if (result.intentId) {
      const { data: intentRow } = await supabaseAdmin
        .from('payment_intent')
        .select('state')
        .eq('id', result.intentId)
        .maybeSingle();
      if (!intentRow && context.lease.orgId) {
        // Fallback with org scoping if the broad query fails (paranoia against mismatched orgs)
        const scoped = await supabaseAdmin
          .from('payment_intent')
          .select('state')
          .eq('org_id', context.lease.orgId)
          .eq('id', result.intentId)
          .maybeSingle();
        intentState = (scoped.data?.state as string | null) ?? null;
      } else {
        intentState = (intentRow?.state as string | null) ?? null;
      }
    }

    if (result.localId) {
      await ensurePaymentToUndepositedFunds(result.localId, context.lease.orgId ?? null, supabaseAdmin);
    }

    let normalized: Record<string, unknown> | null = null;
    let linesResponse: Record<string, unknown>[] = [];
    let allocationsResponse: Record<string, unknown>[] = [];
    let updatedCharges: Record<string, unknown>[] = [];

    if (result.localId) {
      await assignTransactionToMonthlyLog(result.localId, logId);
      const record = await fetchTransactionWithLines(result.localId);
      if (record) {
        normalized = { ...record.transaction };
        linesResponse = (record.lines ?? []).map((line) => {
          const { transaction_id, ...rest } = line ?? {};
          return {
            ...rest,
            transaction_id: transaction_id ?? undefined,
          };
        });
      }

      const allocationResult = await allocationEngine.allocatePayment(
        amount,
        context.lease.leaseId,
        result.localId,
        undefined,
        parsed.data.charge_allocations?.map((alloc) => ({
          chargeId: alloc.charge_id,
          amount: alloc.amount,
        })),
        parsed.data.allocation_external_id ?? undefined,
      );
      allocationsResponse = allocationResult.allocations.map((allocation) => ({ ...allocation }));
      updatedCharges = allocationResult.charges.map((charge) => ({ ...charge }));

      await supabaseAdmin
        .from('transactions')
        .update({ metadata: { payment_id: result.localId } })
        .eq('id', result.localId);

      const { data: openCharges } = await supabaseAdmin
        .from('charges')
        .select('id, amount_open, status')
        .eq('lease_id', context.lease.leaseId)
        .in('status', ['open', 'partial']);
      const outstandingBalance = (openCharges ?? []).reduce(
        (sum, c) => sum + Math.abs(Number(c.amount_open ?? 0)),
        0,
      );
      normalized = normalized
        ? { ...normalized, outstanding_balance: outstandingBalance }
        : normalized;
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
          allocations: allocationsResponse,
          charges: updatedCharges,
          intent_id: result.intentId ?? null,
          intent_state: intentState,
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
        error.message.includes('allocation') ||
        error.message.includes('outstanding charges') ||
        error.message.includes('lease mismatch')
      ) {
        return NextResponse.json(
          { error: { code: 'UNPROCESSABLE_ENTITY', message: error.message } },
          { status: 422 },
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
