/**
 * Bills Stage Data API
 *
 * Returns all bill transactions for the monthly log.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import type { BuildiumBillCreate } from '@/types/buildium';
import { assignTransactionToMonthlyLog, fetchTransactionWithLines } from '@/lib/lease-transaction-helpers';
import { upsertBillWithLines } from '@/lib/buildium-mappers';
import { refreshMonthlyLogTotals } from '@/lib/monthly-log-calculations';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const roles: AppRole[] =
      process.env.NODE_ENV === 'development'
        ? ['platform_admin']
        : (await requireAuth()).roles;

    if (!hasPermission(roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch assigned bills
    const { data: assignedBills, error: assignedError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('monthly_log_id', logId)
      .eq('transaction_type', 'Bill')
      .order('date', { ascending: false });

    if (assignedError) {
      console.error('Error fetching assigned bills:', assignedError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch bills' } },
        { status: 500 },
      );
    }

    // Fetch unassigned bills
    const { data: unassignedBills, error: unassignedError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .is('monthly_log_id', null)
      .eq('transaction_type', 'Bill')
      .order('date', { ascending: false })
      .limit(50); // Limit to recent unassigned bills

    if (unassignedError) {
      console.error('Error fetching unassigned bills:', unassignedError);
    }

    // Calculate total bills
    const totalBills = assignedBills.reduce((sum, bill) => sum + Math.abs(bill.total_amount), 0);

    return NextResponse.json({
      assignedBills: assignedBills || [],
      unassignedBills: unassignedBills || [],
      totalBills,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/bills:', error);

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

const CreateBillSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  date: z.string().min(1, 'Bill date is required'),
  due_date: z.string().nullable().optional(),
  reference_number: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account is required'),
        amount: z.number().positive('Amount must be greater than zero'),
        memo: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Add at least one allocation'),
});

const toBuildiumDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  // Buildium expects YYYY-MM-DD (no timezone) for Date/DueDate fields.
  return date.toISOString().slice(0, 10);
};

export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    const roles: AppRole[] =
      process.env.NODE_ENV === 'development'
        ? ['platform_admin']
        : (await requireAuth()).roles;

    if (!hasPermission(roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { logId } = await params;
    const body = await request.json();
    const parsed = CreateBillSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message || 'Invalid request data' } },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const allocationsTotal = payload.allocations.reduce((sum, entry) => sum + entry.amount, 0);
    if (allocationsTotal <= 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Allocation total must be greater than zero' } },
        { status: 400 },
      );
    }

    const { data: logRecord, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        org_id,
        property_id,
        unit_id,
        units:units(
          id,
          buildium_property_id,
          buildium_unit_id
        ),
        properties:properties(
          id,
          buildium_property_id
        )
      `,
      )
      .eq('id', logId)
      .maybeSingle();

    if (logError) throw logError;
    if (!logRecord) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const buildiumPropertyId =
      logRecord.units?.buildium_property_id ?? logRecord.properties?.buildium_property_id ?? null;
    if (!buildiumPropertyId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Unit is missing a Buildium property mapping. Sync the property before creating a bill.',
          },
        },
        { status: 422 },
      );
    }

    const buildiumUnitId = logRecord.units?.buildium_unit_id ?? null;

    const { data: vendorRecord, error: vendorError } = await (supabaseAdmin as any)
      .from('vendors')
      .select('id, buildium_vendor_id')
      .eq('id', payload.vendor_id)
      .maybeSingle();

    if (vendorError) throw vendorError;
    if (!vendorRecord || typeof vendorRecord.buildium_vendor_id !== 'number') {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Selected vendor is missing a Buildium vendor ID. Update the vendor record before creating a bill.',
          },
        },
        { status: 422 },
      );
    }

    const accountIds = payload.allocations.map((entry) => entry.account_id);
    const { data: accountRows, error: accountError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, buildium_gl_account_id')
      .in('id', accountIds);

    if (accountError) throw accountError;
    const accountMap = new Map(
      (accountRows ?? []).map((row) => [
        String(row.id),
        typeof row.buildium_gl_account_id === 'number'
          ? row.buildium_gl_account_id
          : row.buildium_gl_account_id != null && !Number.isNaN(Number(row.buildium_gl_account_id))
            ? Number(row.buildium_gl_account_id)
            : null,
      ]),
    );

    const missingAccount = payload.allocations.find(
      (allocation) => !accountMap.get(allocation.account_id),
    );
    if (missingAccount) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'One or more accounts are missing Buildium mappings.',
          },
        },
        { status: 422 },
      );
    }

    const toAccountingEntity = () => ({
      Id: buildiumPropertyId,
      AccountingEntityType: 'Rental' as const,
      UnitId: buildiumUnitId ?? undefined,
    });

    const lines = payload.allocations.map((allocation) => ({
      AccountingEntity: toAccountingEntity(),
      GlAccountId: accountMap.get(allocation.account_id)!,
      Amount: allocation.amount,
      Memo: allocation.memo ?? undefined,
    }));

    const description = payload.memo?.trim() ?? '';

    const buildiumPayload: BuildiumBillCreate = {
      VendorId: vendorRecord.buildium_vendor_id,
      PropertyId: buildiumPropertyId,
      UnitId: buildiumUnitId ?? undefined,
      Date: toBuildiumDate(payload.date),
      DueDate: toBuildiumDate(payload.due_date || payload.date),
      Amount: allocationsTotal,
      // Do not inject an auto memo; use the provided memo or leave blank.
      Description: description,
      Memo: payload.memo?.trim() || undefined,
      ReferenceNumber: payload.reference_number?.trim() || undefined,
      Lines: lines,
    };

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills`;
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
      },
      body: JSON.stringify(buildiumPayload),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const message =
        details?.UserMessage ||
        details?.error ||
        details?.Errors?.map((entry: any) => `${entry.Key ?? 'Field'}: ${entry.Value ?? 'Invalid'}`).join('; ') ||
        'Buildium rejected the bill. Check the request and try again.';

      console.error('Buildium bill creation failed', response.status, details);

      return NextResponse.json(
        {
          error: {
            code: 'BUILDUM_ERROR',
            message,
            details,
          },
        },
        { status: response.status === 404 ? 502 : response.status },
      );
    }

    const buildiumBill = await response.json();

    // Buildium's response may omit lines or memo; carry forward what we sent so the local record stays complete.
    const buildiumBillWithLines = {
      ...buildiumBill,
      Description: buildiumBill?.Description ?? buildiumPayload.Description,
      Memo: buildiumBill?.Memo ?? buildiumPayload.Memo ?? null,
      Lines:
        Array.isArray(buildiumBill?.Lines) && buildiumBill.Lines.length > 0
          ? buildiumBill.Lines
          : lines,
    };

    const { transactionId } = await upsertBillWithLines(buildiumBillWithLines, supabaseAdmin);
    await assignTransactionToMonthlyLog(transactionId, logId);
    await refreshMonthlyLogTotals(logId);

    const record = await fetchTransactionWithLines(transactionId);
    const transaction = record?.transaction ?? null;

    return NextResponse.json(
      {
        data: {
          transaction,
          lines: record?.lines ?? [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/bills:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'Invalid date') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid date format' } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
