import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: { logId: string; transactionId: string } },
) {
  try {
    const roles: AppRole[] =
      process.env.NODE_ENV === 'development'
        ? ['platform_admin']
        : (await requireAuth()).roles;

    if (!hasPermission(roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { logId, transactionId } = params;

    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('id, lease_id')
      .eq('id', logId)
      .maybeSingle();

    if (logError) throw logError;
    if (!monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, lease_id, monthly_log_id')
      .eq('id', transactionId)
      .maybeSingle();

    if (txError) throw txError;
    if (!transaction) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
        { status: 404 },
      );
    }

    if (transaction.monthly_log_id && transaction.monthly_log_id !== logId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Transaction is not part of this monthly log' } },
        { status: 403 },
      );
    }

    if (
      monthlyLog.lease_id != null &&
      transaction.lease_id != null &&
      String(monthlyLog.lease_id) !== String(transaction.lease_id)
    ) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Transaction is not linked to this lease' } },
        { status: 403 },
      );
    }

    await supabaseAdmin.from('transaction_lines').delete().eq('transaction_id', transactionId);
    await supabaseAdmin.from('journal_entries').delete().eq('transaction_id', transactionId);
    const { error: deleteTxError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (deleteTxError) {
      throw deleteTxError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/monthly-logs/[logId]/transactions/[transactionId]:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
