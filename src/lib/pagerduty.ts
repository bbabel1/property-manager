type Severity = 'info' | 'warning' | 'error' | 'critical'

interface PagerDutyEventInput {
  summary: string
  severity?: Severity
  source?: string
  component?: string
  group?: string
  dedupKey?: string
  customDetails?: Record<string, unknown>
}

/**
 * Minimal PagerDuty Events v2 notifier for Next.js runtime.
 * Uses LOG_FORWARDER_URL; no-ops if missing.
 */
export async function sendPagerDutyEvent(input: PagerDutyEventInput): Promise<void> {
  const url = process.env.LOG_FORWARDER_URL || ''
  if (!url) return

  const body = {
    routing_key: process.env.PAGERDUTY_ROUTING_KEY || undefined,
    event_action: 'trigger',
    dedup_key: input.dedupKey,
    payload: {
      summary: input.summary,
      severity: input.severity || 'warning',
      source: input.source || 'app-buildium-webhook',
      component: input.component,
      group: input.group,
      custom_details: input.customDetails,
    },
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
