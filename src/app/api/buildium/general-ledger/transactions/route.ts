import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const glAccountId = searchParams.get('glAccountId') || searchParams.get('accountId');

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glTransactions', params: { limit, offset, orderby, dateFrom, dateTo, glAccountId } }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const transactions = data?.data || data
    return NextResponse.json({ success: true, data: transactions, count: Array.isArray(transactions) ? transactions.length : undefined })

  } catch (error) {
    logger.error(`Error fetching Buildium general ledger transactions`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
