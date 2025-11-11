/**
 * Owner Draw Calculation API
 *
 * Returns the calculated owner draw and breakdown.
 * Owner draw totals all transaction lines booked to the "Owner Draw" GL account.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { calculateFinancialSummary } from '@/lib/monthly-log-calculations';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    const summary = await calculateFinancialSummary(logId, {
      includeOwnerDrawTransactions: true,
    });

    return NextResponse.json({
      ownerDraw: summary.ownerDraw,
      transactions: summary.ownerDrawTransactions ?? [],
      totals: {
        previousNetToOwner: summary.previousBalance,
        totalPayments: summary.totalPayments,
        totalBills: summary.totalBills,
        escrowAmount: summary.escrowAmount,
        managementFees: summary.managementFees,
      },
      netToOwner: summary.netToOwner,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/owner-draw:', error);

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
