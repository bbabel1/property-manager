import { track } from '@/lib/analytics';

export type LeaseTelemetryEvent =
  | 'lease_view'
  | 'lease_submit_success'
  | 'lease_submit_error'
  | 'lease_cancel';

export type LeaseTelemetryPayload = {
  event: LeaseTelemetryEvent;
  orgId?: string | null;
  leaseId?: string | number | null;
  source?: string | null;
  returnTo?: string | null;
  prefills?: Record<string, unknown> | null;
  durationMs?: number | null;
  errorMessage?: string | null;
};

export async function emitLeaseTelemetry(payload: LeaseTelemetryPayload) {
  try {
    track(payload.event, payload);
    await fetch('/api/telemetry/leases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
