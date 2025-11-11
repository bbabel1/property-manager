import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    const { logId } = await params;
    const { transactionIds } = await request.json();
    
    // In development, use admin client for testing
    const supabase = process.env.NODE_ENV === 'development' 
      ? supabaseAdmin 
      : (await requireAuth()).supabase;
    
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Invalid transaction IDs' }, { status: 400 });
    }

          // Update transactions to assign them to the monthly log
          const { error } = await supabase
            .from('transactions')
            .update({ monthly_log_id: logId })
            .in('id', transactionIds);

    if (error) {
      console.error('Error assigning transactions:', error);
      return NextResponse.json({ error: 'Failed to assign transactions' }, { status: 500 });
    }

    return NextResponse.json({ success: true, assigned: transactionIds.length });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/transactions/assign:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
