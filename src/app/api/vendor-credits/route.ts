import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database as DatabaseSchema } from '@/types/database';

const BillAllocationSchema = z.object({
  bill_id: z.string().min(1),
  amount: z.number().positive(),
});

const VendorCreditSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  credit_date: z.string().min(1, 'Credit date is required'),
  amount: z.number().positive('Credit amount must be greater than zero'),
  gl_account_id: z.string().min(1, 'Credit GL account is required'),
  memo: z.string().nullable().optional(),
  property_id: z.string().optional().nullable(),
  unit_id: z.string().nullable().optional(),
  bill_allocations: z.array(BillAllocationSchema).optional(),
});

type TransactionInsert = DatabaseSchema['public']['Tables']['transactions']['Insert'];
type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];

export async function POST(request: Request) {
  const { user, roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = VendorCreditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const payload = parsed.data;
  const totalAllocated = payload.bill_allocations?.reduce((sum, alloc) => sum + alloc.amount, 0) ?? 0;
  if (payload.bill_allocations?.length && totalAllocated > payload.amount + 0.005) {
    return NextResponse.json(
      { error: 'Bill allocations cannot exceed the credit amount' },
      { status: 422 },
    );
  }

  let orgId: string | null = null;
  if (payload.property_id) {
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, org_id')
      .eq('id', payload.property_id)
      .maybeSingle();
    if (propertyError) {
      return NextResponse.json({ error: propertyError.message }, { status: 500 });
    }
    orgId = (property as any)?.org_id ?? null;
  }

  const { data: vendor, error: vendorError } = await supabaseAdmin
    .from('vendors')
    .select('id, org_id')
    .eq('id', payload.vendor_id)
    .maybeSingle();
  if (vendorError) {
    return NextResponse.json({ error: vendorError.message }, { status: 500 });
  }
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }
  if (!orgId) {
    orgId = (vendor as any)?.org_id ?? null;
  }
  if (!orgId) {
    return NextResponse.json(
      { error: 'Unable to resolve organization for this vendor credit' },
      { status: 422 },
    );
  }

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

  const { data: creditAccount, error: creditAccountError } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, org_id, is_bank_account')
    .eq('id', payload.gl_account_id)
    .maybeSingle();
  if (creditAccountError) {
    return NextResponse.json({ error: creditAccountError.message }, { status: 500 });
  }
  if (
    creditAccount &&
    (creditAccount as any).org_id &&
    (creditAccount as any).org_id !== orgId
  ) {
    return NextResponse.json(
      { error: 'Credit GL account must belong to the same organization as the property' },
      { status: 422 },
    );
  }
  if (creditAccount && (creditAccount as any).is_bank_account === true) {
    return NextResponse.json(
      { error: 'Credit GL account cannot be a bank account' },
      { status: 422 },
    );
  }

  const allocationBillIds = payload.bill_allocations?.length
    ? Array.from(new Set(payload.bill_allocations.map((b) => b.bill_id)))
    : [];
  if (allocationBillIds.length) {
    const { data: allocationBills, error: allocationError } = await supabaseAdmin
      .from('transactions')
      .select('id, org_id')
      .in('id', allocationBillIds)
      .eq('transaction_type', 'Bill');
    if (allocationError) {
      return NextResponse.json({ error: allocationError.message }, { status: 500 });
    }
    if (!allocationBills || allocationBills.length !== allocationBillIds.length) {
      return NextResponse.json({ error: 'One or more bills were not found' }, { status: 404 });
    }
    if (allocationBills.some((b) => (b as any)?.org_id !== orgId)) {
      return NextResponse.json(
        { error: 'Bills must belong to the same organization as the credit' },
        { status: 422 },
      );
    }
  }

  const nowIso = new Date().toISOString();
  const creditDate = payload.credit_date.slice(0, 10);

  const debitLine: TransactionLineInsert = {
    transaction_id: null,
    gl_account_id: apGlAccountId,
    amount: payload.amount,
    posting_type: 'Debit',
    memo: payload.memo ?? null,
    account_entity_type: 'Rental',
    account_entity_id: null,
    property_id: payload.property_id ?? null,
    unit_id: payload.unit_id ?? null,
    buildium_property_id: null,
    buildium_unit_id: null,
    buildium_lease_id: null,
    date: creditDate,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const creditLine: TransactionLineInsert = {
    transaction_id: null,
    gl_account_id: payload.gl_account_id,
    amount: payload.amount,
    posting_type: 'Credit',
    memo: payload.memo ?? null,
    account_entity_type: 'Rental',
    account_entity_id: null,
    property_id: payload.property_id ?? null,
    unit_id: payload.unit_id ?? null,
    buildium_property_id: null,
    buildium_unit_id: null,
    buildium_lease_id: null,
    date: creditDate,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const headerInsert: TransactionInsert = {
    transaction_type: 'VendorCredit',
    date: creditDate,
    status: 'Paid',
    total_amount: payload.amount,
    memo: payload.memo ?? null,
    vendor_id: payload.vendor_id,
    org_id: orgId,
    property_id: payload.property_id ?? null,
    unit_id: payload.unit_id ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: createdCreditId, error: createCreditError } = await (supabaseAdmin as any).rpc(
    'post_transaction',
    {
      p_header: headerInsert,
      p_lines: [debitLine, creditLine].map((line) => ({
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

  const creditId =
    typeof createdCreditId === 'string'
      ? createdCreditId
      : createdCreditId &&
          typeof createdCreditId === 'object' &&
          'id' in (createdCreditId as Record<string, unknown>)
        ? (createdCreditId as Record<string, unknown>).id
        : createdCreditId && Array.isArray(createdCreditId)
        ? createdCreditId[0]
        : null;

  if (createCreditError || !creditId) {
    logger.error({ error: createCreditError }, 'Failed to create vendor credit');
    return NextResponse.json(
      { error: createCreditError?.message ?? 'Unable to create vendor credit' },
      { status: 500 },
    );
  }

  const applications: { bill_id: string; application_id: string | null }[] = [];
  const createdApplicationIds: string[] = [];

  try {
    if (payload.bill_allocations?.length) {
      for (const alloc of payload.bill_allocations) {
        const { error: validationError } = await supabaseAdmin.rpc('validate_bill_application', {
          p_bill_id: alloc.bill_id,
          p_source_id: creditId,
          p_amount: alloc.amount,
        });
        if (validationError) throw validationError;

        const { data: app, error: insertError } = await supabaseAdmin
          .from('bill_applications')
          .insert({
            bill_transaction_id: alloc.bill_id,
            source_transaction_id: creditId,
            source_type: 'credit',
            applied_amount: alloc.amount,
            applied_at: creditDate ? new Date(creditDate).toISOString() : nowIso,
            created_by_user_id: user.id,
            created_at: nowIso,
            updated_at: nowIso,
            org_id: orgId,
          })
          .select('id')
          .maybeSingle();
        if (insertError) throw insertError;
        if (app?.id) createdApplicationIds.push(app.id);
        applications.push({ bill_id: alloc.bill_id, application_id: app?.id ?? null });
      }
    }
  } catch (error: any) {
    logger.error({ error, creditId }, 'Failed to apply vendor credit, rolling back');
    if (createdApplicationIds.length) {
      await supabaseAdmin.from('bill_applications').delete().in('id', createdApplicationIds);
    }
    await supabaseAdmin.from('transactions').delete().eq('id', creditId);
    const message = error?.message ?? 'Unable to apply credit to bill';
    const status = message.toLowerCase().includes('reconciled') ? 409 : 422;
    return NextResponse.json(
      { error: message, credit_id: creditId },
      { status },
    );
  }

  return NextResponse.json({ success: true, credit_id: creditId, applications }, { status: 201 });
}
