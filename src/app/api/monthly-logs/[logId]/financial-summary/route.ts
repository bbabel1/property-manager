import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { loadAssignedTransactionsBundle } from '@/server/monthly-logs/transactions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId } = await params;

    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    const bundle = await loadAssignedTransactionsBundle(logId, supabase);

    return NextResponse.json(bundle.summary);
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/financial-summary:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
