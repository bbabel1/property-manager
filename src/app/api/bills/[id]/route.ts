import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers';
import { buildiumFetch } from '@/lib/buildium-http';
import { logger } from '@/lib/logger';
import { assertTransactionBalanced, DOUBLE_ENTRY_TOLERANCE } from '@/lib/accounting-validation';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { requireOrgMember } from '@/lib/auth/org-guards';
import type { Database as DatabaseSchema } from '@/types/database';
import {
  RecurringBillScheduleSchema,
  RecurringBillScheduleJsonbSchema,
  computeNextRunDate,
  mapDisplayLabelToFrequency,
  type RecurringBillSchedule,
} from '@/types/recurring-bills';
import { getOrgTimezone } from '@/lib/org-timezone';

type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];
type BillLinePayload = {
  gl_account_id: string;
  amount: number;
  memo?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, roles } = await requireAuth();
    if (!hasPermission(roles, 'bills.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { data: scopedBill, error: scopedBillErr } = await supabase
      .from('transactions')
      .select('id, org_id, transaction_type')
      .eq('id', id)
      .eq('transaction_type', 'Bill')
      .maybeSingle();

    if (scopedBillErr) {
      return NextResponse.json({ error: scopedBillErr.message }, { status: 500 });
    }
    if (!scopedBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const orgId = String((scopedBill as any).org_id);
    await requireOrgMember({ client: supabase, userId: user.id, orgId });

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select(
        '*, org_id, bill_workflow:bill_workflow(*), bill_applications:bill_applications(id, applied_amount, source_transaction_id, source_type, applied_at, created_at, updated_at)',
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('transaction_type', 'Bill')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    logger.error({ error }, 'Unexpected error fetching bill');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const admin = requireSupabaseAdmin('update bill');
  const nowIso = new Date().toISOString();

  const { data: billRow, error: billErr } = await admin
    .from('transactions')
    .select('id, org_id, transaction_type')
    .eq('id', id)
    .eq('transaction_type', 'Bill')
    .maybeSingle();
  if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });
  if (!billRow) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  const orgId = String((billRow as any).org_id);
  await requireOrgMember({ client: supabase, userId: user.id, orgId });

  const { data: workflowRow } = await admin
    .from('bill_workflow')
    .select('approval_state')
    .eq('bill_transaction_id', id)
    .eq('org_id', orgId)
    .maybeSingle();
  const approvalState = (workflowRow as any)?.approval_state ?? 'draft';
  if (approvalState === 'approved') {
    const blockedKeys = ['date', 'due_date', 'vendor_id', 'status', 'transaction_type', 'bill_transaction_id'];
    if (blockedKeys.some((key) => key in payload)) {
      return NextResponse.json(
        { error: 'Approved bills cannot be edited. Void or reject to change amounts.' },
        { status: 409 },
      );
    }
    // Treat recurrence settings as "structural" like lines/amounts
    if ('is_recurring' in payload || 'recurring_schedule' in payload) {
      return NextResponse.json(
        { error: 'Approved bills cannot modify recurring settings. Void or reject to change recurrence.' },
        { status: 409 },
      );
    }
  }

  const update: Record<string, unknown> = {};
  if ('date' in payload) update.date = payload.date || null;
  if ('due_date' in payload) update.due_date = payload.due_date || null;
  if ('vendor_id' in payload) update.vendor_id = payload.vendor_id || null;
  if ('reference_number' in payload) update.reference_number = payload.reference_number || null;
  if ('memo' in payload) update.memo = payload.memo || null;
  update.updated_at = nowIso;

  // Handle recurring bill settings
  if ('is_recurring' in payload || 'recurring_schedule' in payload) {
    const isRecurring = payload.is_recurring === true;
    const recurringSchedule = payload.recurring_schedule;

    if (isRecurring && recurringSchedule) {
      // Map display labels to canonical frequencies
      if (recurringSchedule.frequency && typeof recurringSchedule.frequency === 'string') {
        const canonical = mapDisplayLabelToFrequency(recurringSchedule.frequency);
        if (canonical) {
          recurringSchedule.frequency = canonical;
        }
      }

      // Strip server-owned fields
      delete (recurringSchedule as any).next_run_date;
      delete (recurringSchedule as any).last_generated_at;

      // Validate schedule using Zod schema
      const validationResult = RecurringBillScheduleSchema.safeParse(recurringSchedule);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid recurring schedule',
            details: validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          },
          { status: 400 },
        );
      }

      const validatedSchedule = validationResult.data;

      // Get bill date for validation
      const { data: currentBill } = await admin
        .from('transactions')
        .select('date')
        .eq('id', id)
        .maybeSingle();
      const billDate = currentBill?.date || new Date().toISOString().slice(0, 10);

      // Validate start_date >= bill.date
      if (validatedSchedule.start_date < billDate) {
        return NextResponse.json(
          { error: 'start_date must be on or after the bill date' },
          { status: 400 },
        );
      }

      // Validate end_date not in past on create
      const todayStr = new Date().toISOString().slice(0, 10);
      if (validatedSchedule.end_date && validatedSchedule.end_date < todayStr) {
        return NextResponse.json(
          { error: 'end_date cannot be in the past' },
          { status: 400 },
        );
      }

      // Get org timezone
      const orgTimezone = await getOrgTimezone(orgId);

      // Compute next_run_date
      const nextRunDate = computeNextRunDate(validatedSchedule, orgTimezone);

      // Build namespaced schedule JSONB
      const scheduleJsonb: { schedule: RecurringBillSchedule } = {
        schedule: {
          ...validatedSchedule,
          next_run_date: nextRunDate,
          last_generated_at: null, // Will be set by generation engine
        },
      };

      update.is_recurring = true;
      update.recurring_schedule = scheduleJsonb;
    } else if (isRecurring === false) {
      // Disabling recurrence
      update.is_recurring = false;
      // Keep existing recurring_schedule for history, but mark as ended if it exists
      const { data: currentBill } = await admin
        .from('transactions')
        .select('recurring_schedule')
        .eq('id', id)
        .maybeSingle();
      if (currentBill?.recurring_schedule && typeof currentBill.recurring_schedule === 'object') {
        const currentSchedule = currentBill.recurring_schedule as any;
        if (currentSchedule?.schedule) {
          update.recurring_schedule = {
            ...currentSchedule,
            schedule: {
              ...currentSchedule.schedule,
              status: 'ended',
              ended_at: nowIso,
            },
          };
        }
      }
    }
  }

  // Handle pause/resume/disable actions
  if (payload.recurring_action === 'pause' || payload.recurring_action === 'resume' || payload.recurring_action === 'disable') {
    const { data: currentBill } = await admin
      .from('transactions')
      .select('recurring_schedule, is_recurring')
      .eq('id', id)
      .maybeSingle();

    if (!currentBill?.is_recurring || !currentBill?.recurring_schedule) {
      return NextResponse.json(
        { error: 'Bill is not set up for recurrence' },
        { status: 400 },
      );
    }

    const currentSchedule = currentBill.recurring_schedule as any;
    if (!currentSchedule?.schedule) {
      return NextResponse.json(
        { error: 'Invalid recurring schedule structure' },
        { status: 400 },
      );
    }

    const orgTimezone = await getOrgTimezone(orgId);

    if (payload.recurring_action === 'pause') {
      update.recurring_schedule = {
        ...currentSchedule,
        schedule: {
          ...currentSchedule.schedule,
          status: 'paused',
        },
      };
    } else if (payload.recurring_action === 'resume') {
      const schedule = currentSchedule.schedule as RecurringBillSchedule;
      const nextRunDate = computeNextRunDate({ ...schedule, status: 'active' }, orgTimezone);
      update.recurring_schedule = {
        ...currentSchedule,
        schedule: {
          ...schedule,
          status: 'active',
          next_run_date: nextRunDate,
        },
      };
    } else if (payload.recurring_action === 'disable') {
      update.recurring_schedule = {
        ...currentSchedule,
        schedule: {
          ...currentSchedule.schedule,
          status: 'ended',
          ended_at: nowIso,
        },
      };
    }
  }

  // If approved, block amount/line changes
  if (approvalState === 'approved' && Array.isArray(payload?.lines)) {
    return NextResponse.json(
      { error: 'Approved bills cannot be edited. Void or reject to change amounts.' },
      { status: 409 },
    );
  }

  const { data: header, error } = await admin
    .from('transactions')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, date, due_date, vendor_id, reference_number, memo')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let debitTotal: number | null = null;
  if (Array.isArray(payload?.lines)) {
    // Fetch existing lines to preserve metadata before deletion
    const { data: existingLines } = await admin
      .from('transaction_lines')
      .select(
        'gl_account_id, memo, account_entity_type, account_entity_id, property_id, unit_id, buildium_property_id, buildium_unit_id, posting_type',
      )
      .eq('transaction_id', id);

    const existingCredit =
      existingLines?.filter((l) => l.posting_type === 'Credit') || [];

    const providedCreditAccountId = payload?.credit_account_id ?? null;
    const template = existingCredit?.[0] || null;

    // Determine credit line source: existing template or provided fallback gl_account_id
    const creditGlAccountId = template?.gl_account_id || providedCreditAccountId || null;

    // Validate credit GL account BEFORE deleting lines to prevent unbalanced state
    const txDate = payload?.date || header?.date || new Date().toISOString().slice(0, 10);
    const debitRows: TransactionLineInsert[] = payload.lines.map((l: BillLinePayload) => ({
      transaction_id: id,
      gl_account_id: l.gl_account_id,
      amount: Math.abs(Number(l.amount || 0)),
      posting_type: 'Debit' as const,
      memo: l.memo ?? null,
      account_entity_type: 'Rental' as const,
      account_entity_id: null,
      date: txDate,
      created_at: nowIso,
      updated_at: nowIso,
      property_id: l.property_id || null,
      unit_id: l.unit_id || null,
      buildium_property_id: null,
      buildium_unit_id: null,
      buildium_lease_id: null,
    }));

    debitTotal = debitRows.reduce((s, r) => s + Number(r.amount || 0), 0);

    if (debitTotal > 0 && !creditGlAccountId) {
      return NextResponse.json(
        { error: 'A balancing credit GL account is required when updating bill lines' },
        { status: 400 },
      );
    }

    // Check for multi-property scenario - for now, reject if debits span multiple properties
    const uniquePropertyIds = new Set(
      debitRows.map((r) => r.property_id).filter((id): id is string => id != null),
    );
    if (uniquePropertyIds.size > 1) {
      return NextResponse.json(
        {
          error:
            'Bill lines cannot span multiple properties. Please update one property at a time.',
        },
        { status: 400 },
      );
    }

    // Build all lines (debits + credit) for atomic replacement
    const allLines = [...debitRows];
    if (debitTotal > 0 && creditGlAccountId) {
      // Preserve metadata from existing credit line template
      allLines.push({
        transaction_id: id,
        gl_account_id: creditGlAccountId,
        amount: debitTotal,
        posting_type: 'Credit' as const,
        memo: template?.memo ?? payload?.memo ?? null,
        account_entity_type: template?.account_entity_type || 'Company',
        account_entity_id: template?.account_entity_id ?? null,
        date: txDate,
        created_at: nowIso,
        updated_at: nowIso,
        property_id: template?.property_id ?? debitRows[0]?.property_id ?? null,
        unit_id: template?.unit_id ?? debitRows[0]?.unit_id ?? null,
        buildium_property_id: template?.buildium_property_id ?? null,
        buildium_unit_id: template?.buildium_unit_id ?? null,
        buildium_lease_id: null,
      });
    }

    // Use SQL function for atomic replace with locking and validation
    const { error: replaceError } = await (admin as any).rpc('replace_transaction_lines', {
      p_transaction_id: id,
      p_lines: allLines.map((line) => ({
        gl_account_id: line.gl_account_id,
        amount: line.amount,
        posting_type: line.posting_type,
        memo: line.memo,
        account_entity_type: line.account_entity_type,
        account_entity_id: line.account_entity_id,
        property_id: line.property_id,
        unit_id: line.unit_id,
        buildium_property_id: line.buildium_property_id,
        buildium_unit_id: line.buildium_unit_id,
        buildium_lease_id: line.buildium_lease_id,
        date: line.date,
        created_at: line.created_at,
        updated_at: line.updated_at,
      })),
      p_validate_balance: true,
    });

    if (replaceError) {
      logger.error(
        { error: replaceError, transactionId: id },
        'Failed to replace transaction lines',
      );
      return NextResponse.json(
        { error: replaceError.message || 'Failed to update bill lines' },
        { status: 400 },
      );
    }

    // Additional validation (redundant but provides application-level check)
    try {
      await assertTransactionBalanced(id, admin, DOUBLE_ENTRY_TOLERANCE);
    } catch (validationError) {
      logger.error(
        { error: validationError, transactionId: id },
        'Transaction balance validation failed after replace',
      );
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : 'Transaction balance validation failed',
        },
        { status: 500 },
      );
    }
  }

  // Only update total_amount when we've computed a new debitTotal
  if (debitTotal !== null) {
    if (approvalState === 'approved') {
      return NextResponse.json(
        { error: 'Approved bills cannot change amounts. Void or reject to modify.' },
        { status: 409 },
      );
    }
    await admin
      .from('transactions')
      .update({ total_amount: debitTotal, updated_at: nowIso })
      .eq('id', id)
      .eq('org_id', orgId);
  }

  const { data: billSnapshot, error: billSnapshotError } = await admin
    .from('transactions')
    .select(
      '*, bill_workflow:bill_workflow(*), applications:bill_applications(applied_amount, source_transaction_id, source_type)',
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (billSnapshotError) {
    logger.error(
      { error: billSnapshotError, transactionId: id },
      'Failed to reload bill after update',
    );
    return NextResponse.json(
      { error: billSnapshotError.message ?? 'Failed to reload bill' },
      { status: 500 },
    );
  }
  if (!billSnapshot) {
    return NextResponse.json({ error: 'Bill not found after update' }, { status: 404 });
  }

  // Resolve orgId from billSnapshot
  let orgId = billSnapshot.org_id ?? undefined;

  // If no orgId on transaction, try to resolve from property via transaction_lines
  if (!orgId) {
    const { data: txnLine } = await admin
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', id)
      .not('property_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (txnLine?.property_id) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', txnLine.property_id)
        .maybeSingle();
      if (property?.org_id) {
        orgId = property.org_id;
      }
    }
  }

  let buildiumPayload: Awaited<ReturnType<typeof mapTransactionBillToBuildium>>;
  try {
    buildiumPayload = await mapTransactionBillToBuildium(id, admin);
  } catch (mappingError) {
    logger.error(
      { error: mappingError, transactionId: id },
      'Failed to map bill to Buildium payload',
    );
    return NextResponse.json(
      {
        error: 'Unable to prepare Buildium payload',
        details: mappingError instanceof Error ? mappingError.message : String(mappingError),
        data: billSnapshot,
      },
      { status: 400 },
    );
  }

  const isUpdate =
    typeof billSnapshot.buildium_bill_id === 'number' && billSnapshot.buildium_bill_id > 0;
  const path = isUpdate ? `/bills/${billSnapshot.buildium_bill_id}` : '/bills';

  let buildiumResponseBody: unknown = null;
  let buildiumStatus = 0;
  try {
    const buildiumResponse = await buildiumFetch(isUpdate ? 'PUT' : 'POST', path, undefined, buildiumPayload, orgId);
    buildiumStatus = buildiumResponse.status;
    buildiumResponseBody = buildiumResponse.json ?? null;

    if (!buildiumResponse.ok) {
      logger.error(
        { transactionId: id, status: buildiumStatus, buildiumResponseBody },
        'Buildium bill sync failed',
      );
      return NextResponse.json(
        {
          error: describeBuildiumError(buildiumResponseBody) ?? 'Failed to sync bill to Buildium',
          data: billSnapshot,
          buildium: {
            success: false,
            status: buildiumStatus,
            payload: buildiumResponseBody,
          },
        },
        { status: buildiumStatus },
      );
    }
  } catch (buildiumError) {
    logger.error({ error: buildiumError, transactionId: id }, 'Buildium bill sync request failed');
    return NextResponse.json(
      {
        error: 'Buildium sync request failed',
        details: buildiumError instanceof Error ? buildiumError.message : String(buildiumError),
        data: billSnapshot,
        buildium: {
          success: false,
          status: 502,
          payload: null,
        },
      },
      { status: 502 },
    );
  }

  if (!isUpdate) {
    const bodyWithId = buildiumResponseBody as { Id?: number } | null;
    const newBuildiumId = typeof bodyWithId?.Id === 'number' ? bodyWithId.Id : null;
    if (newBuildiumId) {
      await admin
        .from('transactions')
        .update({ buildium_bill_id: newBuildiumId, updated_at: new Date().toISOString() })
        .eq('id', id);
      billSnapshot.buildium_bill_id = newBuildiumId;
    }
  }

  const buildiumResult = {
    success: true,
    status: buildiumStatus,
    payload: buildiumResponseBody,
  };

  return NextResponse.json({ data: billSnapshot, buildium: buildiumResult });
}


