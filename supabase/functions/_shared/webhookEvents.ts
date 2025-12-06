const FALLBACK_EVENT_CREATED_AT = '1970-01-01T00:00:00.000Z'
const FALLBACK_ENTITY_ID = 'unknown'

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ts = value < 1_000_000_000_000 ? value * 1000 : value
    return new Date(ts).toISOString()
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return FALLBACK_EVENT_CREATED_AT
}

export interface NormalizedBuildiumWebhook {
  buildiumWebhookId: string
  eventName: string
  eventCreatedAt: string
  eventEntityId: string
}

export function normalizeBuildiumWebhookEvent(event: any): NormalizedBuildiumWebhook {
  const eventName = String(
    event?.EventType ??
      event?.EventName ??
      event?.eventType ??
      event?.type ??
      event?.Data?.EventType ??
      'unknown'
  )

  const eventCreatedAt = normalizeTimestamp(
    event?.EventDate ??
      event?.EventDateTime ??
      event?.eventDateTime ??
      event?.EventTimestamp ??
      event?.Timestamp ??
      event?.Data?.EventDate ??
      event?.Data?.EventDateTime
  )

  const primaryId =
    event?.Id ??
    event?.EventId ??
    event?.eventId ??
    event?.TransactionId ??
    event?.LeaseId ??
    event?.EntityId ??
    event?.Data?.TransactionId ??
    event?.Data?.Id

  const buildiumWebhookId = String(
    primaryId ??
      `${eventName}:${event?.EntityId ?? event?.LeaseId ?? event?.TransactionId ?? 'unknown'}:${eventCreatedAt}`
  )

  const eventEntityId = String(
    event?.EntityId ??
      event?.LeaseId ??
      event?.TransactionId ??
      event?.PropertyId ??
      event?.UnitId ??
      event?.BillId ??
      event?.Data?.TransactionId ??
      event?.Data?.EntityId ??
      FALLBACK_ENTITY_ID
  )

  return { buildiumWebhookId, eventName, eventCreatedAt, eventEntityId }
}

type InsertResult =
  | { status: 'inserted'; id: string | null; normalized: NormalizedBuildiumWebhook }
  | { status: 'duplicate'; id: string | null; normalized: NormalizedBuildiumWebhook }

export async function insertBuildiumWebhookEventRecord(
  supabase: any,
  event: any,
  opts?: { webhookType?: string | null; signature?: string | null }
): Promise<InsertResult> {
  const normalized = normalizeBuildiumWebhookEvent(event)

  const row = {
    buildium_webhook_id: normalized.buildiumWebhookId,
    event_name: normalized.eventName,
    event_created_at: normalized.eventCreatedAt,
    event_entity_id: normalized.eventEntityId,
    event_id: normalized.buildiumWebhookId,
    event_type: normalized.eventName,
    event_data: event,
    processed: false,
    webhook_type: opts?.webhookType ?? null,
    signature: opts?.signature ?? null,
  }

  const insertResponse = await supabase
    .from('buildium_webhook_events')
    .insert(row)
    .select('id')
    .maybeSingle()

  if (insertResponse.error?.code === '23505') {
    // Fetch the existing row to reference in logs/metrics.
    const existing = await supabase
      .from('buildium_webhook_events')
      .select('id')
      .eq('buildium_webhook_id', normalized.buildiumWebhookId)
      .eq('event_name', normalized.eventName)
      .eq('event_created_at', normalized.eventCreatedAt)
      .maybeSingle()

    return { status: 'duplicate', id: existing.data?.id ?? null, normalized }
  }

  if (insertResponse.error) {
    throw insertResponse.error
  }

  return { status: 'inserted', id: insertResponse.data?.id ?? null, normalized }
}
