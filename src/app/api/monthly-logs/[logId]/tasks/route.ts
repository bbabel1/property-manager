import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import {
  createMonthlyLogTask,
  listMonthlyLogTasks,
  type CreateMonthlyLogTaskInput,
} from '@/server/monthly-logs/tasks';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId } = await params;
    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    const tasks = await listMonthlyLogTasks(logId, supabase);
    return NextResponse.json({ items: tasks });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/tasks:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId } = await params;
    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    const payload = ((await request.json().catch(() => ({}))) ??
      {}) as Partial<CreateMonthlyLogTaskInput>;

    const task = await createMonthlyLogTask(
      logId,
      {
        subject: payload.subject ?? '',
        description: payload.description ?? null,
        dueDate: payload.dueDate ?? null,
        priority: (payload.priority as CreateMonthlyLogTaskInput['priority']) ?? 'normal',
        status: (payload.status as CreateMonthlyLogTaskInput['status']) ?? 'new',
        category: payload.category ?? null,
        assignedTo: payload.assignedTo ?? null,
      },
      supabase,
    );
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/tasks:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