function describeBuildiumError(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    const recordPayload = payload as Record<string, unknown>;
    const messageCandidate =
      typeof recordPayload.Message === 'string'
        ? (recordPayload.Message as string)
        : typeof recordPayload.message === 'string'
          ? (recordPayload.message as string)
          : null;
    if (messageCandidate) return messageCandidate;
    const errors = recordPayload.Errors;
    if (Array.isArray(errors)) {
      const joined = errors
        .map((err) => {
          if (typeof err === 'object' && err !== null) {
            const errRecord = err as Record<string, unknown>;
            if (typeof errRecord.Message === 'string') return errRecord.Message;
            if (typeof errRecord.message === 'string') return errRecord.message;
          }
          return null;
        })
        .filter((msg): msg is string => Boolean(msg));
      if (joined.length) return joined.join('; ');
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }
  return String(payload);
}

type DeleteRequestBody = {
  buildiumConfirmation?: {
    token?: string;
    issuedAt?: string;
  };
};

async function parseDeleteBody(request: Request): Promise<DeleteRequestBody | null> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

type BuildiumSyncResult = {
  success: true;
  status: number;
  payload: unknown;
};

class BuildiumSyncError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type BuildiumBillPayload = Awaited<ReturnType<typeof mapTransactionBillToBuildium>>;
// Buildium validation appears to require amounts strictly greater than 0.01,
// so pad the minimum value slightly above one cent.
const MIN_BUILDIUM_LINE_AMOUNT = 0.02;

