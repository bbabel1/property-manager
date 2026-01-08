import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; applicationId: string }> },
) {
  const { roles } = await requireAuth();
  if (!hasPermission(roles, 'bills.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
  }

  const { data: application, error: fetchError } = await supabaseAdmin
    .from('bill_applications')
    .select('id, bill_transaction_id, source_transaction_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!application || application.bill_transaction_id !== id) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (application.source_transaction_id) {
    const { data: sourceTx, error: sourceErr } = await supabaseAdmin
      .from('transactions')
      .select('id, is_reconciled')
      .eq('id', application.source_transaction_id)
      .maybeSingle();
    if (sourceErr) {
      return NextResponse.json({ error: sourceErr.message }, { status: 500 });
    }
    if (sourceTx && (sourceTx as any).is_reconciled) {
      return NextResponse.json(
        { error: 'Cannot modify applications for a reconciled payment' },
        { status: 409 },
      );
    }
  }

  const { error } = await supabaseAdmin.from('bill_applications').delete().eq('id', applicationId);
  if (error) {
    const msg = error.message || 'Unable to delete application';
    const status = msg.toLowerCase().includes('reconciled') ? 409 : 422;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ success: true, bill_id: id });
}
