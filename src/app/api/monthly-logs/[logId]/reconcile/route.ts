/**
 * Monthly Log Balance Reconciliation API
 *
 * Manually triggers recalculation of previous_lease_balance field.
 * Useful for fixing drift or after historical data corrections.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { reconcileMonthlyLogBalance } from '@/lib/monthly-log-calculations';

export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Execute reconciliation
    await reconcileMonthlyLogBalance(logId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/reconcile:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'RECONCILIATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to reconcile balance',
        },
      },
      { status: 500 },
    );
  }
}
