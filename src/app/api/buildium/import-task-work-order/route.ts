import { NextRequest, NextResponse } from 'next/server';

import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import { mapTaskFromBuildiumWithRelations, mapWorkOrderFromBuildiumWithRelations } from '@/lib/buildium-mappers';
import type { TypedSupabaseClient } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import type { Database } from '@/types/database';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update'];
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const BUILD_DEFAULTS = {
  taskId: 12652,
  workOrderId: 1965,
};

async function upsertTaskFromBuildium(
  taskId: number,
  client: Awaited<ReturnType<typeof getOrgScopedBuildiumClient>>,
  db: TypedSupabaseClient,
) {
  const buildiumTask = await client.getTask(taskId);
  const localPayload = await mapTaskFromBuildiumWithRelations(buildiumTask, db);

  const { data: existing, error: existingError } = await db
    .from('tasks')
    .select('id')
    .eq('buildium_task_id', buildiumTask.Id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const subject =
    typeof (localPayload as { subject?: unknown })?.subject === 'string'
      ? (localPayload as { subject?: string }).subject
      : '';

  if (existing?.id) {
    const updatePayload: TaskUpdate = {
      ...(localPayload as any),
      subject,
      updated_at: localPayload?.updated_at ?? new Date().toISOString(),
    };
    const { error } = await db.from('tasks').update(updatePayload).eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated', localId: existing.id, buildiumId: buildiumTask.Id };
  }

  const insertPayload: TaskInsert = {
    ...(localPayload as any),
    subject,
    created_at: localPayload?.created_at ?? new Date().toISOString(),
    updated_at: localPayload?.updated_at ?? new Date().toISOString(),
  };
  const { data: inserted, error: insertError } = await db
    .from('tasks')
    .insert(insertPayload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: buildiumTask.Id };
}

async function upsertWorkOrderFromBuildium(
  workOrderId: number,
  client: Awaited<ReturnType<typeof getOrgScopedBuildiumClient>>,
  db: TypedSupabaseClient,
) {
  const buildiumWorkOrder = await client.getWorkOrder(workOrderId);
  const localPayload = await mapWorkOrderFromBuildiumWithRelations(buildiumWorkOrder, db);

  const { data: existing, error: existingError } = await db
    .from('work_orders')
    .select('id')
    .eq('buildium_work_order_id', buildiumWorkOrder.Id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const updatePayload: WorkOrderUpdate = {
      ...localPayload,
      updated_at: localPayload?.updated_at ?? new Date().toISOString(),
    };
    const { error } = await db.from('work_orders').update(updatePayload).eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated', localId: existing.id, buildiumId: buildiumWorkOrder.Id };
  }

  const insertPayload: WorkOrderInsert = {
    ...localPayload,
    created_at: localPayload?.created_at ?? new Date().toISOString(),
    updated_at: localPayload?.updated_at ?? new Date().toISOString(),
  };
  const { data: inserted, error: insertError } = await db
    .from('work_orders')
    .insert(insertPayload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: buildiumWorkOrder.Id };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireRole('platform_admin');
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });
    const body: unknown = await request.json().catch(() => ({}));
    const bodyObj = isRecord(body) ? body : {};
    const taskIdInput = toNumber(bodyObj.taskId) ?? BUILD_DEFAULTS.taskId;
    const workOrderIdInput = toNumber(bodyObj.workOrderId) ?? BUILD_DEFAULTS.workOrderId;

    if (!Number.isFinite(taskIdInput) || taskIdInput <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid taskId supplied.' },
        { status: 400 },
      );
    }

    if (!Number.isFinite(workOrderIdInput) || workOrderIdInput <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid workOrderId supplied.' },
        { status: 400 },
      );
    }

    const buildiumClient = await getOrgScopedBuildiumClient(orgId);

    const [taskResult, workOrderResult] = await Promise.all([
      upsertTaskFromBuildium(taskIdInput, buildiumClient, db),
      upsertWorkOrderFromBuildium(workOrderIdInput, buildiumClient, db),
    ]);

    return NextResponse.json({
      success: true,
      task: taskResult,
      workOrder: workOrderResult,
      orgId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ success: false, error: 'Organization context required.' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
      }
    }
    console.error('Failed to import task and work order from Buildium', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to import data from Buildium.',
      },
      { status: 500 },
    );
  }
}
