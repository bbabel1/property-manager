'use server';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client';
import { createBuildiumClient, defaultBuildiumConfig } from '@/lib/buildium-client';
import { resolveUserOrgId } from '@/lib/auth/org-access';
import {
  COMPANY_SENTINEL,
  JournalEntryPayload,
  journalEntrySchemaBase,
  normalizeJournalLines,
  cleanJournalMemo,
  roundJournalCurrency,
} from '@/lib/journal-entries';
import type { NormalizedJournalLine } from '@/lib/journal-entries';
import {
  BUILDUM_MISSING_CREDS_ERROR,
  ensureBuildiumConfigured,
  parseBuildiumNumericId,
  resolveBuildiumAccountingEntityType,
  syncJournalEntryToBuildium,
} from './buildium-sync';
import type { BuildiumAccountingEntityType } from '@/types/buildium';

type AccountRow = {
  id: string;
  org_id?: string | null;
  buildium_gl_account_id?: number | null;
};

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  let authContext: Awaited<ReturnType<typeof requireAuth>>;
  try {
    authContext = await requireAuth();
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return jsonError('Authentication required', 401);
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return jsonError('Insufficient permissions', 403);
    }
    console.error('journal entries: unexpected auth error', error);
    return jsonError('Unable to verify authentication', 500);
  }

  let adminClient;
  try {
    adminClient = requireSupabaseAdmin('journal entries');
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return jsonError('Server is not configured for journal entry writes', 501);
    }
    throw error;
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return jsonError('Invalid JSON payload');
  }

  const parsed = journalEntrySchemaBase.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return jsonError(issue?.message || 'Invalid journal entry payload');
  }

  const { supabase, user } = authContext;
  const data: JournalEntryPayload = parsed.data;
  const propertyId = data.propertyId.trim();
  const unitId = data.unitId?.trim() || null;
  const isCompanyLevel = propertyId === COMPANY_SENTINEL;

  let propertyRow: {
    id: string;
    org_id?: string | null;
    buildium_property_id?: number | null;
    rental_type?: string | null;
  } | null = null;

  if (!isCompanyLevel) {
    const { data: property, error } = await supabase
      .from('properties')
      .select('id, org_id, buildium_property_id, rental_type')
      .eq('id', propertyId)
      .maybeSingle();
    if (error || !property) {
      return jsonError('Property not found', 404);
    }
    propertyRow = {
      id: String(property.id),
      org_id: property.org_id != null ? String(property.org_id) : null,
      buildium_property_id: property.buildium_property_id ?? null,
      rental_type: property.rental_type ?? null,
    };
  }

  if (unitId && !propertyRow) {
    return jsonError('Units can only be attached to property-level journal entries');
  }

  let unitRow: {
    id: string;
    property_id?: string | null;
    buildium_unit_id?: number | null;
  } | null = null;

  if (unitId) {
    const { data: unit, error } = await supabase
      .from('units')
      .select('id, property_id, buildium_unit_id')
      .eq('id', unitId)
      .maybeSingle();
    if (error || !unit) {
      return jsonError('Unit not found', 404);
    }
    if (String(unit.property_id) !== propertyRow?.id) {
      return jsonError('Selected unit does not belong to this property');
    }
    unitRow = {
      id: String(unit.id),
      property_id: unit.property_id ? String(unit.property_id) : null,
      buildium_unit_id: unit.buildium_unit_id ?? null,
    };
  }

  let normalized: ReturnType<typeof normalizeJournalLines>;
  try {
    normalized = normalizeJournalLines(data.lines);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid line items');
  }

  const accountIds = Array.from(new Set(normalized.lines.map((line) => line.accountId)));
  const { data: accountRows, error: accountError } = await supabase
    .from('gl_accounts')
    .select('id, org_id, buildium_gl_account_id')
    .in('id', accountIds);

  if (accountError) {
    console.error('journal entries: failed to load accounts', accountError);
    return jsonError('Unable to verify accounts', 500);
  }

  const typedAccountRows = (accountRows ?? []) as AccountRow[];

  if (typedAccountRows.length !== accountIds.length) {
    return jsonError('One or more GL accounts were not found');
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
    const missingAccountMapping = normalized.lines.some((line) => !buildiumAccountMap.has(line.accountId));
    if (missingAccountMapping) {
      return jsonError('Selected GL accounts must be synced with Buildium before posting journal entries.');
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
      return jsonError('Accounts must belong to the same organization as the journal entry');
    }
  } else {
    console.warn('journal entries: proceeding without resolved org id');
  }

  const nowIso = new Date().toISOString();
  const transactionInsert = {
    date: data.date,
    memo: memoValue,
    total_amount: normalized.debitTotal,
    transaction_type: 'GeneralJournalEntry' as const,
    created_at: nowIso,
    updated_at: nowIso,
    org_id: resolvedOrgId,
    status: 'Due' as const,
    email_receipt: false,
    print_receipt: false,
  };

  const { data: transaction, error: insertError } = await adminClient
    .from('transactions')
    .insert(transactionInsert)
    .select('id')
    .single();

  if (insertError || !transaction) {
    console.error('journal entries: failed to insert transaction', insertError);
    return jsonError('Unable to save journal entry', 500);
  }

  const rollbackLocalEntry = async () => {
    try {
      await adminClient.from('journal_entries').delete().eq('transaction_id', transaction.id);
    } catch (cleanupError) {
      console.error('journal entries: failed to rollback journal entry', cleanupError);
    }
    try {
      await adminClient.from('transaction_lines').delete().eq('transaction_id', transaction.id);
    } catch (cleanupError) {
      console.error('journal entries: failed to rollback lines', cleanupError);
    }
    try {
      await adminClient.from('transactions').delete().eq('id', transaction.id);
    } catch (cleanupError) {
      console.error('journal entries: failed to rollback transaction', cleanupError);
    }
  };

  const accountEntityType: 'Rental' | 'Company' = propertyRow ? 'Rental' : 'Company';
  const accountEntityId = propertyRow?.buildium_property_id ?? null;
  const propertyUuid = propertyRow?.id ?? null;

  const lineRows = normalized.lines.map((line) => ({
    transaction_id: transaction.id,
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

  const { error: lineError } = await adminClient.from('transaction_lines').insert(lineRows);
  if (lineError) {
    console.error('journal entries: failed to insert lines', lineError);
    await rollbackLocalEntry();
    return jsonError('Unable to save journal entry', 500);
  }

  const { data: journalEntryRecord, error: journalInsertError } = await adminClient
    .from('journal_entries')
    .insert({
      transaction_id: transaction.id,
      date: data.date,
      memo: memoValue,
      check_number: null,
      total_amount: normalized.debitTotal,
      buildium_gl_entry_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, buildium_gl_entry_id')
    .single();

  if (journalInsertError || !journalEntryRecord) {
    console.error('journal entries: failed to insert journal entry', journalInsertError);
    await rollbackLocalEntry();
    return jsonError('Unable to save journal entry', 500);
  }

  if (shouldSyncToBuildium && propertyRow?.buildium_property_id) {
    try {
      const buildiumId = await syncJournalEntryToBuildium({
        date: data.date,
        memo: memoValue,
        totalAmount: normalized.debitTotal,
        lines: normalized.lines,
        propertyId: propertyRow.buildium_property_id,
        unitId: unitRow?.buildium_unit_id ?? null,
        accountingEntityType: resolveBuildiumAccountingEntityType(propertyRow.rental_type),
        accountMap: buildiumAccountMap,
        existingEntryId: journalEntryRecord.buildium_gl_entry_id ?? null,
      });
      await adminClient
        .from('journal_entries')
        .update({ buildium_gl_entry_id: buildiumId, updated_at: new Date().toISOString() })
        .eq('id', journalEntryRecord.id);
    } catch (error) {
      console.error('journal entries: failed to sync Buildium entry', error);
      await rollbackLocalEntry();
      const message =
        error instanceof Error ? error.message : 'Unable to sync journal entry with Buildium.';
      const status = message === BUILDUM_MISSING_CREDS_ERROR ? 500 : 502;
      return jsonError(message, status);
    }
  }

  return NextResponse.json(
    {
      data: {
        transactionId: transaction.id,
        journalEntryId: journalEntryRecord.id,
      },
    },
    { status: 201 },
  );
}
