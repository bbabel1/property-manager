import { track } from '@/lib/analytics';

export type ChargeTelemetryEvent =
  | 'charge_view'
  | 'charge_submit_success'
  | 'charge_submit_error'
  | 'charge_cancel'
  | 'payment_view'
  | 'payment_submit_success'
  | 'payment_submit_error'
  | 'payment_cancel'
  | 'credit_view'
  | 'credit_submit_success'
  | 'credit_submit_error'
  | 'credit_cancel'
  | 'refund_view'
  | 'refund_submit_success'
  | 'refund_submit_error'
  | 'refund_cancel';

export type ChargeTelemetryPayload = {
  event: ChargeTelemetryEvent;
  leaseId: string;
  orgId?: string | null;
  source?: string | null;
  returnTo?: string | null;
  prefills?: Record<string, unknown> | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

// Sends to client analytics and a lightweight API for persistence.
export async function emitChargeTelemetry(payload: ChargeTelemetryPayload) {
  try {
    track(payload.event, payload);
    await fetch('/api/telemetry/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
