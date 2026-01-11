import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { logger } from '@/lib/logger';
import type { TablesInsert } from '@/types/database';
import { requireOrgMember } from '@/lib/auth/org-guards';

const ApplicationSchema = z.object({
  source_transaction_id: z.string().min(1),
  applied_amount: z.number().positive(),
  source_type: z.enum(['payment', 'credit', 'refund']).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const db = requireSupabaseAdmin('bill applications GET');
  const { id } = await params;
  const { data: bill, error: billErr } = await db
    .from('transactions')
    .select('id, org_id, transaction_type')
    .eq('id', id)
    .eq('transaction_type', 'Bill')
    .maybeSingle();
  if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  await requireOrgMember({ client: supabase, userId: user.id, orgId: String((bill as any).org_id) });

  const { data, error } = await db
    .from('bill_applications')
    .select(
      'id, applied_amount, source_transaction_id, source_type, applied_at, created_at, updated_at, org_id',
    )
    .eq('bill_transaction_id', id)
    .eq('org_id', (bill as any).org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const db = requireSupabaseAdmin('bill applications POST');
  const { id } = await params;
  const parsed = ApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const body = parsed.data;

  const { data: bill, error: billErr } = await db
    .from('transactions')
    .select('id, org_id, transaction_type')
    .eq('id', id)
    .maybeSingle();
  if (billErr) {
    return NextResponse.json({ error: billErr.message }, { status: 500 });
  }
  if (!bill || bill.transaction_type !== 'Bill') {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }
  await requireOrgMember({ client: supabase, userId: user.id, orgId: String((bill as any).org_id) });

  const { data: sourceTransaction, error: sourceErr } = await db
    .from('transactions')
    .select('id, org_id, is_reconciled')
    .eq('id', body.source_transaction_id)
    .eq('org_id', (bill as any).org_id)
    .maybeSingle();
  if (sourceErr) {
    return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  }
  if (!sourceTransaction) {
    return NextResponse.json({ error: 'Source transaction not found' }, { status: 404 });
  }
  if ((sourceTransaction as any).org_id !== bill.org_id) {
    return NextResponse.json(
      { error: 'Source transaction must belong to the same org' },
      { status: 422 },
    );
  }
  if ((sourceTransaction as any).is_reconciled) {
    return NextResponse.json(
      { error: 'Cannot modify applications for a reconciled payment' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  try {
    // Validate constraints before insert
    const { error: validationError } = await db.rpc('validate_bill_application', {
      p_bill_id: id,
      p_source_id: body.source_transaction_id,
      p_amount: body.applied_amount,
    });
    if (validationError) {
      return NextResponse.json(
        { error: validationError.message || 'Application validation failed' },
        { status: 422 },
      );
    }

    const insertPayload: TablesInsert<'bill_applications'> = {
      bill_transaction_id: id,
      source_transaction_id: body.source_transaction_id,
      source_type: body.source_type ?? 'payment',
      applied_amount: body.applied_amount,
      created_by_user_id: user.id,
      created_at: now,
      updated_at: now,
      org_id: bill.org_id,
      applied_at: now,
    };

    const { error } = await db.from('bill_applications').insert(insertPayload);
    if (error) {
      const msg = error.message || 'Unable to create application';
      const status = msg.toLowerCase().includes('reconciled') ? 409 : 422;
      return NextResponse.json({ error: msg }, { status });
    }
  } catch (err: any) {
    const msg = err?.message || 'Unable to create application';
    const status = msg.toLowerCase().includes('reconciled') ? 409 : 422;
    logger.error({ error: err, billId: id }, 'Failed to create bill application');
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ success: true });
}
