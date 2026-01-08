import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database as DatabaseSchema } from '@/types/database';

const AllocationSchema = z.object({
  bill_id: z.string().min(1),
  amount: z.number().positive(),
});

const CreatePaymentSchema = z.object({
  bank_account_id: z.string().min(1, 'Bank account is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_date: z.string().min(1, 'Payment date is required'),
  memo: z.string().nullable().optional(),
  reference_number: z.string().nullable().optional(),
  bill_allocations: z.array(AllocationSchema).min(1, 'At least one bill allocation is required'),
  apply_to_bill_transaction_ids: z.array(z.string().min(1)).optional(), // compatibility
});

type TransactionInsert = DatabaseSchema['public']['Tables']['transactions']['Insert'];
type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];

export async function POST(request: Request) {
  const { user, roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = CreatePaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const payload = parsed.data;
  const totalAllocated = payload.bill_allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  if (Math.abs(totalAllocated - payload.amount) > 0.005) {
    return NextResponse.json(
      { error: 'Bill allocations must equal the payment amount' },
      { status: 422 },
    );
  }

  const billIds = Array.from(new Set(payload.bill_allocations.map((b) => b.bill_id)));
  const { data: bills, error: billsError } = await supabaseAdmin
    .from('transactions')
    .select('id, org_id, vendor_id, property_id, unit_id')
    .in('id', billIds)
    .eq('transaction_type', 'Bill');

  if (billsError) {
    return NextResponse.json({ error: billsError.message }, { status: 500 });
  }
  if (!bills || bills.length !== billIds.length) {
    return NextResponse.json({ error: 'One or more bills were not found' }, { status: 404 });
  }

  const orgIds = Array.from(new Set(bills.map((b) => (b as any)?.org_id).filter(Boolean)));
  if (orgIds.length !== 1) {
    return NextResponse.json(
      { error: 'All bills must belong to the same organization' },
      { status: 422 },
    );
  }
  const orgId = orgIds[0] as string;

  const vendorIds = new Set<string>();
  bills.forEach((b) => {
    if ((b as any)?.vendor_id) vendorIds.add(String((b as any).vendor_id));
  });
  const vendorId = vendorIds.size === 1 ? Array.from(vendorIds)[0] : null;

  const { data: apResult, error: apError } = await supabaseAdmin.rpc('resolve_ap_gl_account_id', {
    p_org_id: orgId,
  });
  if (apError) {
    return NextResponse.json({ error: apError.message }, { status: 500 });
  }
  const apGlAccountId = (apResult as string | null) ?? null;
  if (!apGlAccountId) {
    return NextResponse.json(
      { error: 'Accounts payable account is missing for this organization.' },
      { status: 422 },
    );
  }

  const { data: bankAccountRow, error: bankErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, org_id, is_bank_account')
    .eq('id', payload.bank_account_id)
    .maybeSingle();
  if (bankErr) {
    return NextResponse.json({ error: bankErr.message }, { status: 500 });
  }
  if (!bankAccountRow) {
    return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
  }
  if ((bankAccountRow as any).org_id && (bankAccountRow as any).org_id !== orgId) {
    return NextResponse.json(
      { error: 'Bank account must belong to the same organization as the bills' },
      { status: 422 },
    );
  }
  if ((bankAccountRow as any).is_bank_account !== true) {
    return NextResponse.json(
      { error: 'Selected GL account is not a bank account' },
      { status: 422 },
    );
  }

  const nowIso = new Date().toISOString();
  const paymentDate = payload.payment_date.slice(0, 10);

  const debitLines: TransactionLineInsert[] = payload.bill_allocations.map((alloc) => {
    const bill = bills.find((b) => String((b as any).id) === alloc.bill_id)!;
    const propertyId = (bill as any)?.property_id ?? null;
    const unitId = (bill as any)?.unit_id ?? null;
    const entityType = propertyId ? 'Rental' : 'Company';
    return {
      transaction_id: null,
      gl_account_id: apGlAccountId,
      amount: Math.abs(Number(alloc.amount)),
      posting_type: 'Debit',
      memo: payload.memo ?? null,
      account_entity_type: entityType as any,
      account_entity_id: null,
      property_id: propertyId,
      unit_id: unitId,
      buildium_property_id: null,
      buildium_unit_id: null,
      buildium_lease_id: null,
      date: paymentDate,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const totalAmount = debitLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const creditLine: TransactionLineInsert = {
    transaction_id: null,
    gl_account_id: payload.bank_account_id,
    amount: totalAmount,
    posting_type: 'Credit',
    memo: payload.memo ?? null,
    account_entity_type: 'Company',
    account_entity_id: null,
    property_id: null,
    unit_id: null,
    buildium_property_id: null,
    buildium_unit_id: null,
    buildium_lease_id: null,
    date: paymentDate,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const headerInsert: TransactionInsert = {
    transaction_type: 'Payment',
    date: paymentDate,
    status: 'Paid',
    total_amount: totalAmount,
    memo: payload.memo ?? null,
    reference_number: payload.reference_number ?? null,
    vendor_id: vendorId,
    org_id: orgId,
    bank_gl_account_id: payload.bank_account_id,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: createdPaymentId, error: createPaymentError } = await (supabaseAdmin as any).rpc(
    'post_transaction',
    {
      p_header: headerInsert,
      p_lines: [...debitLines, creditLine].map((line) => ({
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
    },
  );

  const paymentId =
    typeof createdPaymentId === 'string'
      ? createdPaymentId
      : createdPaymentId &&
          typeof createdPaymentId === 'object' &&
          'id' in (createdPaymentId as Record<string, unknown>)
        ? (createdPaymentId as Record<string, unknown>).id
        : createdPaymentId && Array.isArray(createdPaymentId)
        ? createdPaymentId[0]
        : null;

  if (createPaymentError || !paymentId) {
    logger.error({ error: createPaymentError }, 'Failed to create payment transaction');
    return NextResponse.json(
      { error: createPaymentError?.message ?? 'Unable to create payment' },
      { status: 500 },
    );
  }

  const applications: { bill_id: string; application_id: string | null }[] = [];
  const createdApplicationIds: string[] = [];
  const { data: sourceTx, error: sourceErr } = await supabaseAdmin
    .from('transactions')
    .select('id, is_reconciled')
    .eq('id', paymentId as string)
    .maybeSingle();
  if (sourceErr) {
    return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  }
  if (sourceTx && (sourceTx as any).is_reconciled === true) {
    return NextResponse.json(
      { error: 'Cannot apply payment: payment is reconciled' },
      { status: 409 },
    );
  }
  try {
    for (const alloc of payload.bill_allocations) {
      const { error: validationError } = await supabaseAdmin.rpc('validate_bill_application', {
        p_bill_id: alloc.bill_id,
        p_source_id: paymentId,
        p_amount: alloc.amount,
      });
      if (validationError) {
        throw validationError;
      }
      const { data: app, error: insertError } = await supabaseAdmin
        .from('bill_applications')
        .insert({
          bill_transaction_id: alloc.bill_id,
          source_transaction_id: paymentId,
          source_type: 'payment',
          applied_amount: alloc.amount,
          applied_at: paymentDate ? new Date(paymentDate).toISOString() : nowIso,
          created_by_user_id: user.id,
          created_at: nowIso,
          updated_at: nowIso,
          org_id: orgId,
        })
        .select('id')
        .maybeSingle();
      if (insertError) {
        throw insertError;
      }
      if (app?.id) createdApplicationIds.push(app.id);
      applications.push({ bill_id: alloc.bill_id, application_id: app?.id ?? null });
    }
  } catch (error: any) {
    logger.error(
      { error, paymentId },
      'Failed to apply payment to one or more bills, rolling back payment',
    );
    // Roll back created applications and payment header to avoid partial state.
    if (createdApplicationIds.length) {
      await supabaseAdmin.from('bill_applications').delete().in('id', createdApplicationIds);
    }
    await supabaseAdmin.from('transactions').delete().eq('id', paymentId);
    return NextResponse.json(
      { error: error?.message ?? 'Unable to apply payment to bill', payment_id: paymentId },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { success: true, payment_id: paymentId, applications },
    { status: 201 },
  );
}
