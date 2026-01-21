import { track } from '@/lib/analytics';

export type OnboardingTelemetryEvent =
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'onboarding_autosave'
  | 'onboarding_owner_upserted'
  | 'onboarding_unit_upserted'
  | 'onboarding_finalize'
  | 'agreement_send'
  | 'agreement_send_retry'
  | 'onboarding_resume_clicked'
  | 'onboarding_cancelled'
  | 'buildium_readiness_checked'
  | 'buildium_sync';

export type OnboardingTelemetryPayload = {
  event: OnboardingTelemetryEvent;
  onboardingId?: string | null;
  propertyId?: string | null;
  orgId?: string | null;
  userId?: string | null;
  status?: string | null;
  stepName?: string | null;
  source?: string | null;
  outcome?: string | null;
  errorCode?: string | null;
  durationMs?: number | null;
  templateId?: string | null;
  templateName?: string | null;
  recipientCount?: number | null;
  idempotencyHit?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Emit onboarding telemetry to client analytics + lightweight API persistence.
 * Mirrors the patterns in charge/lease telemetry to keep dashboards consistent.
 */
export async function emitOnboardingTelemetry(payload: OnboardingTelemetryPayload) {
  try {
    track(payload.event, payload);
    await fetch('/api/telemetry/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Non-blocking by design
  }
}
