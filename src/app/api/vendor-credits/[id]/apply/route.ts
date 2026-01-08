import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

const ApplySchema = z.object({
  bill_allocations: z
    .array(
      z.object({
        bill_id: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1, 'At least one bill allocation is required'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { roles, user } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = ApplySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const { id } = await params;

  const { data: creditTx, error: creditErr } = await supabaseAdmin
    .from('transactions')
    .select('id, org_id, transaction_type, total_amount, is_reconciled')
    .eq('id', id)
    .maybeSingle();
  if (creditErr) {
    return NextResponse.json({ error: creditErr.message }, { status: 500 });
  }
  if (!creditTx || String((creditTx as any).transaction_type || '') !== 'VendorCredit') {
    return NextResponse.json({ error: 'Vendor credit not found' }, { status: 404 });
  }

  const orgId = (creditTx as any).org_id as string | null;
  if (!orgId) {
    return NextResponse.json(
      { error: 'Vendor credit is missing organization context' },
      { status: 422 },
    );
  }
  if ((creditTx as any).is_reconciled) {
    return NextResponse.json(
      { error: 'Cannot apply a reconciled credit' },
      { status: 409 },
    );
  }

  const totalRequested = parsed.data.bill_allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  const creditAmount = Number((creditTx as any).total_amount || 0);
  if (totalRequested > creditAmount + 0.005) {
    return NextResponse.json(
      { error: 'Bill allocations cannot exceed the credit amount' },
      { status: 422 },
    );
  }

  const billIds = Array.from(new Set(parsed.data.bill_allocations.map((b) => b.bill_id)));
  const { data: bills, error: billsError } = await supabaseAdmin
    .from('transactions')
    .select('id, org_id, transaction_type')
    .in('id', billIds)
    .eq('transaction_type', 'Bill');

  if (billsError) {
    return NextResponse.json({ error: billsError.message }, { status: 500 });
  }
  if (!bills || bills.length !== billIds.length) {
    return NextResponse.json({ error: 'One or more bills were not found' }, { status: 404 });
  }
  if (bills.some((b) => (b as any).org_id !== orgId)) {
    return NextResponse.json(
      { error: 'Bills must belong to the same organization as the credit' },
      { status: 422 },
    );
  }

  const nowIso = new Date().toISOString();
  const applications: { bill_id: string; application_id: string | null }[] = [];

  for (const alloc of parsed.data.bill_allocations) {
    try {
      const { error: validationError } = await supabaseAdmin.rpc('validate_bill_application', {
        p_bill_id: alloc.bill_id,
        p_source_id: id,
        p_amount: alloc.amount,
      });
      if (validationError) throw validationError;

      const { data: app, error: insertError } = await supabaseAdmin
        .from('bill_applications')
        .insert({
          bill_transaction_id: alloc.bill_id,
          source_transaction_id: id,
          source_type: 'credit',
          applied_amount: alloc.amount,
          applied_at: nowIso,
          created_by_user_id: user.id,
          created_at: nowIso,
          updated_at: nowIso,
          org_id: orgId,
        })
        .select('id')
        .maybeSingle();
      if (insertError) throw insertError;
      applications.push({ bill_id: alloc.bill_id, application_id: app?.id ?? null });
    } catch (error: any) {
      logger.error({ error, creditId: id, billId: alloc.bill_id }, 'Failed to apply vendor credit');
      const message = error?.message ?? 'Unable to apply credit to bill';
      const status = message.toLowerCase().includes('reconciled') ? 409 : 422;
      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ success: true, applications });
}
