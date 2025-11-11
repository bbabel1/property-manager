/**
 * Escrow Stage API
 *
 * GET: Returns escrow balance and movements for the monthly log period
 * POST: Creates a new escrow transaction (deposit or withdrawal)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import {
  getEscrowBalance,
  getEscrowMovements,
  createEscrowTransaction,
} from '@/lib/escrow-calculations';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// Request validation schema for POST
const createEscrowTransactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.number().positive(),
  memo: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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

    // Fetch monthly log to get unit and period
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('unit_id, period_start')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Calculate period dates
    const periodStart = new Date(monthlyLog.period_start);
    const fromDate = format(startOfMonth(periodStart), 'yyyy-MM-dd');
    const toDate = format(endOfMonth(periodStart), 'yyyy-MM-dd');

    // Get escrow balance up to end of period
    const balance = await getEscrowBalance(monthlyLog.unit_id, toDate);

    // Get escrow movements for this period
    const movements = await getEscrowMovements(monthlyLog.unit_id, fromDate, toDate);

    return NextResponse.json({
      deposits: balance.deposits,
      withdrawals: balance.withdrawals,
      balance: balance.balance,
      hasValidGLAccounts: balance.hasValidGLAccounts,
      movements,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/escrow:', error);

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
    const validation = createEscrowTransactionSchema.safeParse(body);
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

    const { type, amount, memo, date } = validation.data;

    // Fetch monthly log to get unit
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('unit_id')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Create escrow transaction
    const transactionId = await createEscrowTransaction({
      unitId: monthlyLog.unit_id,
      date,
      memo,
      amount,
      type,
    });

    return NextResponse.json({ success: true, transactionId });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/escrow:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message.includes('No escrow GL account')) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
