/**
 * Generic Stage Transaction API
 *
 * Handles assign/unassign actions for all monthly log stages.
 * Replaces 8 separate endpoints with a single unified interface.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import {
  handleStageTransactionAction,
  type MonthlyLogStage,
  type StageTransactionAction,
} from '@/lib/monthly-log-stage-handler';

// Request validation schema
const stageTransactionSchema = z.object({
  stage: z.enum([
    'charges',
    'payments',
    'bills',
    'escrow',
    'management_fees',
    'owner_statements',
    'owner_distributions',
  ]),
  transactionIds: z.array(z.string().uuid()).min(1, 'At least one transaction ID required'),
  action: z.enum(['assign', 'unassign']),
});

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
    const body = await request.json();

    // Validate request
    const validation = stageTransactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validation.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { stage, transactionIds, action } = validation.data;

    // Execute action
    const result = await handleStageTransactionAction({
      monthlyLogId: logId,
      stage: stage as MonthlyLogStage,
      transactionIds,
      action: action as StageTransactionAction,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'OPERATION_FAILED',
            message: result.error || 'Failed to process stage transaction action',
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/stage-transactions:', error);

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
