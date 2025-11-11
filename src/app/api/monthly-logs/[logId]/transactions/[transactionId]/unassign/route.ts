import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string; transactionId: string }> }
) {
  try {
    const { logId, transactionId } = await params;
    
    // In development, use admin client for testing
    const supabase = process.env.NODE_ENV === 'development' 
      ? supabaseAdmin 
      : (await requireAuth()).supabase;

    // Remove the monthly log assignment from the transaction
    const { error } = await supabase
      .from('transactions')
      .update({ monthly_log_id: null })
      .eq('id', transactionId)
      .eq('monthly_log_id', logId); // Ensure it belongs to this monthly log

    if (error) {
      console.error('Error unassigning transaction:', error);
      return NextResponse.json({ error: 'Failed to unassign transaction' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/monthly-logs/[logId]/transactions/[transactionId]/unassign:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
