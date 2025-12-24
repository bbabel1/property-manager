import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabaseClient } from '@/lib/supabase-client';
import type { BuildiumGLAccount, BuildiumGLAccountBalance } from '@/types/buildium';

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

    // Require platform admin
    await requireRole('platform_admin');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const type = searchParams.get('type') || searchParams.get('accountType');
    const isActive = searchParams.get('isActive');
    const asOfDate = searchParams.get('asOfDate');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (type) queryParams.append('type', type);
    if (isActive) queryParams.append('isActive', isActive);
    const supabase = getServerSupabaseClient('gl accounts balances');

    // Step 1: fetch accounts from edge function
    const { data: listData, error: listErr } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glAccounts', params: { limit, offset, type } }
    })
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
    const accounts = (listData?.data || listData) as BuildiumGLAccount[] | undefined;
    const balances: BuildiumGLAccountBalance[] = [];

    // Step 2: for each account, fetch its balance
    for (const acc of accounts || []) {
      // Fetch each balance via edge function
      const { data: balData, error: balErr } = await supabase.functions.invoke('buildium-sync', {
        body: { method: 'GET', entityType: 'glAccountBalance', entityId: acc.Id, asOfDate }
      })
      if (!balErr) {
        const bal = (balData?.data || balData) as BuildiumGLAccountBalance | null;
        if (bal) balances.push(bal);
      }
    }

    logger.info('Aggregated GL account balances successfully');
    return NextResponse.json({ success: true, data: balances, count: balances.length });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium general ledger account balances`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
