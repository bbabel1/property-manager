import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireRole('platform_admin');

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate');

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glAccountBalance', entityId: id, asOfDate }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = data?.data || data
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.error('Error fetching Buildium GL account balance');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
