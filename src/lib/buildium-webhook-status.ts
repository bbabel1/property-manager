import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type TypedSupabaseClient = SupabaseClient<Database>

export type BuildiumWebhookKey = {
  buildiumWebhookId: string
  eventName: string
  eventCreatedAt: string
}

async function updateWebhookStatus(
  client: TypedSupabaseClient,
  key: BuildiumWebhookKey,
  status: string,
  opts?: { error?: string | null }
) {
  const updates: {
    status: string
    error: string | null
    error_message: string | null
    processed: boolean
    processed_at: string | null
  } = {
    status,
    error: opts?.error ?? null,
    error_message: opts?.error ?? null,
    processed: false,
    processed_at: null,
  }
  if (status === 'processed' || status === 'tombstoned') {
    updates.processed = true
    updates.processed_at = new Date().toISOString()
  }
  await client
    .from('buildium_webhook_events')
    .update(updates)
    .eq('buildium_webhook_id', key.buildiumWebhookId)
    .eq('event_name', key.eventName)
    .eq('event_created_at', key.eventCreatedAt)
}

export async function markWebhookError(client: TypedSupabaseClient, key: BuildiumWebhookKey, message: string) {
  await updateWebhookStatus(client, key, 'error', { error: message })
}

export async function markWebhookTombstone(client: TypedSupabaseClient, key: BuildiumWebhookKey, message: string) {
  await updateWebhookStatus(client, key, 'tombstoned', { error: message })
}
