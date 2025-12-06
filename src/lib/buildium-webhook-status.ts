export type BuildiumWebhookKey = {
  buildiumWebhookId: string
  eventName: string
  eventCreatedAt: string
}

async function updateWebhookStatus(
  client: any,
  key: BuildiumWebhookKey,
  status: string,
  opts?: { error?: string | null }
) {
  const updates: Record<string, any> = {
    status,
    error: opts?.error ?? null,
    error_message: opts?.error ?? null,
  }
  if (status === 'processed' || status === 'tombstoned') {
    updates.processed = true
    updates.processed_at = new Date().toISOString()
  } else {
    updates.processed = false
    updates.processed_at = null
  }
  await client
    .from('buildium_webhook_events')
    .update(updates)
    .eq('buildium_webhook_id', key.buildiumWebhookId)
    .eq('event_name', key.eventName)
    .eq('event_created_at', key.eventCreatedAt)
}

export async function markWebhookError(client: any, key: BuildiumWebhookKey, message: string) {
  await updateWebhookStatus(client, key, 'error', { error: message })
}

export async function markWebhookTombstone(client: any, key: BuildiumWebhookKey, message: string) {
  await updateWebhookStatus(client, key, 'tombstoned', { error: message })
}
