import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client';
import { resolveUserOrgId, userHasOrgAccess } from '@/lib/auth/org-access';
import {
  COMPANY_SENTINEL,
  JournalEntryPayload,
  journalEntrySchemaBase,
  normalizeJournalLines,
  cleanJournalMemo,
} from '@/lib/journal-entries';

type RouteParams = {
  transactionId: string;
};

type Logger = (reason: string, extra?: Record<string, unknown>, level?: 'warn' | 'error') => void;

const createLogIssue = (
  action: 'delete' | 'patch',
  context: { transactionId: string; propertyId?: string | null },
): Logger => {
  return (reason, extra = {}, level: 'warn' | 'error' = 'warn') => {
    const payload = {
      reason,
      transactionId: context.transactionId,
      propertyId: context.propertyId,
      ...extra,
    };
    const method = level === 'error' ? console.error : console.warn;
    method(`[api/journal-entries][${action}]`, payload);
  };
};

export async function DELETE(request: Request, { params }: { params: Promise<RouteParams> }) {
  const { transactionId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const propertyId = searchParams.get('propertyId')?.trim();
  const logContext = { transactionId, propertyId };
  const logIssue = createLogIssue('delete', logContext);

  if (!propertyId) {
    logIssue('missing propertyId search param');
    return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  }
  let auth;
  try {
    auth = await requireAuth();
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      logIssue('unauthenticated request blocked');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    logIssue('auth guard failed unexpectedly', { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Unable to verify authentication' }, { status: 500 });
  }

  let admin;
  try {
    admin = requireSupabaseAdmin('delete journal entry');
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      logIssue('supabase admin client unavailable');
      return NextResponse.json({ error: 'Server is not configured for writes' }, { status: 501 });
    }
    logIssue('supabase admin creation failed', { error: String(error) }, 'error');
    throw error;
  }

  const { supabase, user } = auth;
  const { data: property, error: propertyError } = await admin
    .from('properties')
    .select('id, org_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError) {
    logIssue(
      'failed to load property',
      { supabaseError: { message: propertyError.message, hint: propertyError.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to load property' }, { status: 500 });
  }

  if (!property) {
    logIssue('property not found');
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }
  const hasOrgAccess = await userHasOrgAccess({
    supabase,
    user,
    orgId: property.org_id,
  });
  if (!hasOrgAccess) {
    logIssue('user lacks org access', { orgId: property.org_id });
    return NextResponse.json({ error: 'You do not have access to this property' }, { status: 403 });
  }

  const { data: transaction, error: transactionError } = await admin
    .from('transactions')
    .select('id, transaction_type')
    .eq('id', transactionId)
    .maybeSingle();

  if (transactionError || !transaction) {
    logIssue('transaction not found', {
      supabaseError: transactionError
        ? { message: transactionError.message, hint: transactionError.hint }
        : null,
    });
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  if (transaction.transaction_type !== 'GeneralJournalEntry') {
    logIssue('transaction is not a general journal entry', {
      transactionType: transaction.transaction_type,
    });
    return NextResponse.json(
      { error: 'Only general journal entries can be deleted via this endpoint.' },
      { status: 400 },
    );
  }

  const { data: journalEntry, error: journalError } = await admin
    .from('journal_entries')
    .select('id, transaction_id, buildium_gl_entry_id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (journalError) {
    logIssue(
      'failed to load journal entry',
      { supabaseError: { message: journalError.message, hint: journalError.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to load journal entry' }, { status: 500 });
  }

  if (journalEntry?.buildium_gl_entry_id) {
    logIssue('journal entry already synced to Buildium', {
      buildiumEntryId: journalEntry.buildium_gl_entry_id,
    });
    return NextResponse.json(
      { error: 'This entry has been synced to Buildium and cannot be deleted here.' },
      { status: 409 },
    );
  }

  if (!journalEntry) {
    logIssue('journal entry not found; proceeding without journal_entries row');
  }

  const { data: lines, error: linesError } = await admin
    .from('transaction_lines')
    .select('property_id')
    .eq('transaction_id', transactionId);

  if (linesError) {
    logIssue(
      'failed to load transaction lines',
      { supabaseError: { message: linesError.message, hint: linesError.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to load journal lines' }, { status: 500 });
  }

  if (!lines || lines.length === 0) {
    logIssue('no transaction lines found');
    return NextResponse.json({ error: 'No lines found for this journal entry' }, { status: 404 });
  }

  const propertyMismatch = lines.some(
    (line) => line?.property_id && String(line.property_id) !== propertyId,
  );
  if (propertyMismatch) {
    logIssue('transaction lines belong to another property', {
      linePropertyIds: Array.from(new Set(lines.map((line) => line?.property_id).filter(Boolean))),
    });
    return NextResponse.json(
      { error: 'This journal entry does not belong to the selected property' },
      { status: 403 },
    );
  }

  try {
    await admin.from('transaction_lines').delete().eq('transaction_id', transactionId);
    if (journalEntry?.id) {
      await admin.from('journal_entries').delete().eq('id', journalEntry.id);
    }
    await admin.from('transactions').delete().eq('id', transactionId);
  } catch (error) {
    logIssue('failed while deleting journal entry', { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Unable to delete journal entry' }, { status: 500 });
  }

  logIssue('journal entry deleted successfully');
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request, { params }: { params: Promise<RouteParams> }) {
  const { transactionId } = await params;
  const rawPayload = await request.json().catch(() => null);
  if (!rawPayload) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = journalEntrySchemaBase.safeParse(rawPayload);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message || 'Invalid journal entry payload' }, { status: 400 });
  }

  const data = parsed.data as JournalEntryPayload;
  const propertyId = data.propertyId.trim();
  const logIssue = createLogIssue('patch', { transactionId, propertyId });

  let auth;
  try {
    auth = await requireAuth();
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      logIssue('unauthenticated request blocked');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    logIssue('auth guard failed unexpectedly', { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Unable to verify authentication' }, { status: 500 });
  }

  let admin;
  try {
    admin = requireSupabaseAdmin('update journal entry');
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      logIssue('supabase admin client unavailable');
      return NextResponse.json({ error: 'Server is not configured for writes' }, { status: 501 });
    }
    logIssue('supabase admin creation failed', { error: String(error) }, 'error');
    throw error;
  }

  const isCompanyLevel = propertyId === COMPANY_SENTINEL;
  const { supabase, user } = auth;

  let propertyRow:
    | {
        id: string;
        org_id?: string | null;
        buildium_property_id?: number | null;
        rental_type?: string | null;
      }
    | null = null;

  if (!isCompanyLevel) {
    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('id, org_id, buildium_property_id, rental_type')
      .eq('id', propertyId)
      .maybeSingle();

    if (propertyError) {
      logIssue(
        'failed to load property',
        { supabaseError: { message: propertyError.message, hint: propertyError.hint } },
        'error',
      );
      return NextResponse.json({ error: 'Unable to load property' }, { status: 500 });
    }

    if (!property) {
      logIssue('property not found');
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const hasOrgAccess = await userHasOrgAccess({
      supabase,
      user,
      orgId: property.org_id,
    });
    if (!hasOrgAccess) {
      logIssue('user lacks org access', { orgId: property.org_id });
      return NextResponse.json({ error: 'You do not have access to this property' }, { status: 403 });
    }

    propertyRow = property;
  }

  const { data: journalEntry, error: journalError } = await admin
    .from('journal_entries')
    .select('id, transaction_id, buildium_gl_entry_id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (journalError || !journalEntry) {
    logIssue('journal entry not found', {
      supabaseError: journalError ? { message: journalError.message, hint: journalError.hint } : null,
    });
    return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
  }

  if (journalEntry.buildium_gl_entry_id) {
    logIssue('journal entry already synced to Buildium', {
      buildiumEntryId: journalEntry.buildium_gl_entry_id,
    });
    return NextResponse.json(
      { error: 'This entry has been synced to Buildium and cannot be edited here.' },
      { status: 409 },
    );
  }

  const { data: transaction, error: transactionError } = await admin
    .from('transactions')
    .select('id, transaction_type')
    .eq('id', transactionId)
    .maybeSingle();

  if (transactionError || !transaction) {
    logIssue('transaction not found', {
      supabaseError: transactionError
        ? { message: transactionError.message, hint: transactionError.hint }
        : null,
    });
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  if (transaction.transaction_type !== 'GeneralJournalEntry') {
    logIssue('transaction is not a general journal entry', {
      transactionType: transaction.transaction_type,
    });
    return NextResponse.json(
      { error: 'Only general journal entries can be updated via this endpoint.' },
      { status: 400 },
    );
  }

  let unitRow:
    | {
        id: string;
        property_id?: string | null;
        buildium_unit_id?: number | null;
      }
    | null = null;

  const trimmedUnitId = data.unitId?.trim();
  if (trimmedUnitId) {
    if (isCompanyLevel) {
      logIssue('unit provided for company-level journal entry');
      return NextResponse.json({ error: 'Units cannot be attached to company-level entries' }, { status: 400 });
    }
    const { data: unit, error: unitError } = await admin
      .from('units')
      .select('id, property_id, buildium_unit_id')
      .eq('id', trimmedUnitId)
      .maybeSingle();

    if (unitError) {
      logIssue(
        'failed to load unit',
        { supabaseError: { message: unitError.message, hint: unitError.hint } },
        'error',
      );
      return NextResponse.json({ error: 'Unable to load unit' }, { status: 500 });
    }

    if (!unit) {
      logIssue('unit not found', { unitId: trimmedUnitId });
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (propertyRow && String(unit.property_id) !== propertyRow.id) {
      logIssue('unit does not belong to property', {
        unitId: trimmedUnitId,
        unitPropertyId: unit.property_id,
        propertyId,
      });
      return NextResponse.json({ error: 'Selected unit does not belong to this property' }, { status: 400 });
    }

    unitRow = {
      id: String(unit.id),
      property_id: unit.property_id ? String(unit.property_id) : null,
      buildium_unit_id: unit.buildium_unit_id ?? null,
    };
  } else if (!isCompanyLevel) {
    unitRow = null;
  }

  let normalizedLines: ReturnType<typeof normalizeJournalLines>;
  try {
    normalizedLines = normalizeJournalLines(data.lines);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid line items';
    logIssue('failed to normalize journal lines', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const accountIds = Array.from(new Set(normalizedLines.lines.map((line) => line.accountId)));
  if (accountIds.length === 0) {
    logIssue('payload missing account ids');
    return NextResponse.json({ error: 'At least one account is required.' }, { status: 400 });
  }

  const { data: accountRows, error: accountError } = await admin
    .from('gl_accounts')
    .select('id, org_id, buildium_gl_account_id')
    .in('id', accountIds);

  if (accountError) {
    logIssue(
      'failed to load accounts',
      { supabaseError: { message: accountError.message, hint: accountError.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to verify accounts' }, { status: 500 });
  }

  type AccountRow = {
    id: string;
    org_id?: string | null;
    buildium_gl_account_id?: number | null;
  };

  const typedAccountRows = (accountRows ?? []) as AccountRow[];
  if (typedAccountRows.length !== accountIds.length) {
    logIssue('one or more GL accounts not found', { requestedAccountIds: accountIds });
    return NextResponse.json({ error: 'One or more GL accounts were not found' }, { status: 400 });
  }

  const buildiumAccountMap = new Map<string, number>();
  typedAccountRows.forEach((row) => {
    if (typeof row.buildium_gl_account_id === 'number' && Number.isFinite(row.buildium_gl_account_id)) {
      buildiumAccountMap.set(row.id, row.buildium_gl_account_id);
    }
  });

  const memoValue = cleanJournalMemo(data.memo);
  const shouldSyncToBuildium = Boolean(propertyRow?.buildium_property_id);
  if (shouldSyncToBuildium) {
    const missingAccountMapping = normalizedLines.lines.some((line) => !buildiumAccountMap.has(line.accountId));
    if (missingAccountMapping) {
      logIssue('missing Buildium account mapping', {
        unmappedAccountIds: normalizedLines.lines
          .filter((line) => !buildiumAccountMap.has(line.accountId))
          .map((line) => line.accountId),
      });
      return NextResponse.json(
        { error: 'Selected GL accounts must be synced with Buildium before posting journal entries.' },
        { status: 400 },
      );
    }
  }

  const resolvedOrgId = await resolveUserOrgId({
    supabase,
    user,
    preferred: propertyRow?.org_id ?? null,
  });

  if (resolvedOrgId) {
    const mismatched = typedAccountRows.some(
      (account) => account?.org_id && String(account.org_id) !== resolvedOrgId,
    );
    if (mismatched) {
      logIssue('accounts belong to different organization', {
        resolvedOrgId,
        accountOrgIds: typedAccountRows.map((account) => account.org_id),
      });
      return NextResponse.json(
        { error: 'Accounts must belong to the same organization as the journal entry' },
        { status: 400 },
      );
    }
  } else {
    console.warn('journal entries: proceeding without resolved org id');
  }

  const nowIso = new Date().toISOString();

  const transactionUpdate = await admin
    .from('transactions')
    .update({
      date: data.date,
      memo: memoValue,
      total_amount: normalizedLines.debitTotal,
      updated_at: nowIso,
      org_id: resolvedOrgId,
    })
    .eq('id', transactionId);

  if (transactionUpdate.error) {
    logIssue(
      'failed to update transaction',
      { supabaseError: { message: transactionUpdate.error.message, hint: transactionUpdate.error.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to update journal entry' }, { status: 500 });
  }

  const { data: originalLines, error: selectOriginalError } = await admin
    .from('transaction_lines')
    .select('*')
    .eq('transaction_id', transactionId);

  if (selectOriginalError) {
    logIssue(
      'failed to load existing transaction lines',
      { supabaseError: { message: selectOriginalError.message, hint: selectOriginalError.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to load existing journal lines' }, { status: 500 });
  }

  const deleteLinesResult = await admin.from('transaction_lines').delete().eq('transaction_id', transactionId);
  if (deleteLinesResult.error) {
    logIssue(
      'failed to delete existing lines',
      { supabaseError: { message: deleteLinesResult.error.message, hint: deleteLinesResult.error.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to update journal entry' }, { status: 500 });
  }

  const accountEntityType: 'Rental' | 'Company' = propertyRow ? 'Rental' : 'Company';
  const accountEntityId = propertyRow?.buildium_property_id ?? null;
  const propertyUuid = propertyRow?.id ?? null;

  const lineRows = normalizedLines.lines.map((line) => ({
    transaction_id: transactionId,
    date: data.date,
    gl_account_id: line.accountId,
    memo: line.description,
    amount: line.amount,
    posting_type: line.postingType,
    account_entity_type: accountEntityType,
    account_entity_id: accountEntityId,
    property_id: propertyUuid,
    unit_id: unitRow?.id ?? null,
    buildium_property_id: propertyRow?.buildium_property_id ?? null,
    buildium_unit_id: unitRow?.buildium_unit_id ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const insertLinesResult = await admin.from('transaction_lines').insert(lineRows);
  if (insertLinesResult.error) {
    logIssue(
      'failed to insert updated lines',
      { supabaseError: { message: insertLinesResult.error.message, hint: insertLinesResult.error.hint } },
      'error',
    );
    if (Array.isArray(originalLines) && originalLines.length > 0) {
      await admin.from('transaction_lines').insert(
        (originalLines as Record<string, unknown>[]).map((line) => ({
          ...line,
          updated_at: nowIso,
        })),
      );
    }
    return NextResponse.json({ error: 'Unable to update journal entry' }, { status: 500 });
  }

  const journalUpdate = await admin
    .from('journal_entries')
    .update({
      date: data.date,
      memo: memoValue,
      total_amount: normalizedLines.debitTotal,
      updated_at: nowIso,
    })
    .eq('id', journalEntry.id);

  if (journalUpdate.error) {
    logIssue(
      'failed to update journal entry row',
      { supabaseError: { message: journalUpdate.error.message, hint: journalUpdate.error.hint } },
      'error',
    );
    return NextResponse.json({ error: 'Unable to update journal entry' }, { status: 500 });
  }

  logIssue('journal entry updated successfully');
  return NextResponse.json({ success: true });
}
