/**
 * Escrow Stage API
 *
 * GET: Returns escrow balance and movements for the monthly log period
 * POST: Creates a new escrow transaction (deposit or withdrawal)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import {
  getEscrowBalance,
  getEscrowMovements,
  createEscrowTransaction,
} from '@/lib/escrow-calculations';
import { refreshMonthlyLogTotals } from '@/lib/monthly-log-calculations';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// Request validation schema for POST
const createEscrowTransactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.number().positive(),
  memo: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    // Fetch monthly log to get unit and period
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('unit_id, period_start')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Calculate period dates
    const periodStart = new Date(monthlyLog.period_start);
    const fromDate = format(startOfMonth(periodStart), 'yyyy-MM-dd');
    const toDate = format(endOfMonth(periodStart), 'yyyy-MM-dd');

    // Get escrow balance up to end of period
    const balance = await getEscrowBalance(monthlyLog.unit_id, toDate);

    // Get escrow movements for this period
    const movements = await getEscrowMovements(monthlyLog.unit_id, fromDate, toDate);

    return NextResponse.json({
      deposits: balance.deposits,
      withdrawals: balance.withdrawals,
      balance: balance.balance,
      hasValidGLAccounts: balance.hasValidGLAccounts,
      movements,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/escrow:', error);

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
    const body = await request.json();

    // Validate request
    const validation = createEscrowTransactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validation.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { type, amount, memo, date } = validation.data;

    // Fetch monthly log to get unit + property context
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        org_id,
        property_id,
        unit_id,
        properties:properties(
          id,
          org_id,
          buildium_property_id,
          operating_bank_gl_account_id,
          deposit_trust_gl_account_id
        ),
        units:units(
          id,
          property_id,
          buildium_unit_id
        )
      `,
      )
      .eq('id', logId)
      .maybeSingle();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const unitRecord = Array.isArray((monthlyLog as any).units)
      ? (monthlyLog as any).units[0]
      : (monthlyLog as any).units;
    const propertyRecord = Array.isArray((monthlyLog as any).properties)
      ? (monthlyLog as any).properties[0]
      : (monthlyLog as any).properties;

    let propertyId: string | null =
      (monthlyLog as any).property_id ?? unitRecord?.property_id ?? propertyRecord?.id ?? null;
    const unitId: string | null = (monthlyLog as any).unit_id ?? unitRecord?.id ?? null;
    let orgId: string | null = (monthlyLog as any).org_id ?? propertyRecord?.org_id ?? null;
    let buildiumPropertyId: number | null = propertyRecord?.buildium_property_id ?? null;
    const buildiumUnitId: number | null = unitRecord?.buildium_unit_id ?? null;
	    let operatingBankGlAccountId: string | null =
	      (propertyRecord as any)?.operating_bank_gl_account_id ?? null;
	    let trustBankGlAccountId: string | null =
	      (propertyRecord as any)?.deposit_trust_gl_account_id ?? null;

    if (!propertyId || !unitId) {
      return NextResponse.json(
        { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Monthly log is missing unit/property linkage.' } },
        { status: 422 },
      );
    }

	    const hasBankConfig = Boolean(operatingBankGlAccountId || trustBankGlAccountId);

	    if (!orgId || buildiumPropertyId == null || !hasBankConfig) {
	      const { data: propertyRow, error: propertyError } = await supabaseAdmin
	        .from('properties')
	        .select(
	          'id, org_id, buildium_property_id, operating_bank_gl_account_id, deposit_trust_gl_account_id',
	        )
	        .eq('id', propertyId)
	        .maybeSingle();

      if (propertyError) throw propertyError;

      if (propertyRow) {
        propertyId = propertyRow.id;
        orgId = orgId ?? propertyRow.org_id ?? null;
	        buildiumPropertyId =
	          buildiumPropertyId ?? (propertyRow.buildium_property_id != null ? Number(propertyRow.buildium_property_id) : null);
	        operatingBankGlAccountId =
	          operatingBankGlAccountId ?? (propertyRow as any).operating_bank_gl_account_id ?? null;
	        trustBankGlAccountId =
	          trustBankGlAccountId ?? (propertyRow as any).deposit_trust_gl_account_id ?? null;
	      }
	    }

	    if (!orgId) {
	      return NextResponse.json(
	        { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Property is missing an organization mapping.' } },
	        { status: 422 },
	      );
	    }

	    if (!propertyId) {
	      return NextResponse.json(
	        { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Monthly log is missing property linkage.' } },
	        { status: 422 },
	      );
	    }
	    const resolvedPropertyId = propertyId;

	    const bankGlAccountId = trustBankGlAccountId ?? operatingBankGlAccountId ?? null;
	    if (!bankGlAccountId) {
	      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Configure a deposit trust account (preferred) or operating account before recording escrow activity.',
          },
        },
	        { status: 422 },
	      );
	    }

    const { data: securityDepositAccount, error: secDepError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('is_security_deposit_liability', true)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (secDepError) throw secDepError;

    let escrowGlAccountId: string | null = securityDepositAccount?.id ?? null;

    if (!escrowGlAccountId) {
      const { data: depositAccounts, error: depositError } = await supabaseAdmin
        .from('gl_accounts')
        .select(
          `
          id,
          name,
          gl_account_category!inner(category)
        `,
        )
        .eq('org_id', orgId)
        .eq('is_active', true)
        .eq('gl_account_category.category', 'deposit');

      if (depositError) throw depositError;

      const candidates = (depositAccounts ?? []) as Array<{ id?: string; name?: string | null }>;
      const nonTax = candidates.find(
        (acc) => !String(acc?.name ?? '').toLowerCase().includes('tax escrow'),
      );
      escrowGlAccountId = String((nonTax ?? candidates[0])?.id ?? '');
    }

    if (!escrowGlAccountId) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'No security deposit liability GL account is configured for this organization.',
          },
        },
        { status: 400 },
      );
    }

	    const transactionId = await createEscrowTransaction({
	      monthlyLogId: logId,
	      orgId,
	      propertyId: resolvedPropertyId,
	      unitId,
	      buildiumPropertyId,
	      buildiumUnitId,
      bankGlAccountId,
      escrowGlAccountId,
      date,
      memo,
      amount,
      type,
    });

    await refreshMonthlyLogTotals(logId);

    return NextResponse.json({ success: true, transactionId });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/escrow:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message.toLowerCase().includes('escrow')) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
