/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { canonicalizeEventName } from "./eventValidation.ts"

export interface NormalizedBuildiumWebhook {
  buildiumWebhookId: string
  eventName: string
  eventCreatedAt: string
  eventEntityId: string
}

export type NormalizationResult =
  | { ok: true; errors: []; normalized: NormalizedBuildiumWebhook }
  | { ok: false; errors: string[]; normalized: null }

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ts = value < 1_000_000_000_000 ? value * 1000 : value
    const d = new Date(ts)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

function extractEventName(event: any): string | null {
  const value =
    event?.EventType ??
    event?.EventName ??
    event?.eventType ??
    event?.type ??
    event?.Data?.EventType ??
    event?.Data?.EventName
  if (typeof value === 'string' && value.trim().length) return canonicalizeEventName(value)
  return null
}

function extractPrimaryId(event: any): string | null {
  const candidate =
    event?.Id ??
    event?.EventId ??
    event?.eventId ??
    event?.TransactionId ??
    event?.LeaseId ??
    event?.BillId ??
    event?.PaymentId ??
    (Array.isArray(event?.BillIds) && event?.BillIds.length ? event.BillIds[0] : null) ??
    event?.PropertyId ??
    event?.UnitId ??
    event?.GLAccountId ??
    event?.TaskId ??
    event?.TaskCategoryId ??
    event?.VendorId ??
    event?.VendorCategoryId ??
    event?.WorkOrderId ??
    event?.RentalOwnerId ??
    event?.BankAccountId ??
    event?.AccountId ??
    event?.EntityId ??
    event?.Data?.TransactionId ??
    event?.Data?.BillId ??
    (Array.isArray(event?.Data?.BillIds) && event?.Data?.BillIds.length ? event.Data.BillIds[0] : null) ??
    event?.Data?.PropertyId ??
    event?.Data?.UnitId ??
    event?.Data?.GLAccountId ??
    event?.Data?.TaskId ??
    event?.Data?.TaskCategoryId ??
    event?.Data?.VendorId ??
    event?.Data?.VendorCategoryId ??
    event?.Data?.WorkOrderId ??
    event?.Data?.RentalOwnerId ??
    event?.Data?.BankAccountId ??
    event?.Data?.AccountId ??
    event?.Data?.Id
  return candidate != null && candidate !== '' ? String(candidate) : null
}

function extractEntityId(event: any, primaryId: string | null): string | null {
  const candidate =
    event?.EntityId ??
    event?.LeaseId ??
    event?.TransactionId ??
    event?.PropertyId ??
    event?.UnitId ??
    event?.BillId ??
    event?.WorkOrderId ??
    event?.TaskId ??
    event?.VendorId ??
    event?.Data?.TransactionId ??
    event?.Data?.EntityId
  if (candidate != null && candidate !== '') return String(candidate)
  if (primaryId != null) return primaryId
  return null
}

export function normalizeBuildiumWebhookEvent(event: any): NormalizationResult {
  const errors: string[] = []
  const eventName = extractEventName(event)
  if (!eventName) errors.push('missing EventType/EventName')

  const eventCreatedAt =
    normalizeTimestamp(event?.EventDate) ||
    normalizeTimestamp(event?.EventDateTime) ||
    normalizeTimestamp((event as any)?.eventDateTime) ||
    normalizeTimestamp((event as any)?.EventTimestamp) ||
    normalizeTimestamp((event as any)?.Timestamp) ||
    normalizeTimestamp(event?.Data?.EventDate) ||
    normalizeTimestamp(event?.Data?.EventDateTime)
  if (!eventCreatedAt) errors.push('missing or invalid EventDate/EventDateTime')

  const primaryId = extractPrimaryId(event)
  if (!primaryId) errors.push('missing Id/EventId/TransactionId')

  const eventEntityId = extractEntityId(event, primaryId)
  if (!eventEntityId) errors.push('missing entity identifier')

  if (errors.length) {
    return { ok: false, errors, normalized: null }
  }

  return {
    ok: true,
    errors: [],
    normalized: {
      buildiumWebhookId: primaryId!,
      eventName: eventName!,
      eventCreatedAt: eventCreatedAt!,
      eventEntityId: eventEntityId!,
    },
  }
}

