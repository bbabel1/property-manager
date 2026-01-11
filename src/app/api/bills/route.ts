import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers';
import { buildiumFetch } from '@/lib/buildium-http';
import { logger } from '@/lib/logger';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import type { Database as DatabaseSchema } from '@/types/database';

const DebitLineSchema = z.object({
  property_id: z.string().trim().min(1).optional().nullable(),
  unit_id: z.string().trim().min(1).optional().nullable(),
  gl_account_id: z.string().trim().min(1, 'Account is required'),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: z.number().positive('Line amount must be greater than zero'),
});

const CreateBillSchema = z.object({
  bill_date: z.string().min(1, 'Bill date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  vendor_id: z.string().min(1, 'Vendor is required'),
  post_to_account_id: z.string().min(1, 'Accounts payable account is required'),
  property_id: z.string().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  terms: z.enum(['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60']).optional(),
  reference_number: z.string().max(32).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
  apply_markups: z.boolean().optional(),
  lines: z.array(DebitLineSchema).min(1, 'Add at least one line item'),
});

const termsToDays: Record<string, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

const normalizeEntityId = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

type TransactionInsert = DatabaseSchema['public']['Tables']['transactions']['Insert'];
type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];
type ApprovalState = DatabaseSchema['public']['Enums']['approval_state_enum'];
const APPROVAL_STATES: ApprovalState[] = ['draft', 'pending_approval', 'approved', 'rejected', 'voided'];
const isApprovalState = (value: string): value is ApprovalState =>
  APPROVAL_STATES.includes(value as ApprovalState);

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, roles } = await requireAuth();
    if (!hasPermission(roles, 'bills.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);

    const searchParams = new URL(request.url).searchParams;
    const approvalStateRaw = searchParams.get('approval_state');
    const approvalStateValue = approvalStateRaw?.trim() || null;

    let query = supabase
      .from('transactions')
      .select(
        '*, bill_workflow:bill_workflow(approval_state, submitted_at, approved_at, rejected_at, voided_at), bill_applications:bill_applications(id, applied_amount, source_transaction_id, source_type, applied_at)',
      )
      .eq('transaction_type', 'Bill')
      .eq('org_id', orgId);

    if (approvalStateValue) {
      if (!isApprovalState(approvalStateValue)) {
        return NextResponse.json({ error: 'Invalid approval_state' }, { status: 400 });
      }
      const approvalState: ApprovalState = approvalStateValue;
      query = query.eq('bill_workflow.approval_state', approvalState);
    }

    const { data, error } = await query;
    if (error) {
      logger.error({ error, orgId, userId: user.id }, 'Failed to fetch bills');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    logger.error({ error }, 'Unexpected error fetching bills');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = CreateBillSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json(
      { error: issue?.message ?? 'Invalid record bill payload' },
      { status: 400 },
    );
  }

  const admin = requireSupabaseAdmin('create bill');

  const data = parsed.data;
  const lines = data.lines.map((line) => {
    const propertyId = normalizeEntityId(line.property_id);
    const unitId = normalizeEntityId(line.unit_id);
    return {
      property_id: propertyId,
      unit_id: propertyId ? unitId : null,
      gl_account_id: line.gl_account_id,
      description: line.description?.trim() || null,
      amount: Number(line.amount),
    };
  });

  const payloadPropertyId = normalizeEntityId(data.property_id);
  const payloadUnitId = normalizeEntityId(data.unit_id);

  const uniqueLinePropertyIds = Array.from(
    new Set(lines.map((line) => line.property_id).filter((id): id is string => typeof id === 'string')),
  );
  if (
    payloadPropertyId &&
    uniqueLinePropertyIds.length &&
    uniqueLinePropertyIds.some((id) => id !== payloadPropertyId)
  ) {
    return NextResponse.json(
      { error: 'Bill property does not match line properties. Use a single property per bill.' },
      { status: 400 },
    );
  }
  if (uniqueLinePropertyIds.length > 1) {
    return NextResponse.json(
      { error: 'Bill lines cannot span multiple properties. Please submit one property at a time.' },
      { status: 400 },
    );
  }
  const propertyIdForBill = payloadPropertyId ?? uniqueLinePropertyIds[0] ?? null;

  const uniqueLineUnitIds = Array.from(
    new Set(lines.map((line) => line.unit_id).filter((id): id is string => typeof id === 'string')),
  );
  if (payloadUnitId && uniqueLineUnitIds.length && uniqueLineUnitIds.some((id) => id !== payloadUnitId)) {
    return NextResponse.json(
      { error: 'Bill unit does not match line units. Use a single unit per bill.' },
      { status: 400 },
    );
  }
  if (uniqueLineUnitIds.length > 1) {
    return NextResponse.json(
      { error: 'Bill lines cannot span multiple units. Please submit one unit at a time.' },
      { status: 400 },
    );
  }
  const unitIdForBill = payloadUnitId ?? uniqueLineUnitIds[0] ?? null;
  if (unitIdForBill && !propertyIdForBill) {
    return NextResponse.json(
      { error: 'A property is required when specifying a unit on a bill.' },
      { status: 400 },
    );
  }

  let propertyRow:
    | {
        id: string;
        org_id: string | null;
        buildium_property_id: number | null;
      }
    | null = null;
  if (propertyIdForBill) {
    const { data: property, error: propertyErr } = await admin
      .from('properties')
      .select('id, org_id, buildium_property_id')
      .eq('id', propertyIdForBill)
      .maybeSingle();
    if (propertyErr) {
      return NextResponse.json({ error: propertyErr.message }, { status: 500 });
    }
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }
    propertyRow = property;
  }

  const unitIdsToLoad = Array.from(
    new Set(
      [unitIdForBill, ...lines.map((line) => line.unit_id ?? null)].filter(
        (id): id is string => typeof id === 'string',
      ),
    ),
  );
  const unitMetaMap = new Map<
    string,
    {
      property_id: string | null;
      buildium_unit_id: number | null;
    }
  >();
  if (unitIdsToLoad.length) {
    const { data: unitRows, error: unitErr } = await admin
      .from('units')
      .select('id, property_id, buildium_unit_id')
      .in('id', unitIdsToLoad);
    if (unitErr) {
      return NextResponse.json({ error: unitErr.message }, { status: 500 });
    }
    for (const unit of unitRows || []) {
      unitMetaMap.set(String(unit.id), {
        property_id: (unit as any)?.property_id ?? null,
        buildium_unit_id: (unit as any)?.buildium_unit_id ?? null,
      });
    }
    const missingUnit = unitIdsToLoad.find((id) => !unitMetaMap.has(id));
    if (missingUnit) {
      return NextResponse.json({ error: `Unit ${missingUnit} was not found` }, { status: 400 });
    }
  }

  if (propertyRow && unitIdForBill) {
    const unitMeta = unitMetaMap.get(unitIdForBill);
    if (unitMeta?.property_id && unitMeta.property_id !== propertyRow.id) {
      return NextResponse.json(
        { error: 'Bill unit must belong to the selected property.' },
        { status: 400 },
      );
    }
  }

  if (propertyRow) {
    for (const [unitId, meta] of unitMetaMap.entries()) {
      if (meta.property_id && meta.property_id !== propertyRow.id) {
        return NextResponse.json(
          { error: `Unit ${unitId} does not belong to the bill property.` },
          { status: 400 },
        );
      }
    }
  }

  const glAccountIds = Array.from(
    new Set([data.post_to_account_id, ...lines.map((line) => line.gl_account_id)]),
  );
  const { data: glAccounts, error: glErr } = await admin
    .from('gl_accounts')
    .select('id, org_id')
    .in('id', glAccountIds);
  if (glErr) {
    return NextResponse.json({ error: glErr.message }, { status: 500 });
  }
  if (!glAccounts || glAccounts.length !== glAccountIds.length) {
    return NextResponse.json(
      { error: 'One or more GL accounts were not found. Please verify the chart of accounts.' },
      { status: 400 },
    );
  }

  const glOrgIds = new Set<string>();
  const apGlAccount = glAccounts.find((acc) => acc.id === data.post_to_account_id) || null;
  glAccounts.forEach((acc) => {
    if ((acc as any)?.org_id) glOrgIds.add(String((acc as any).org_id));
  });
  const propertyOrgId = propertyRow?.org_id ?? null;
  if (propertyOrgId) {
    for (const orgId of glOrgIds) {
      if (orgId && orgId !== propertyOrgId) {
        return NextResponse.json(
          { error: 'GL accounts must belong to the same organization as the property.' },
          { status: 400 },
        );
      }
    }
    if (apGlAccount && (apGlAccount as any)?.org_id && (apGlAccount as any)?.org_id !== propertyOrgId) {
      return NextResponse.json(
        { error: 'Accounts payable account must belong to the same organization as the property.' },
        { status: 400 },
      );
    }
  }

  const resolvedOrgId = propertyOrgId ?? (glOrgIds.size === 1 ? Array.from(glOrgIds)[0] : null);
  if (!resolvedOrgId) {
    return NextResponse.json(
      { error: 'Unable to resolve organization for this bill. Ensure property or GL accounts are scoped.' },
      { status: 400 },
    );
  }

  const totalAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const billDate = data.bill_date.slice(0, 10);
  const dueDate = data.due_date.slice(0, 10);
  const headerInsert: TransactionInsert & { property_id?: string | null; unit_id?: string | null } = {
    transaction_type: 'Bill',
    date: billDate,
    due_date: dueDate,
    vendor_id: data.vendor_id ? String(data.vendor_id) : null,
    reference_number: data.reference_number?.trim() || null,
    memo: data.memo || null,
    status: 'Due',
    total_amount: totalAmount,
    created_at: nowIso,
    updated_at: nowIso,
    org_id: resolvedOrgId,
    property_id: propertyIdForBill,
    unit_id: unitIdForBill ?? null,
  };

  const buildiumPropertyId = propertyRow?.buildium_property_id ?? null;
  const buildiumUnitIdForBill =
    unitIdForBill && propertyIdForBill ? unitMetaMap.get(unitIdForBill)?.buildium_unit_id ?? null : null;

  const rpcLines = lines.map((line): TransactionLineInsert => {
    const propertyId = propertyIdForBill;
    const unitId = propertyId ? line.unit_id ?? unitIdForBill ?? null : null;
    const buildiumUnitId = unitId ? unitMetaMap.get(unitId)?.buildium_unit_id ?? null : null;
    const entityType = buildiumPropertyId ? 'Rental' : 'Company';
    return {
      transaction_id: null,
      gl_account_id: line.gl_account_id,
      amount: Math.abs(Number(line.amount || 0)),
      posting_type: 'Debit',
      memo: line.description || data.memo || null,
      account_entity_type: entityType,
      account_entity_id: buildiumPropertyId,
      date: billDate,
      created_at: nowIso,
      updated_at: nowIso,
      property_id: propertyId,
      unit_id: unitId,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: null,
    };
  });

  rpcLines.push({
    transaction_id: null,
    gl_account_id: data.post_to_account_id,
    amount: totalAmount,
    posting_type: 'Credit',
    memo: data.memo || null,
    account_entity_type: buildiumPropertyId ? 'Rental' : 'Company',
    account_entity_id: buildiumPropertyId,
    date: billDate,
    created_at: nowIso,
    updated_at: nowIso,
    property_id: propertyIdForBill,
    unit_id: propertyIdForBill ? unitIdForBill ?? null : null,
    buildium_property_id: buildiumPropertyId,
    buildium_unit_id: buildiumUnitIdForBill,
    buildium_lease_id: null,
  });

  const { data: postTransactionId, error: postError } = await (admin as any).rpc('post_transaction', {
    p_header: headerInsert,
    p_lines: rpcLines.map((line) => ({
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

  const billId =
    typeof postTransactionId === 'string'
      ? postTransactionId
      : postTransactionId &&
          typeof postTransactionId === 'object' &&
          'id' in (postTransactionId as Record<string, unknown>)
        ? (postTransactionId as Record<string, unknown>).id
        : postTransactionId && Array.isArray(postTransactionId)
        ? postTransactionId[0]
        : null;

  if (postError || !billId) {
    logger.error({ error: postError, payload: data }, 'Failed to create bill transaction');
    return NextResponse.json(
      { error: postError?.message ?? 'Unable to create bill transaction' },
      { status: 500 },
    );
  }

  const termDays = data.terms ? termsToDays[data.terms] ?? null : null;
  const response = {
    id: billId,
    vendor_id: data.vendor_id,
    total_amount: totalAmount,
    date: billDate,
    due_date: dueDate,
    memo: data.memo || null,
    reference_number: data.reference_number || null,
    term_days: termDays,
  };
  const buildium = await syncBillToBuildium(String(billId), admin);

  return NextResponse.json({ data: response, buildium }, { status: 201 });
}

type BuildiumSyncResult = {
  success: boolean;
  status?: number;
  message?: string;
};

async function syncBillToBuildium(
  billId: string,
  admin: ReturnType<typeof requireSupabaseAdmin>,
): Promise<BuildiumSyncResult> {
  let payload: Awaited<ReturnType<typeof mapTransactionBillToBuildium>>;
  try {
    payload = await mapTransactionBillToBuildium(billId, admin);
  } catch (error) {
    logger.error({ billId, error }, 'Failed to map bill to Buildium payload');
    return {
      success: false,
      status: 400,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to prepare Buildium payload. The bill was saved locally.',
    };
  }

  const { data: tx, error: txError } = await admin
    .from('transactions')
    .select('buildium_bill_id, org_id')
    .eq('id', billId)
    .maybeSingle();

  if (txError) {
    logger.error({ billId, error: txError }, 'Failed to load bill before Buildium sync');
    return {
      success: false,
      status: 500,
      message: 'Unable to load bill for Buildium sync.',
    };
  }

  // Resolve orgId from transaction
  let orgId = tx?.org_id ?? undefined;

  // If no orgId on transaction, try to resolve from property via transaction_lines
  if (!orgId) {
    const { data: txnLine } = await admin
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', billId)
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

  const isUpdate = typeof tx?.buildium_bill_id === 'number' && tx.buildium_bill_id > 0;
  const path = isUpdate ? `/bills/${tx.buildium_bill_id}` : '/bills';

  try {
    const buildiumResponse = await buildiumFetch(isUpdate ? 'PUT' : 'POST', path, undefined, payload, orgId);

    if (!buildiumResponse.ok) {
      const responseBody = buildiumResponse.json ?? null;
      const message =
        describeBuildiumError(responseBody) ?? 'Failed to sync bill to Buildium. The bill was saved locally.';
      logger.error({ billId, status: buildiumResponse.status, response: responseBody }, message);
      return { success: false, status: buildiumResponse.status, message };
    }

    if (!isUpdate) {
      const responseBody = buildiumResponse.json ?? null;
      const maybeId = (responseBody as { Id?: number } | null)?.Id;
      if (typeof maybeId === 'number') {
        await admin
          .from('transactions')
          .update({ buildium_bill_id: maybeId, updated_at: new Date().toISOString() })
          .eq('id', billId);
      }
    }

    return { success: true, status: buildiumResponse.status };
  } catch (error) {
    logger.error({ billId, error }, 'Buildium sync request failed');
    return {
      success: false,
      status: 502,
      message:
        error instanceof Error
          ? error.message
          : 'Buildium sync request failed. The bill was saved locally.',
    };
  }
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
