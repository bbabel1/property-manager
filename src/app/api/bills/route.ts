import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSupabaseAdmin } from '@/lib/supabase-client';

export const DebitLineSchema = z.object({
  property_id: z.string().trim().min(1).optional().nullable(),
  unit_id: z.string().trim().min(1).optional().nullable(),
  gl_account_id: z.string().trim().min(1, 'Account is required'),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: z.number().positive('Line amount must be greater than zero'),
});

export const CreateBillSchema = z.object({
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
  const lines = data.lines.map((line) => ({
    property_id: toNullableNumber(line.property_id || null),
    unit_id: toNullableNumber(line.unit_id || null),
    gl_account_id: line.gl_account_id,
    description: line.description?.trim() || null,
    amount: Number(line.amount),
  }));

  const totalAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const billDate = data.bill_date.slice(0, 10);
  const dueDate = data.due_date.slice(0, 10);
  const { data: transactionRows, error: insertError } = await admin
    .from('transactions')
    .insert({
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
    })
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

  const debitRows = lines.map((line) => ({
    transaction_id: billId,
    gl_account_id: line.gl_account_id,
    amount: Math.abs(Number(line.amount || 0)),
    posting_type: 'Debit',
    memo: line.description || data.memo || null,
    account_entity_type: 'Rental',
    account_entity_id: null,
    date: billDate,
    created_at: nowIso,
    updated_at: nowIso,
    property_id: line.property_id,
    unit_id: line.unit_id,
    buildium_property_id: null,
    buildium_unit_id: null,
    buildium_lease_id: null,
  }));

  const templateProperty = debitRows.find((row) => row.property_id != null)?.property_id ?? null;
  const templateUnit = debitRows.find((row) => row.unit_id != null)?.unit_id ?? null;

  const creditRow = {
    transaction_id: billId,
    gl_account_id: data.post_to_account_id,
    amount: totalAmount,
    posting_type: 'Credit',
    memo: data.memo || null,
    account_entity_type: 'Company',
    account_entity_id: null,
    date: billDate,
    created_at: nowIso,
    updated_at: nowIso,
    property_id: templateProperty,
    unit_id: templateUnit,
    buildium_property_id: null,
    buildium_unit_id: null,
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

  return NextResponse.json({ data: response }, { status: 201 });
}

