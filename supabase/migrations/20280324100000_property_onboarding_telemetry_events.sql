-- Telemetry storage for property onboarding flow

BEGIN;

CREATE TABLE IF NOT EXISTS public.property_onboarding_telemetry_events (
  event text NOT NULL,
  org_id uuid NULL,
  user_id uuid NULL,
  onboarding_id uuid NULL,
  property_id uuid NULL,
  status text NULL,
  step_name text NULL,
  source text NULL,
  outcome text NULL,
  error_code text NULL,
  template_id uuid NULL,
  template_name text NULL,
  recipient_count integer NULL,
  idempotency_hit boolean NULL,
  duration_ms numeric NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_created_at_idx
  ON public.property_onboarding_telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_event_idx
  ON public.property_onboarding_telemetry_events (event);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_org_id_idx
  ON public.property_onboarding_telemetry_events (org_id);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_user_id_idx
  ON public.property_onboarding_telemetry_events (user_id);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_onboarding_id_idx
  ON public.property_onboarding_telemetry_events (onboarding_id);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_property_id_idx
  ON public.property_onboarding_telemetry_events (property_id);
CREATE INDEX IF NOT EXISTS property_onboarding_telemetry_events_step_name_idx
  ON public.property_onboarding_telemetry_events (step_name);

ALTER TABLE public.property_onboarding_telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_onboarding_telemetry_events_service_role_all ON public.property_onboarding_telemetry_events;
DROP POLICY IF EXISTS property_onboarding_telemetry_events_member_select ON public.property_onboarding_telemetry_events;
DROP POLICY IF EXISTS property_onboarding_telemetry_events_member_insert ON public.property_onboarding_telemetry_events;

CREATE POLICY property_onboarding_telemetry_events_service_role_all
  ON public.property_onboarding_telemetry_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY property_onboarding_telemetry_events_member_select
  ON public.property_onboarding_telemetry_events
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR public.is_org_member(auth.uid(), org_id)
      )
    )
  );

CREATE POLICY property_onboarding_telemetry_events_member_insert
  ON public.property_onboarding_telemetry_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR public.is_org_member(auth.uid(), org_id)
      )
    )
  );

COMMENT ON TABLE public.property_onboarding_telemetry_events IS 'Lightweight event store for property onboarding analytics';

COMMIT;
