-- Create assignment-level selected services for A-la-carte workflows.
-- Stores per-assignment offering selections plus optional override pricing.
-- NOTE: This table is renamed later to public.service_offering_assignments.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_assignment_selected_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.service_plan_assignments(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  override_amount boolean DEFAULT false,
  override_frequency boolean DEFAULT false,
  amount numeric(12,2),
  frequency public.billing_frequency_enum,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_assignment_selected_services_amount_non_negative CHECK (
    amount IS NULL OR amount >= 0
  ),
  UNIQUE(assignment_id, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_service_assignment_selected_services_assignment
  ON public.service_assignment_selected_services(assignment_id);
CREATE INDEX IF NOT EXISTS idx_service_assignment_selected_services_offering
  ON public.service_assignment_selected_services(offering_id);

ALTER TABLE public.service_assignment_selected_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_assignment_selected_services_rw ON public.service_assignment_selected_services;
CREATE POLICY service_assignment_selected_services_rw ON public.service_assignment_selected_services
  USING (
    EXISTS (
      SELECT 1 FROM public.service_plan_assignments a
      WHERE a.id = service_assignment_selected_services.assignment_id
        AND public.is_org_member(auth.uid(), a.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_plan_assignments a
      WHERE a.id = service_assignment_selected_services.assignment_id
        AND public.is_org_member(auth.uid(), a.org_id)
    )
  );

GRANT ALL ON TABLE public.service_assignment_selected_services TO anon, authenticated, service_role;

COMMIT;

-- Refresh PostgREST schema cache so the table becomes available immediately.
NOTIFY pgrst, 'reload schema';