async function zeroBillInBuildium(
  transactionId: string,
  buildiumBillId: number,
  admin: ReturnType<typeof requireSupabaseAdmin>,
): Promise<BuildiumSyncResult> {
  // Resolve orgId from transaction
  const { data: tx } = await admin
    .from('transactions')
    .select('org_id')
    .eq('id', transactionId)
    .maybeSingle();

  let orgId = tx?.org_id ?? undefined;

  // If no orgId on transaction, try to resolve from property via transaction_lines
  if (!orgId) {
    const { data: txnLine } = await admin
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', transactionId)
      .not('property_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (txnLine?.property_id) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', txnLine.property_id)
        .maybeSingle();
      if (property?.org_id) {
        orgId = property.org_id;
      }
    }
  }

  let payload;
  try {
    payload = await mapTransactionBillToBuildium(transactionId, admin);
  } catch (error) {
    throw new BuildiumSyncError(
      error instanceof Error ? error.message : 'Failed to prepare Buildium payload',
      400,
      null,
    );
  }
  const zeroPayload = buildZeroOutPayload(payload);
  const response = await buildiumFetch('PUT', `/bills/${buildiumBillId}`, undefined, zeroPayload, orgId);
  const body = response.json ?? null;
  if (!response.ok) {
    const message = describeBuildiumError(body) ?? 'Failed to update bill in Buildium';
    throw new BuildiumSyncError(message, response.status, body);
  }
  return {
    success: true,
    status: response.status,
    payload: body,
  };
}

