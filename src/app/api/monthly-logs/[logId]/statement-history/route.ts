/**
 * Statement Email History API
 *
 * GET /api/monthly-logs/[logId]/statement-history
 * Returns the audit log of all statement emails sent for this monthly log.
 */

import { NextResponse } from 'next/server';
import { getStatementEmailHistory } from '@/lib/monthly-statement-email-service';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';

const isDevBypass = process.env.NODE_ENV === 'development';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    if (!isDevBypass) {
      const auth = await requireAuth();
      if (!hasPermission(auth.roles, 'monthly_logs.read')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 },
        );
      }
    }

    // Parse parameters
    const { logId } = await params;

    // Get email history
    const result = await getStatementEmailHistory(logId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'FETCH_FAILED',
            message: result.error || 'Failed to fetch email history',
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      history: result.history || [],
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/statement-history:', error);

    if (!isDevBypass && error instanceof Error && error.message === 'UNAUTHENTICATED') {
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
