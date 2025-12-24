import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers';
import { logger } from '@/lib/logger';
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

const toNullableNumber = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEntityId = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

type TransactionInsert = DatabaseSchema['public']['Tables']['transactions']['Insert'];
type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];

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
    const unitId = propertyId ? normalizeEntityId(line.unit_id) : null;
    return {
      property_id: propertyId,
      unit_id: unitId,
      gl_account_id: line.gl_account_id,
      description: line.description?.trim() || null,
      amount: Number(line.amount),
    };
  });

  const uniquePropertyIds = Array.from(
    new Set(lines.map((line) => line.property_id).filter((id): id is string => typeof id === 'string')),
  );
  const uniqueUnitIds = Array.from(
    new Set(lines.map((line) => line.unit_id).filter((id): id is string => typeof id === 'string')),
  );

  const propertyBuildiumIdMap = new Map<string, number | null>();
  if (uniquePropertyIds.length) {
    const { data: propertyRows } = await admin
      .from('properties')
      .select('id, buildium_property_id')
      .in('id', uniquePropertyIds);
    (propertyRows || []).forEach((row) => {
      propertyBuildiumIdMap.set(
        String(row.id),
        typeof row.buildium_property_id === 'number' ? row.buildium_property_id : null,
      );
    });
  }

  const unitBuildiumIdMap = new Map<string, number | null>();
  if (uniqueUnitIds.length) {
    const { data: unitRows } = await admin
      .from('units')
      .select('id, buildium_unit_id')
      .in('id', uniqueUnitIds);
    (unitRows || []).forEach((row) => {
      unitBuildiumIdMap.set(
        String(row.id),
        typeof row.buildium_unit_id === 'number' ? row.buildium_unit_id : null,
      );
    });
  }

  const totalAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const billDate = data.bill_date.slice(0, 10);
  const dueDate = data.due_date.slice(0, 10);
  const headerInsert: TransactionInsert = {
    transaction_type: 'Bill',
    date: billDate,
    due_date: dueDate,
    vendor_id: toNullableNumber(data.vendor_id) ?? data.vendor_id,
    reference_number: data.reference_number?.trim() || null,
    memo: data.memo || null,
    status: 'Due',
    total_amount: totalAmount,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: transactionRows, error: insertError } = await admin
    .from('transactions')
    .insert(headerInsert)
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.error('Failed to insert bill header', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const billId = transactionRows?.id;
  if (!billId) {
    return NextResponse.json({ error: 'Bill header was not created' }, { status: 500 });
  }

  const debitRows: TransactionLineInsert[] = lines.map((line) => {
    const propertyId = line.property_id ?? null;
    const unitId = propertyId ? line.unit_id ?? null : null;
    const buildiumPropertyId = propertyId ? propertyBuildiumIdMap.get(propertyId) ?? null : null;
    const buildiumUnitId = unitId ? unitBuildiumIdMap.get(unitId) ?? null : null;
    const entityType = buildiumPropertyId ? 'Rental' : 'Company';
    return {
      transaction_id: billId,
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

  const templatePropertyRow = debitRows.find((row) => row.property_id != null) ?? null;
  const templateProperty = templatePropertyRow?.property_id ?? null;
  const templateBuildiumPropertyId = templatePropertyRow?.buildium_property_id ?? null;
  const templateUnit = templatePropertyRow?.unit_id ?? null;
  const templateBuildiumUnitId = templatePropertyRow?.buildium_unit_id ?? null;

  const creditEntityType = templateBuildiumPropertyId ? 'Rental' : 'Company';
  const creditRow: TransactionLineInsert = {
    transaction_id: billId,
    gl_account_id: data.post_to_account_id,
    amount: totalAmount,
    posting_type: 'Credit',
    memo: data.memo || null,
    account_entity_type: creditEntityType,
    account_entity_id: templateBuildiumPropertyId,
    date: billDate,
    created_at: nowIso,
    updated_at: nowIso,
    property_id: templateProperty,
    unit_id: templateUnit,
    buildium_property_id: templateBuildiumPropertyId,
    buildium_unit_id: templateBuildiumUnitId,
    buildium_lease_id: null,
  };

  try {
    await admin.from('transaction_lines').insert([...debitRows, creditRow]);
  } catch (error) {
    console.error('Failed to insert bill lines', error);
    await admin.from('transactions').delete().eq('id', billId);
    return NextResponse.json({ error: 'Unable to create bill line items' }, { status: 500 });
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
  const missingEnv = ['BUILDIUM_BASE_URL', 'BUILDIUM_CLIENT_ID', 'BUILDIUM_CLIENT_SECRET'].filter(
    (key) => !process.env[key],
  );
  if (missingEnv.length) {
    logger.error({ billId, missingEnv }, 'Buildium environment variables missing');
    return {
      success: false,
      status: 500,
      message: 'Buildium integration is not configured. The bill was saved locally.',
    };
  }

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
    .select('buildium_bill_id')
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

  const buildiumBaseUrl = (process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1').replace(
    /\/$/,
    '',
  );
  const isUpdate = typeof tx?.buildium_bill_id === 'number' && tx.buildium_bill_id > 0;
  const buildiumUrl = isUpdate
    ? `${buildiumBaseUrl}/bills/${tx.buildium_bill_id}`
    : `${buildiumBaseUrl}/bills`;

  try {
    const buildiumResponse = await fetch(buildiumUrl, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await buildiumResponse.text();
    let responseBody: unknown = null;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    if (!buildiumResponse.ok) {
      const message =
        describeBuildiumError(responseBody) ?? 'Failed to sync bill to Buildium. The bill was saved locally.';
      logger.error({ billId, status: buildiumResponse.status, response: responseBody }, message);
      return { success: false, status: buildiumResponse.status, message };
    }

    if (!isUpdate) {
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
