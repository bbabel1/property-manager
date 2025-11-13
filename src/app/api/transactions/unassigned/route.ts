import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { fetchMonthlyLogContext } from '@/lib/lease-transaction-helpers';
import { loadUnassignedTransactionsPage } from '@/server/monthly-logs/transactions';

const MIN_LIMIT = 10;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leaseParam = searchParams.get('leaseId');
    const monthlyLogId = searchParams.get('monthlyLogId');
    const cursor = searchParams.get('cursor');
    const scopeParam = searchParams.get('scope');
    const unitParam = searchParams.get('unitId');
    const requestedLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, MIN_LIMIT), MAX_LIMIT)
      : 50;
    const scope = scopeParam === 'unit' ? 'unit' : 'lease';

    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    let leaseId = leaseParam ? Number(leaseParam) : null;
    let unitId = unitParam;

    const needsLeaseId = scope === 'lease' && (!leaseId || Number.isNaN(leaseId));
    const needsUnitId = scope === 'unit' && !unitId;

    if (monthlyLogId && (needsLeaseId || needsUnitId)) {
      try {
        const context = await fetchMonthlyLogContext(monthlyLogId, supabase);
        if (needsLeaseId) {
          leaseId = context.lease?.leaseId ?? leaseId;
        }
        if (needsUnitId) {
          unitId = context.log?.unit_id ?? unitId;
        }
      } catch (contextError) {
        console.warn(
          'Failed to resolve lease id for unassigned transactions',
          contextError,
          monthlyLogId,
        );
      }
    }

    if (scope === 'lease' && (!leaseId || Number.isNaN(leaseId))) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    if (scope === 'unit') {
      if (!unitId) {
        return NextResponse.json({ items: [], nextCursor: null });
      }
      // TODO: Implement unit-level transaction discovery once unit-aware transactions exist.
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const page = await loadUnassignedTransactionsPage(
      {
        leaseId,
        unitId: null,
        scope,
        cursor: cursor || null,
        limit,
      },
      supabase,
    );

    return NextResponse.json(page);
  } catch (error) {
    console.error('Error in GET /api/transactions/unassigned:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
