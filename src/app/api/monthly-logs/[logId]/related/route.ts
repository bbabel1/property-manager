import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

const DEFAULT_RELATED_LIMIT = 48;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId: _logId } = await params;
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('unitId');
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 6), 72)
      : DEFAULT_RELATED_LIMIT;

    if (!unitId) {
      return NextResponse.json({ items: [] });
    }

    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    const { data, error } = await supabase
      .from('monthly_logs')
      .select('id, period_start, status')
      .eq('unit_id', unitId)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching related monthly logs', error);
      return NextResponse.json({ error: 'Failed to load related logs' }, { status: 500 });
    }

    const items =
      data?.map((log) => ({
        id: log.id,
        label: formatPeriodLabel(log.period_start),
        status: log.status ?? 'pending',
      })) ?? [];

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/related:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatPeriodLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
