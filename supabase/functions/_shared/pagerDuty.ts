// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Deno globals for Edge runtime (see https://typescript-eslint.io/rules/triple-slash-reference/)
/// <reference path="../../../types/deno.d.ts" />
// deno-lint-ignore-file
type PagerDutyPayload = {
  summary: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  source?: string
  component?: string
  group?: string
  dedup_key?: string
  custom_details?: Record<string, unknown>
}

/**
 * Lightweight PagerDuty events v2 notifier for Deno edge functions.
 * No-op if LOG_FORWARDER_URL is not set.
 */
export async function sendPagerDutyEvent(payload: PagerDutyPayload): Promise<void> {
  const url = Deno.env.get('LOG_FORWARDER_URL') || ''
  if (!url) return

  const body = {
    routing_key: Deno.env.get('PAGERDUTY_ROUTING_KEY') || undefined,
    event_action: 'trigger',
    payload: {
      summary: payload.summary,
      severity: payload.severity || 'warning',
      source: payload.source || 'buildium-webhook',
      component: payload.component,
      group: payload.group,
      custom_details: payload.custom_details,
    },
    dedup_key: payload.dedup_key,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn('sendPagerDutyEvent failed', { status: res.status, statusText: res.statusText })
    }
  } catch (err) {
    console.warn('sendPagerDutyEvent error', err)
  }
}