type BuildiumDeletionConfirmation = {
  token: string;
  issuedAt: string;
  expiresAt: string;
};

function createBuildiumDeletionConfirmation(billId: string): BuildiumDeletionConfirmation {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const token = signBuildiumDeletionConfirmation(billId, issuedAt);
  return { token, issuedAt, expiresAt };
}

function validateBuildiumDeletionConfirmation(
  billId: string,
  payload: DeleteRequestBody['buildiumConfirmation'],
): boolean {
  if (!payload?.token || !payload?.issuedAt) return false;
  const issuedDate = new Date(payload.issuedAt);
  if (Number.isNaN(issuedDate.getTime())) return false;
  if (Date.now() - issuedDate.getTime() > 10 * 60 * 1000) return false;
  const expected = signBuildiumDeletionConfirmation(billId, payload.issuedAt);
  return expected === payload.token;
}

function signBuildiumDeletionConfirmation(billId: string, issuedAt: string): string {
  const secret = getBuildiumConfirmationSecret();
  return createHmac('sha256', secret).update(`${billId}:${issuedAt}`).digest('hex');
}

function getBuildiumConfirmationSecret(): string {
  // Note: BILL_DELETE_CONFIRM_SECRET is a separate secret for deletion confirmation
  // If not set, we can't use BUILDIUM_CLIENT_SECRET from env (violates org-scoped pattern)
  // For now, require BILL_DELETE_CONFIRM_SECRET to be set explicitly
  const secret = process.env.BILL_DELETE_CONFIRM_SECRET;
  if (!secret) {
    throw new Error(
      'Missing BILL_DELETE_CONFIRM_SECRET for bill deletion confirmation',
    );
  }
  return secret;
}

