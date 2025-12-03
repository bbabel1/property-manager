/**
 * Monthly Statement HTML Preview API
 *
 * GET /api/monthly-logs/[logId]/preview-statement
 * Returns HTML preview of the monthly statement (useful for debugging).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import {
  fetchMonthlyStatementData,
  renderMonthlyStatementHTML,
} from '@/lib/monthly-statement-service';

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

    // Fetch statement data
    const dataResult = await fetchMonthlyStatementData(logId);
    if (!dataResult.success || !dataResult.data) {
      return NextResponse.json(
        {
          error: { code: 'DATA_FETCH_FAILED', message: dataResult.error || 'Failed to fetch data' },
        },
        { status: 500 },
      );
    }

    const html = await renderMonthlyStatementHTML(dataResult.data);

    // Return HTML response
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/preview-statement:', error);

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
