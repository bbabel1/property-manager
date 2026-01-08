import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, roles } = await requireAuth();
  const { id } = await params;
  const now = new Date().toISOString();

  if (!hasPermission(roles, 'bills.approve')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: bill } = await supabaseAdmin
    .from('transactions')
    .select('id, org_id')
    .eq('id', id)
    .eq('transaction_type', 'Bill')
    .maybeSingle();
  if (!bill?.id) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  const { data: wf } = await supabaseAdmin
    .from('bill_workflow')
    .select('approval_state')
    .eq('bill_transaction_id', id)
    .maybeSingle();
  const currentState = (wf as any)?.approval_state ?? 'draft';
  if (currentState !== 'pending_approval') {
    return NextResponse.json(
      { error: 'Bill must be in pending approval to approve' },
      { status: 409 },
    );
  }

  await supabaseAdmin
    .from('bill_workflow')
    .upsert(
      {
        bill_transaction_id: id,
        org_id: bill.org_id,
        approval_state: 'approved',
        approved_by_user_id: user.id,
        approved_at: now,
        updated_at: now,
      },
      { onConflict: 'bill_transaction_id' },
    );

  await supabaseAdmin.from('bill_approval_audit').insert({
    bill_transaction_id: id,
    action: 'approved',
    from_state: currentState,
    to_state: 'approved',
    user_id: user.id,
    notes: null,
    created_at: now,
  });

  return NextResponse.json({ success: true });
}