function buildZeroOutPayload(payload: BuildiumBillPayload) {
  const zeroLines = normalizeZeroLines(payload.Lines);
  return {
    ...payload,
    Amount: 0,
    Lines: zeroLines,
  };
}

function normalizeZeroLines(
  originalLines: BuildiumBillPayload['Lines'],
): NonNullable<BuildiumBillPayload['Lines']> {
  if (!Array.isArray(originalLines) || originalLines.length === 0) {
    throw new BuildiumSyncError('Bill has no lines to zero out in Buildium', 400, null);
  }

  const debitLines = originalLines.filter((line) => Number(line?.Amount ?? 0) > 0);
  const creditLines = originalLines.filter((line) => Number(line?.Amount ?? 0) < 0);

  if (debitLines.length === 0) {
    throw new BuildiumSyncError('Bill has no debit lines to zero out', 400, null);
  }
  if (creditLines.length === 0) {
    throw new BuildiumSyncError('Bill has no credit line to balance zero-out', 400, null);
  }

  const zeroedDebits = debitLines.map((line) => ({
    ...line,
    Amount: MIN_BUILDIUM_LINE_AMOUNT,
  }));

  const totalDebitAmount = Number((zeroedDebits.length * MIN_BUILDIUM_LINE_AMOUNT).toFixed(2));
  const creditTemplate = creditLines[0];
  const zeroedCredit = {
    ...creditTemplate,
    Amount: totalDebitAmount > 0 ? -totalDebitAmount : -MIN_BUILDIUM_LINE_AMOUNT,
  };

  return [...zeroedDebits, zeroedCredit];
}

