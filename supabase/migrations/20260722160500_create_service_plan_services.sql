-- Create service_plan_services if missing (plan template defaults + assigned offerings).
-- Required by /api/services/plans assignments and plan defaults UI.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_plan_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  default_amount numeric(12,2),
  default_frequency public.billing_frequency_enum NOT NULL,
  default_included boolean DEFAULT true,
  billing_basis public.billing_basis_enum,
  rent_basis public.rent_basis_enum,
  markup_pct numeric(6,3),
  markup_pct_cap numeric(6,3),
  hourly_rate numeric(12,2),
  hourly_min_hours numeric(6,2),
  is_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_plan_services_amount_non_negative CHECK (
    default_amount IS NULL OR default_amount >= 0
  ),
  UNIQUE(plan_id, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_services_plan ON public.service_plan_services(plan_id);
CREATE INDEX IF NOT EXISTS idx_service_plan_services_offering ON public.service_plan_services(offering_id);

ALTER TABLE public.service_plan_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_plan_services_rw ON public.service_plan_services;
CREATE POLICY service_plan_services_rw ON public.service_plan_services
  USING (
    EXISTS (
      SELECT 1 FROM public.service_plans sp
      WHERE sp.id = service_plan_services.plan_id
        AND public.is_org_member(auth.uid(), sp.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_plans sp
      WHERE sp.id = service_plan_services.plan_id
        AND public.is_org_member(auth.uid(), sp.org_id)
    )
  );

GRANT ALL ON TABLE public.service_plan_services TO anon, authenticated, service_role;

COMMIT;

-- Refresh PostgREST schema cache so the table becomes available immediately.
NOTIFY pgrst, 'reload schema';

