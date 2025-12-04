import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { resolveUserOrgIds } from '@/lib/auth/org-access';
import { supabaseAdmin } from '@/lib/db';
import {
  createRecurringTaskForUnit,
  listRecurringTasksForUnit,
} from '@/server/monthly-logs/recurring-tasks';

export async function GET(request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const unitId = request.nextUrl.searchParams.get('unitId');
  if (!propertyId || !unitId) {
    return NextResponse.json({ error: 'propertyId and unitId are required' }, { status: 400 });
  }

  try {
    const auth = await requireAuth();
    const supabase = process.env.NODE_ENV === 'development' ? supabaseAdmin : auth.supabase;
    const orgIds = await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user });

    const items = await listRecurringTasksForUnit(supabase, { propertyId, unitId, orgIds });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/recurring-tasks:', error);
    if ((error as Error)?.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = (error as Error)?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const propertyId = typeof payload.propertyId === 'string' ? payload.propertyId : '';
    const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
    const title =
      typeof payload.title === 'string'
        ? payload.title
        : typeof payload.subject === 'string'
          ? payload.subject
          : '';
    if (!propertyId || !unitId) {
      return NextResponse.json({ error: 'propertyId and unitId are required' }, { status: 400 });
    }
    if (!title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const auth = await requireAuth();
    const supabase = process.env.NODE_ENV === 'development' ? supabaseAdmin : auth.supabase;
    const orgIds = await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user });

    const created = await createRecurringTaskForUnit(
      supabase,
      {
        propertyId,
        unitId,
        title,
        description:
          typeof payload.description === 'string' ? payload.description : payload.description ?? null,
        dueAnchor:
          payload.dueAnchor === 'period_start' || payload.dueAnchor === 'period_end'
            ? payload.dueAnchor
            : (payload.due_anchor as any),
        dueOffsetDays:
          typeof payload.dueOffsetDays === 'number'
            ? payload.dueOffsetDays
            : (payload.due_offset_days as number | undefined),
        frequency:
          typeof payload.frequency === 'string'
            ? payload.frequency
            : (payload.recurrence as string | undefined),
        interval: typeof payload.interval === 'number' ? payload.interval : undefined,
        isActive: payload.isActive === false ? false : true,
        assignedStaffId:
          typeof payload.assignedStaffId === 'number'
            ? payload.assignedStaffId
            : (payload.assigned_to_staff_id as number | undefined),
        additionalStaffIds: Array.isArray(payload.additionalStaffIds)
          ? (payload.additionalStaffIds as unknown[]).map((value) => Number(value))
          : [],
        autoAssignManager: payload.autoAssignManager !== false,
        reminders: Array.isArray(payload.reminders)
          ? (payload.reminders as unknown[]).map((value) => Number(value))
          : [],
      },
      orgIds,
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/recurring-tasks:', error);
    if ((error as Error)?.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = (error as Error)?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