const SHOULD_SYNC_BUILDUM_DELETE = process.env.BILL_DELETE_BUILDIUM_SYNC === '1';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = requireSupabaseAdmin('delete bill');
  const requestBody = await parseDeleteBody(request);
  const confirmationPayload = requestBody?.buildiumConfirmation ?? null;

  const { data: bill, error } = await admin
    .from('transactions')
    .select('id, transaction_type, buildium_bill_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  if (bill.transaction_type !== 'Bill') {
    return NextResponse.json({ error: 'Transaction is not a bill' }, { status: 400 });
  }

  const buildiumBillId =
    typeof bill.buildium_bill_id === 'number' && bill.buildium_bill_id > 0 ? bill.buildium_bill_id : null;

  // Hard delete guardrails: only drafts, no applications, not synced
  if (buildiumBillId) {
    return NextResponse.json(
      { error: 'Cannot hard delete a bill that is synced to Buildium. Void instead.' },
      { status: 400 },
    );
  }

  const { data: workflow } = await admin
    .from('bill_workflow')
    .select('approval_state')
    .eq('bill_transaction_id', id)
    .maybeSingle();

  const approvalState = (workflow as any)?.approval_state ?? 'draft';
  if (approvalState !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft bills without applications can be hard deleted. Use void instead.' },
      { status: 400 },
    );
  }

  const { count: applicationCount } = await admin
    .from('bill_applications')
    .select('id', { count: 'exact', head: true })
    .eq('bill_transaction_id', id);

  if ((applicationCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a bill with payment or credit applications. Use void instead.' },
      { status: 400 },
    );
  }

  if (SHOULD_SYNC_BUILDUM_DELETE && buildiumBillId) {
    if (!confirmationPayload) {
      try {
        const buildiumResult = await zeroBillInBuildium(id, buildiumBillId, admin);
        const confirmation = createBuildiumDeletionConfirmation(id);
        return NextResponse.json({
          confirmationRequired: true,
          message: 'Buildium bill updated. Review and confirm to delete locally.',
          buildium: buildiumResult,
          confirmation,
        });
      } catch (error) {
        if (error instanceof BuildiumSyncError) {
          logger.error(
            {
              error,
              transactionId: id,
              buildiumStatus: error.status,
              buildiumPayload: error.payload,
            },
            'Buildium zero-out before deletion failed',
          );
          return NextResponse.json(
            {
              error: error.message,
              buildium: { success: false, status: error.status, payload: error.payload },
            },
            { status: error.status },
          );
        }
        logger.error(
          { error, transactionId: id },
          'Unexpected error while zeroing bill in Buildium',
        );
        return NextResponse.json({ error: 'Failed to update bill in Buildium' }, { status: 502 });
      }
    }

    if (!validateBuildiumDeletionConfirmation(id, confirmationPayload)) {
      return NextResponse.json(
        { error: 'Buildium response confirmation is invalid or expired' },
        { status: 400 },
      );
    }
  } else if (buildiumBillId) {
    logger.info({ transactionId: id, buildiumBillId }, 'Skipping Buildium delete sync (disabled)');
  }

  const { error: deleteLinesError } = await admin
    .from('transaction_lines')
    .delete()
    .eq('transaction_id', id);

  if (deleteLinesError) {
    return NextResponse.json({ error: deleteLinesError.message }, { status: 500 });
  }

  const { error: deleteBillError } = await admin.from('transactions').delete().eq('id', id);

  if (deleteBillError) {
    return NextResponse.json({ error: deleteBillError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
