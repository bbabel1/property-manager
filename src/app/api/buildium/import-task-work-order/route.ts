import { NextResponse } from 'next/server';

import { createBuildiumClient, defaultBuildiumConfig } from '@/lib/buildium-client';
import { mapTaskFromBuildiumWithRelations, mapWorkOrderFromBuildiumWithRelations } from '@/lib/buildium-mappers';
import { supabase, supabaseAdmin } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

const db = supabaseAdmin || supabase;

const BUILD_DEFAULTS = {
  taskId: 12652,
  workOrderId: 1965,
};

function ensureBuildiumCredentials() {
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Buildium credentials are not configured. Set BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

function getBuildiumClient() {
  const { clientId, clientSecret } = ensureBuildiumCredentials();
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId,
    clientSecret,
  });
}

async function upsertTaskFromBuildium(taskId: number, client: ReturnType<typeof createBuildiumClient>) {
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

  if (existing?.id) {
    const { error } = await db.from('tasks').update(localPayload).eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated', localId: existing.id, buildiumId: buildiumTask.Id };
  }

  const { data: inserted, error: insertError } = await db
    .from('tasks')
    .insert(localPayload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: buildiumTask.Id };
}

async function upsertWorkOrderFromBuildium(
  workOrderId: number,
  client: ReturnType<typeof createBuildiumClient>,
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
    const { error } = await db.from('work_orders').update(localPayload).eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated', localId: existing.id, buildiumId: buildiumWorkOrder.Id };
  }

  const { data: inserted, error: insertError } = await db
    .from('work_orders')
    .insert(localPayload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: buildiumWorkOrder.Id };
}

export async function POST(request: Request) {
  try {
    await requireRole('platform_admin');
    const body = await request.json().catch(() => ({}));
    const taskIdInput = Number(body?.taskId ?? BUILD_DEFAULTS.taskId);
    const workOrderIdInput = Number(body?.workOrderId ?? BUILD_DEFAULTS.workOrderId);

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

    const buildiumClient = getBuildiumClient();

    const [taskResult, workOrderResult] = await Promise.all([
      upsertTaskFromBuildium(taskIdInput, buildiumClient),
      upsertWorkOrderFromBuildium(workOrderIdInput, buildiumClient),
    ]);

    return NextResponse.json({
      success: true,
      task: taskResult,
      workOrder: workOrderResult,
    });
  } catch (error) {
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
