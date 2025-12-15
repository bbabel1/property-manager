/**
 * Owner Draw Calculation API
 *
 * Returns the calculated owner draw and breakdown.
 * Owner draw totals all transaction lines booked to the "Owner Draw" GL account.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import {
  calculateFinancialSummary,
  refreshMonthlyLogTotals,
} from '@/lib/monthly-log-calculations';
import { assignTransactionToMonthlyLog, fetchTransactionWithLines } from '@/lib/lease-transaction-helpers';
import { BuildiumCheckCreateSchema } from '@/schemas/buildium';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

type OwnershipRow = {
  owner_id: string | null;
  owners: { id?: string | null; buildium_owner_id?: number | null } | null;
};

type BuildiumErrorDetail = {
  UserMessage?: string;
  error?: string;
  Errors?: Array<{ Key?: string | null; Value?: string | null }>;
  [key: string]: unknown;
};

const OwnerDrawCreateSchema = z.object({
  payeeId: z.string().min(1, 'Payee is required'),
  date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  memo: z.string().nullable().optional(),
  checkNumber: z.string().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
});

const toBuildiumDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date.toISOString().slice(0, 10);
};

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

    const summary = await calculateFinancialSummary(logId, {
      includeOwnerDrawTransactions: true,
    });

    return NextResponse.json({
      ownerDraw: summary.ownerDraw,
      transactions: summary.ownerDrawTransactions ?? [],
      totals: {
        previousNetToOwner: summary.previousBalance,
        totalPayments: summary.totalPayments,
        totalBills: summary.totalBills,
        escrowAmount: summary.escrowAmount,
        managementFees: summary.managementFees,
      },
      netToOwner: summary.netToOwner,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/owner-draw:', error);

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
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
    const body = await request.json().catch(() => null);
    const parsed = OwnerDrawCreateSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: issue?.message ?? 'Invalid request data',
          },
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const entryDate = toBuildiumDate(payload.date);

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
          operating_bank_account_id
        ),
        units:units(
          id,
          property_id,
          buildium_property_id,
          buildium_unit_id
        )
      `,
      )
      .eq('id', logId)
      .maybeSingle();

    if (logError) throw logError;
    if (!monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const unitRecord = Array.isArray(monthlyLog.units) ? monthlyLog.units[0] : monthlyLog.units;
    const propertyRecord = Array.isArray(monthlyLog.properties)
      ? monthlyLog.properties[0]
      : monthlyLog.properties;

    let propertyId =
      monthlyLog.property_id ?? unitRecord?.property_id ?? propertyRecord?.id ?? null;
    const unitId = monthlyLog.unit_id ?? unitRecord?.id ?? null;
    let orgId = monthlyLog.org_id ?? propertyRecord?.org_id ?? null;
    let buildiumPropertyId =
      unitRecord?.buildium_property_id ?? propertyRecord?.buildium_property_id ?? null;
    const buildiumUnitId = unitRecord?.buildium_unit_id ?? null;
    let operatingBankAccountId = propertyRecord?.operating_bank_account_id ?? null;

    if (!operatingBankAccountId && propertyId) {
      const { data: propertyRow, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('id, org_id, buildium_property_id, operating_bank_account_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (propertyError) throw propertyError;

      if (propertyRow) {
        propertyId = propertyRow.id;
        orgId = orgId ?? propertyRow.org_id ?? null;
        buildiumPropertyId = buildiumPropertyId ?? propertyRow.buildium_property_id ?? null;
        operatingBankAccountId = propertyRow.operating_bank_account_id ?? operatingBankAccountId;
      }
    }

    if (!propertyId || !unitId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Link this monthly log to a property and unit before recording an owner draw.',
          },
        },
        { status: 422 },
      );
    }

    if (!buildiumPropertyId || !buildiumUnitId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message:
              'Sync this property and unit with Buildium before creating an owner draw check.',
          },
        },
        { status: 422 },
      );
    }

    const bankAccountId = operatingBankAccountId ?? null;
    if (!bankAccountId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Add an operating bank account to this property before recording an owner draw.',
          },
        },
        { status: 422 },
      );
    }

    const { data: bankAccountRow, error: bankAccountError } = await supabaseAdmin
      .from('bank_accounts')
      .select('id, name, buildium_bank_id, gl_account, org_id')
      .eq('id', bankAccountId)
      .maybeSingle();

    if (bankAccountError) throw bankAccountError;
    if (!bankAccountRow) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Operating bank account not found.',
          },
        },
        { status: 422 },
      );
    }

    const bankAccountBuildiumIdRaw = bankAccountRow.buildium_bank_id;
    const bankAccountBuildiumId =
      typeof bankAccountBuildiumIdRaw === 'number'
        ? bankAccountBuildiumIdRaw
        : typeof bankAccountBuildiumIdRaw === 'string' &&
            Number.isFinite(Number(bankAccountBuildiumIdRaw))
          ? Number(bankAccountBuildiumIdRaw)
          : null;

    if (bankAccountBuildiumId == null) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Operating bank account is missing a Buildium Bank ID.',
          },
        },
        { status: 422 },
      );
    }

    // Resolve GL account by Buildium bank ID first (preferred), then fall back to stored gl_account.
    let bankGlAccountId: string | null = null;
    let bankGlAccountBuildiumId: number | null = null;

    if (bankAccountBuildiumId != null) {
      const { data: glAccountByBuildium, error: glAccountByBuildiumError } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, buildium_gl_account_id')
        .eq('buildium_gl_account_id', bankAccountBuildiumId)
        .maybeSingle();
      if (glAccountByBuildiumError) throw glAccountByBuildiumError;
      if (glAccountByBuildium?.id) {
        bankGlAccountId = glAccountByBuildium.id;
      }
      if (
        glAccountByBuildium &&
        typeof glAccountByBuildium.buildium_gl_account_id === 'number' &&
        Number.isFinite(glAccountByBuildium.buildium_gl_account_id)
      ) {
        bankGlAccountBuildiumId = glAccountByBuildium.buildium_gl_account_id;
      }
    }

    if (!bankGlAccountBuildiumId && bankAccountRow.gl_account) {
      const { data: bankGlAccountRow, error: bankGlError } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, buildium_gl_account_id')
        .eq('id', bankAccountRow.gl_account)
        .maybeSingle();

      if (bankGlError) throw bankGlError;

      const mappedBuildium =
        bankGlAccountRow?.buildium_gl_account_id ??
        (typeof bankGlAccountRow?.buildium_gl_account_id === 'string'
          ? Number(bankGlAccountRow.buildium_gl_account_id)
          : null);

      if (typeof mappedBuildium === 'number' && Number.isFinite(mappedBuildium)) {
        bankGlAccountBuildiumId = mappedBuildium;
      }
      bankGlAccountId = bankGlAccountRow?.id ?? bankGlAccountId;
    }

    if (!bankGlAccountBuildiumId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Operating bank account GL is missing a Buildium mapping.',
          },
        },
        { status: 422 },
      );
    }

    if (!bankGlAccountId || typeof bankGlAccountId !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Operating bank account GL must be synced locally before creating an owner draw.',
          },
        },
        { status: 422 },
      );
    }

    if (!bankGlAccountBuildiumId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Operating bank account GL is missing a Buildium mapping.',
          },
        },
        { status: 422 },
      );
    }

    const { data: ownerDrawAccount, error: ownerDrawError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, buildium_gl_account_id')
      .eq('org_id', orgId ?? bankAccountRow.org_id ?? '')
      .ilike('name', 'owner draw')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ownerDrawError) throw ownerDrawError;

    const ownerDrawGlBuildiumIdRaw = ownerDrawAccount?.buildium_gl_account_id ?? null;
    const ownerDrawGlBuildiumId =
      typeof ownerDrawGlBuildiumIdRaw === 'number'
        ? ownerDrawGlBuildiumIdRaw
        : typeof ownerDrawGlBuildiumIdRaw === 'string' &&
            Number.isFinite(Number(ownerDrawGlBuildiumIdRaw))
          ? Number(ownerDrawGlBuildiumIdRaw)
          : null;

    if (!ownerDrawAccount || ownerDrawGlBuildiumId == null) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Owner Draw GL account is missing a Buildium mapping.',
          },
        },
        { status: 422 },
      );
    }

    const { data: ownershipRow, error: ownershipError } = await supabaseAdmin
      .from('ownerships')
      .select(
        `
        owner_id,
        owners!inner(
          id,
          buildium_owner_id
        )
      `,
      )
      .eq('property_id', propertyId)
      .eq('owner_id', payload.payeeId)
      .maybeSingle<OwnershipRow>();

    if (ownershipError) throw ownershipError;
    const payee = ownershipRow?.owners ?? null;

    if (!payee || typeof payee.buildium_owner_id !== 'number') {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message:
              'Selected owner is missing a Buildium Owner ID. Update the owner record and try again.',
          },
        },
        { status: 422 },
      );
    }

    const buildiumOwnerId = Number(payee.buildium_owner_id);
    const buildiumBankAccountId = bankAccountBuildiumId;
    const buildiumUnitIdNumber = Number(buildiumUnitId);
    const buildiumPropertyIdNumber = Number(buildiumPropertyId);

    if (
      !Number.isFinite(buildiumBankAccountId) ||
      !Number.isFinite(buildiumUnitIdNumber) ||
      !Number.isFinite(buildiumPropertyIdNumber)
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message:
              'Buildium mappings for the property, unit, or bank account are missing or invalid.',
          },
        },
        { status: 422 },
      );
    }

    const buildiumPayload = {
      Payee: {
        Id: buildiumOwnerId,
        Type: 'RentalOwner' as const,
      },
      EntryDate: entryDate,
      CheckNumber: payload.checkNumber || null,
      Memo: payload.memo || null,
      // Buildium auto-credits the bank account on checks; we send the owner draw GL as the debit line.
      Lines: [
        {
          GLAccountId: ownerDrawGlBuildiumId,
          Amount: payload.amount,
          Memo: payload.memo || null,
          ReferenceNumber: payload.referenceNumber || null,
          AccountingEntity: {
            Id: buildiumPropertyIdNumber,
            AccountingEntityType: 'Rental' as const,
            UnitId: buildiumUnitIdNumber || undefined,
          },
        },
      ],
    };

    BuildiumCheckCreateSchema.parse(buildiumPayload);

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bankaccounts/${buildiumBankAccountId}/checks`;
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
      const details: BuildiumErrorDetail = await response
        .json()
        .catch(() => ({} as BuildiumErrorDetail));
      const message =
        details?.UserMessage ||
        details?.error ||
        (Array.isArray(details?.Errors)
          ? details.Errors.map((entry: { Key?: string | null; Value?: string | null }) =>
              `${entry?.Key ?? 'Field'}: ${entry?.Value ?? 'Invalid'}`,
            ).join('; ')
          : undefined) ||
        'Buildium rejected the owner draw check. Verify mappings and try again.';

      console.error('Buildium owner draw creation failed', response.status, details);

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

    const buildiumCheck = await response.json().catch(() => ({}));
    const nowIso = new Date().toISOString();

    const { data: transactionRow, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        date: payload.date,
        memo: payload.memo ?? null,
        total_amount: payload.amount,
        transaction_type: 'GeneralJournalEntry',
        created_at: nowIso,
        updated_at: nowIso,
        org_id: orgId ?? bankAccountRow.org_id ?? null,
        status: 'Paid',
        email_receipt: false,
        print_receipt: false,
        monthly_log_id: logId,
        reference_number: payload.referenceNumber ?? null,
        check_number:
          payload.checkNumber ??
          buildiumCheck?.CheckNumber ??
          buildiumCheck?.checkNumber ??
          null,
        bank_account_id: bankAccountRow.id,
        buildium_transaction_id:
          typeof buildiumCheck?.Id === 'number'
            ? buildiumCheck.Id
            : typeof buildiumCheck?.id === 'number'
              ? buildiumCheck.id
              : null,
      })
      .select('id')
      .maybeSingle();

    if (transactionError || !transactionRow) {
      console.error('Failed to insert owner draw transaction', transactionError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to save owner draw transaction' } },
        { status: 500 },
      );
    }

    const laterIso = new Date(Date.now() + 1000).toISOString();
    const lineRows = [
      {
        transaction_id: transactionRow.id,
        date: payload.date,
        gl_account_id: ownerDrawAccount.id,
        memo: payload.memo ?? null,
        amount: payload.amount,
        posting_type: 'Credit',
        account_entity_type: 'Rental' as const,
        account_entity_id: buildiumPropertyIdNumber,
        property_id: propertyId,
        unit_id: unitId,
        buildium_property_id: buildiumPropertyIdNumber,
        buildium_unit_id: buildiumUnitIdNumber,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        transaction_id: transactionRow.id,
        date: payload.date,
        gl_account_id: bankGlAccountId,
        memo: payload.memo ?? null,
        amount: payload.amount,
        posting_type: 'Debit',
        account_entity_type: 'Rental' as const,
        account_entity_id: buildiumPropertyIdNumber,
        property_id: propertyId,
        unit_id: unitId,
        buildium_property_id: buildiumPropertyIdNumber,
        buildium_unit_id: buildiumUnitIdNumber,
        created_at: laterIso,
        updated_at: laterIso,
      },
    ];

    const { error: lineError } = await supabaseAdmin.from('transaction_lines').insert(lineRows);
    if (lineError) {
      console.error('Failed to insert owner draw lines', lineError);
      await supabaseAdmin.from('transactions').delete().eq('id', transactionRow.id);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to save owner draw lines' } },
        { status: 500 },
      );
    }

    await assignTransactionToMonthlyLog(transactionRow.id, logId, supabaseAdmin);
    await refreshMonthlyLogTotals(logId);
    const record = await fetchTransactionWithLines(transactionRow.id, supabaseAdmin);
    const transaction: MonthlyLogTransaction =
      record?.transaction
        ? {
            id: record.transaction.id,
            total_amount: record.transaction.total_amount,
            memo: record.transaction.memo ?? null,
            date: record.transaction.date,
            transaction_type: record.transaction.transaction_type,
            lease_id: record.transaction.lease_id ?? null,
            monthly_log_id: record.transaction.monthly_log_id ?? null,
            reference_number: record.transaction.reference_number ?? null,
            account_name: (record.transaction as { account_name?: string | null }).account_name ?? null,
          }
        : {
            id: transactionRow.id,
            total_amount: payload.amount,
            memo: payload.memo ?? null,
            date: payload.date,
            transaction_type: 'GeneralJournalEntry',
            lease_id: null,
            monthly_log_id: logId,
            reference_number: payload.referenceNumber ?? null,
            account_name: ownerDrawAccount.name ?? 'Owner Draw',
          };

    return NextResponse.json(
      {
        data: {
          transaction: {
            ...transaction,
            account_name: ownerDrawAccount.name ?? 'Owner Draw',
          },
          lines: record?.lines ?? lineRows,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/owner-draw:', error);

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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid owner draw payload' } },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
