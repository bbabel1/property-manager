import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, roles } = await requireAuth();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason =
    typeof body.reason === 'string' && body.reason.trim().length ? body.reason.trim() : null;

  if (!hasPermission(roles, 'bills.void')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: bill } = await supabaseAdmin
    .from('transactions')
    .select('id, org_id')
    .eq('id', id)
    .eq('transaction_type', 'Bill')
    .maybeSingle();
  if (!bill?.id) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.rpc('void_bill', {
    p_bill_transaction_id: id,
    p_user_id: user.id,
    p_reason: reason ?? undefined,
  });

  if (error) {
    const msg = (error as any)?.message || 'Unable to void bill';
    const status = msg.toLowerCase().includes('reconciled') ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ success: true });
}