type InsertResult =
  | { status: 'inserted'; id: string | null; normalized: NormalizedBuildiumWebhook }
  | { status: 'duplicate'; id: string | null; normalized: NormalizedBuildiumWebhook }
  | { status: 'invalid'; id: string | null; errors: string[] }

export async function insertBuildiumWebhookEventRecord(
  supabase: any,
  event: any,
  opts?: { webhookType?: string | null; signature?: string | null }
): Promise<InsertResult> {
  const normalizedResult = normalizeBuildiumWebhookEvent(event)
  if (!normalizedResult.ok || !normalizedResult.normalized) {
    const now = new Date().toISOString()
    const surrogateId = `invalid-${Math.random().toString(36).slice(2, 10)}`
    const eventName =
      (event?.EventType as string) ||
      (event?.EventName as string) ||
      (event?.eventType as string) ||
      (event?.type as string) ||
      'invalid'
    const deadLetterRow = {
      buildium_webhook_id: surrogateId,
      event_name: eventName,
      event_created_at: now,
      event_entity_id: surrogateId,
      event_id: event?.EventId ?? event?.Id ?? surrogateId,
      event_type: eventName,
      event_data: event,
      payload: event,
      processed: true,
      processed_at: now,
      status: 'invalid',
      error: normalizedResult.errors.join('; '),
      webhook_type: opts?.webhookType ?? null,
      signature: opts?.signature ?? null,
    }

    // Best-effort dead letter; ignore duplicate/constraint errors
    await supabase.from('buildium_webhook_events').insert(deadLetterRow)

    return { status: 'invalid', id: null, errors: normalizedResult.errors }
  }

  const normalized = normalizedResult.normalized
  const row = {
    buildium_webhook_id: normalized.buildiumWebhookId,
    event_name: normalized.eventName,
    event_created_at: normalized.eventCreatedAt,
    event_entity_id: normalized.eventEntityId,
    event_id: normalized.buildiumWebhookId,
    event_type: normalized.eventName,
    event_data: event,
    payload: event,
    processed: false,
    status: 'received',
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

export async function deadLetterBuildiumEvent(
  supabase: any,
  event: any,
  errors: string[],
  opts?: { webhookType?: string | null; signature?: string | null }
) {
  const normalization = normalizeBuildiumWebhookEvent(event)
  const now = new Date().toISOString()
  const buildiumWebhookId =
    normalization.ok && normalization.normalized
      ? normalization.normalized.buildiumWebhookId
      : `invalid-${Math.random().toString(36).slice(2, 10)}`
  const eventName =
    (normalization.ok && normalization.normalized && normalization.normalized.eventName) ||
    extractEventName(event) ||
    'invalid'
  const eventCreatedAt =
    (normalization.ok && normalization.normalized && normalization.normalized.eventCreatedAt) || now
  const eventEntityId =
    (normalization.ok && normalization.normalized && normalization.normalized.eventEntityId) || buildiumWebhookId

  const row = {
    buildium_webhook_id: buildiumWebhookId,
    event_name: eventName,
    event_created_at: eventCreatedAt,
    event_entity_id: eventEntityId,
    event_id: buildiumWebhookId,
    event_type: eventName,
    event_data: event,
    payload: event,
    processed: true,
    processed_at: now,
    status: 'invalid',
    error: errors.join('; '),
    webhook_type: opts?.webhookType ?? null,
    signature: opts?.signature ?? null,
  }

  const res = await supabase.from('buildium_webhook_events').insert(row).select('id').maybeSingle()
  if (res.error?.code === '23505') {
    await supabase
      .from('buildium_webhook_events')
      .update({ status: 'invalid', error: row.error, processed: true, processed_at: now })
      .eq('buildium_webhook_id', buildiumWebhookId)
      .eq('event_name', eventName)
      .eq('event_created_at', eventCreatedAt)
  }
}
