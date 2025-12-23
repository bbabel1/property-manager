// deno-lint-ignore-file
import type { NormalizedBuildiumWebhook } from "./webhookEvents.ts"
import type { RoutingDecision } from "./eventRouting.ts"

const LOG_FORWARDER_URL =
  Deno.env.get('LOG_FORWARDER_URL') ||
  Deno.env.get('ALERT_FORWARDER_URL') ||
  Deno.env.get('ALERT_WEBHOOK_URL') ||
  null
const PD_ROUTING_KEY = Deno.env.get('PD_ROUTING_KEY') || null
const DEFAULT_SEVERITY = (decision: RoutingDecision) =>
  decision === 'dead-letter' ? 'error' : 'warning'

type TelemetrySource = 'buildium-webhook' | 'buildium-lease-transactions'

function buildForwardBody(
  source: TelemetrySource,
  decision: RoutingDecision,
  normalized: NormalizedBuildiumWebhook,
  eventType: string
) {
  const baseDetails = {
    metric: `${source}.unsupported_event`,
    source,
    decision,
    eventType,
    eventId: normalized.buildiumWebhookId,
    eventCreatedAt: normalized.eventCreatedAt,
    eventName: normalized.eventName,
    eventEntityId: normalized.eventEntityId,
    timestamp: new Date().toISOString(),
  }
  if (PD_ROUTING_KEY) {
    // PagerDuty Events API v2 format
    return {
      routing_key: PD_ROUTING_KEY,
      event_action: 'trigger',
      dedup_key: `${normalized.buildiumWebhookId}-${eventType}-${decision}`,
      payload: {
        summary: `${eventType} ${decision}`,
        source,
        severity: DEFAULT_SEVERITY(decision),
        component: source,
        group: source,
        custom_details: baseDetails,
      },
    }
  }
  return baseDetails
}

async function forwardRoutingLog(
  source: TelemetrySource,
  decision: RoutingDecision,
  normalized: NormalizedBuildiumWebhook,
  eventType: string
) {
  if (!LOG_FORWARDER_URL) return
  const body = buildForwardBody(source, decision, normalized, eventType)

  try {
    await fetch(LOG_FORWARDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.warn('telemetry log forward failed', {
      source,
      eventType,
      decision,
      error: (error as any)?.message,
    })
  }
}

export async function emitRoutingTelemetry(
  source: TelemetrySource,
  decision: RoutingDecision,
  normalized: NormalizedBuildiumWebhook,
  eventType: string
) {
  const payload = {
    metric: `${source}.unsupported_event`,
    decision,
    eventType,
    eventId: normalized.buildiumWebhookId,
    eventCreatedAt: normalized.eventCreatedAt,
  }
  console.warn('webhook routing decision', payload)
  await forwardRoutingLog(source, decision, normalized, eventType)
}
