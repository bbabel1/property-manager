/**
 * Send Monthly Statement API
 *
 * POST /api/monthly-logs/[logId]/send-statement
 * Sends the monthly statement PDF via email to configured recipients.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { sendMonthlyStatement } from '@/lib/monthly-statement-email-service';

export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.send_statement')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions to send statements' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Send statement
    const result = await sendMonthlyStatement(logId, auth.user.id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'SEND_FAILED',
            message: result.error || 'Failed to send statement',
          },
        },
        { status: 500 },
      );
    }

    // Return success with details
    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      recipients: result.recipients,
      auditLogId: result.auditLogId,
    });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/send-statement:', error);

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
