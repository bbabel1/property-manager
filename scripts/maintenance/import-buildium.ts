import fs from 'node:fs';
import path from 'node:path';

import { config } from 'dotenv';

const cwd = process.cwd();
const envLocalPath = path.resolve(cwd, '.env.local');
const envPath = path.resolve(cwd, '.env');

if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}
if (fs.existsSync(envPath)) {
  config({ path: envPath, override: false });
}

const DEFAULT_TASK_ID = 12652;
const DEFAULT_WORK_ORDER_ID = 1965;

async function ensureBuildiumClient() {
  const { createBuildiumClient, defaultBuildiumConfig } = await import('@/lib/buildium-client');
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Buildium credentials. Please set BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET.',
    );
  }

  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId,
    clientSecret,
  });
}

async function getDbClients() {
  const { supabase, supabaseAdmin } = await import('@/lib/db');
  return supabaseAdmin || supabase;
}

async function upsertTask(taskId: number, client: any, db: any) {
  const { mapTaskFromBuildiumWithRelations } = await import('@/lib/buildium-mappers');
  const task = await client.getTask(taskId);
  const payload = await mapTaskFromBuildiumWithRelations(task, db);

  const { data: existing, error: existingError } = await db
    .from('tasks')
    .select('id')
    .eq('buildium_task_id', task.Id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await db.from('tasks').update(payload).eq('id', existing.id);
    if (updateError) throw updateError;
    return { action: 'updated', localId: existing.id, buildiumId: task.Id };
  }

  const { data: inserted, error: insertError } = await db
    .from('tasks')
    .insert(payload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: task.Id };
}

async function upsertWorkOrder(workOrderId: number, client: any, db: any) {
  const { mapWorkOrderFromBuildiumWithRelations } = await import('@/lib/buildium-mappers');
  const workOrder = await client.getWorkOrder(workOrderId);
  const payload = await mapWorkOrderFromBuildiumWithRelations(workOrder, db);

  const { data: existing, error: existingError } = await db
    .from('work_orders')
    .select('id')
    .eq('buildium_work_order_id', workOrder.Id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await db.from('work_orders').update(payload).eq('id', existing.id);
    if (updateError) throw updateError;
    return { action: 'updated', localId: existing.id, buildiumId: workOrder.Id };
  }

  const { data: inserted, error: insertError } = await db
    .from('work_orders')
    .insert(payload)
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { action: 'inserted', localId: inserted.id, buildiumId: workOrder.Id };
}

async function main() {
  const taskId = Number(process.argv[2] ?? DEFAULT_TASK_ID);
  const workOrderId = Number(process.argv[3] ?? DEFAULT_WORK_ORDER_ID);

  if (!Number.isFinite(taskId) || taskId <= 0) {
    throw new Error(`Invalid task id "${process.argv[2]}".`);
  }

  if (!Number.isFinite(workOrderId) || workOrderId <= 0) {
    throw new Error(`Invalid work order id "${process.argv[3]}".`);
  }

  const [client, db] = await Promise.all([ensureBuildiumClient(), getDbClients()]);

  const [taskResult, workOrderResult] = await Promise.all([
    upsertTask(taskId, client, db),
    upsertWorkOrder(workOrderId, client, db),
  ]);

  console.log(JSON.stringify({ success: true, task: taskResult, workOrder: workOrderResult }, null, 2));
}

main().catch((error) => {
  if (!(error instanceof Error)) {
    try {
      console.error('Unexpected error object:', JSON.stringify(error, null, 2));
    } catch (_) {
      console.error('Unexpected error object:', error);
    }
  }
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
