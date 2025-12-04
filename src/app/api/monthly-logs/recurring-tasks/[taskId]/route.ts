import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { resolveUserOrgIds } from '@/lib/auth/org-access';
import { supabaseAdmin } from '@/lib/db';
import {
  deleteRecurringTaskForUnit,
  updateRecurringTaskForUnit,
} from '@/server/monthly-logs/recurring-tasks';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> | { taskId: string } },
) {
  try {
    const { taskId } = params instanceof Promise ? await params : params;
    if (!taskId) {
      return NextResponse.json({ error: 'Recurring task id is required' }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = await requireAuth();
    const supabase = process.env.NODE_ENV === 'development' ? supabaseAdmin : auth.supabase;
    const orgIds = await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user });

    const updated = await updateRecurringTaskForUnit(
      supabase,
      taskId,
      {
        title: typeof payload.title === 'string' ? payload.title : undefined,
        description:
          typeof payload.description === 'string'
            ? payload.description
            : (payload.description as string | null | undefined),
        dueAnchor:
          payload.dueAnchor === 'period_start' || payload.dueAnchor === 'period_end'
            ? payload.dueAnchor
            : (payload.due_anchor as any),
        dueOffsetDays:
          typeof payload.dueOffsetDays === 'number'
            ? payload.dueOffsetDays
            : (payload.due_offset_days as number | undefined),
        frequency: typeof payload.frequency === 'string' ? payload.frequency : undefined,
        interval: typeof payload.interval === 'number' ? payload.interval : undefined,
        isActive: payload.isActive === true || payload.isActive === false ? payload.isActive : undefined,
        assignedStaffId:
          typeof payload.assignedStaffId === 'number'
            ? payload.assignedStaffId
            : (payload.assigned_to_staff_id as number | undefined),
        additionalStaffIds: Array.isArray(payload.additionalStaffIds)
          ? (payload.additionalStaffIds as unknown[]).map((value) => Number(value))
          : undefined,
        autoAssignManager:
          payload.autoAssignManager === true || payload.autoAssignManager === false
            ? payload.autoAssignManager
            : undefined,
        reminders: Array.isArray(payload.reminders)
          ? (payload.reminders as unknown[]).map((value) => Number(value))
          : undefined,
      },
      orgIds,
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error in PATCH /api/monthly-logs/recurring-tasks/[taskId]:', error);
    if ((error as Error)?.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = (error as Error)?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> | { taskId: string } },
) {
  try {
    const { taskId } = params instanceof Promise ? await params : params;
    if (!taskId) {
      return NextResponse.json({ error: 'Recurring task id is required' }, { status: 400 });
    }

    const auth = await requireAuth();
    const supabase = process.env.NODE_ENV === 'development' ? supabaseAdmin : auth.supabase;
    const orgIds = await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user });
    await deleteRecurringTaskForUnit(supabase, taskId, orgIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/monthly-logs/recurring-tasks/[taskId]:', error);
    if ((error as Error)?.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = (error as Error)?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
