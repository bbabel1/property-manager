-- Charge schedules for recurring AR charges and linkage to charges

CREATE TABLE IF NOT EXISTS public.charge_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lease_id bigint NOT NULL REFERENCES public.lease(id) ON DELETE CASCADE,
  gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id) ON DELETE RESTRICT,
  charge_type public.charge_type_enum NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  frequency public.rent_cycle_enum NOT NULL,
  start_date date NOT NULL,
  end_date date,
  max_occurrences integer CHECK (max_occurrences IS NULL OR max_occurrences > 0),
  description text,
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_schedules_lease_active
  ON public.charge_schedules(lease_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_charge_schedules_org ON public.charge_schedules(org_id);

DROP TRIGGER IF EXISTS trg_charge_schedules_updated_at ON public.charge_schedules;
CREATE TRIGGER trg_charge_schedules_updated_at
  BEFORE UPDATE ON public.charge_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.charge_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS charge_schedules_org_read ON public.charge_schedules;
CREATE POLICY charge_schedules_org_read
ON public.charge_schedules
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS charge_schedules_org_insert ON public.charge_schedules;
CREATE POLICY charge_schedules_org_insert
ON public.charge_schedules
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS charge_schedules_org_update ON public.charge_schedules;
CREATE POLICY charge_schedules_org_update
ON public.charge_schedules
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS charge_schedules_org_delete ON public.charge_schedules;
CREATE POLICY charge_schedules_org_delete
ON public.charge_schedules
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));

-- Link charges to schedules
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS charge_schedule_id uuid REFERENCES public.charge_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charges_schedule_id ON public.charges(charge_schedule_id);

-- Prevent duplicate schedule instances on the same date
CREATE UNIQUE INDEX IF NOT EXISTS uq_charges_schedule_date
  ON public.charges(charge_schedule_id, due_date)
  WHERE charge_schedule_id IS NOT NULL;
