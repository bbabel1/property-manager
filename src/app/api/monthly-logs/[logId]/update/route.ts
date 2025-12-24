import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import type { MonthlyLogStage, MonthlyLogStatus } from '@/components/monthly-logs/types';

const STAGES = new Set([
  'charges',
  'payments',
  'bills',
  'escrow',
  'management_fees',
  'owner_statements',
  'owner_distributions',
] as const);

const STATUSES = new Set(['pending', 'in_progress', 'complete'] as const);

type PatchPayload = {
  stage?: string;
  status?: string;
  sortIndex?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId: id } = await params;

    // In development, use admin client for testing
    const supabase =
      process.env.NODE_ENV === 'development'
        ? (await import('@/lib/db')).supabaseAdmin
        : (await requireAuth()).supabase;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing monthly log id' },
        { status: 400 },
      );
    }

    const payload = (await request.json()) as PatchPayload | null;
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof payload.stage === 'string') {
      const value = payload.stage.trim().toLowerCase();
      if (!STAGES.has(value as MonthlyLogStage)) {
        return NextResponse.json({ success: false, error: 'Invalid stage value' }, { status: 400 });
      }
      updates.stage = value;
    }

    if (typeof payload.status === 'string') {
      const value = payload.status.trim().toLowerCase();
      if (!STATUSES.has(value as MonthlyLogStatus)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status value' },
          { status: 400 },
        );
      }
      updates.status = value;
    }

    if (typeof payload.sortIndex === 'number' && Number.isFinite(payload.sortIndex)) {
      updates.sort_index = Math.round(payload.sortIndex);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('monthly_logs').update(updates).eq('id', id);

    if (error) {
      console.error('Failed to update monthly log', error);
      console.error('Update payload:', updates);
      console.error('Monthly log ID:', id);
      return NextResponse.json(
        { success: false, error: 'Failed to update monthly log', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error updating monthly log', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 });
  }
}
