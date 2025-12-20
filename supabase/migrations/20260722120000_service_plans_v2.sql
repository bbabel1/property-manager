-- Service Plans v2 core schema
-- Adds plan templates, assignments with honored pricing, service-level overrides, GL mapping, and applied period tracking.

BEGIN;

-- Ensure required extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enums for plan fee configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_amount_type') THEN
    CREATE TYPE public.plan_amount_type AS ENUM ('flat', 'percent');
    COMMENT ON TYPE public.plan_amount_type IS 'Plan fee amount type: flat or percent of rent.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_percent_basis') THEN
    CREATE TYPE public.plan_percent_basis AS ENUM ('lease_rent_amount', 'collected_rent');
    COMMENT ON TYPE public.plan_percent_basis IS 'Basis for percent plan fees: lease rent amount or collected rent.';
  END IF;
END $$;

-- Plan templates (no money stored on templates beyond display defaults)
CREATE TABLE IF NOT EXISTS public.service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  amount_type public.plan_amount_type NOT NULL,
  percent_basis public.plan_percent_basis,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_plans_percent_basis_required CHECK (
    amount_type != 'percent' OR percent_basis IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_service_plans_org ON public.service_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_active ON public.service_plans(org_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.service_plans IS 'Plan templates (org scoped) for management services.';

-- Plan template services (copy defaults to assignments on create)
CREATE TABLE IF NOT EXISTS public.service_plan_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  default_amount numeric(12,2),
  default_frequency public.billing_frequency_enum NOT NULL,
  default_included boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_plan_services_amount_non_negative CHECK (
    default_amount IS NULL OR default_amount >= 0
  ),
  UNIQUE(plan_id, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_services_plan ON public.service_plan_services(plan_id);
CREATE INDEX IF NOT EXISTS idx_service_plan_services_offering ON public.service_plan_services(offering_id);

COMMENT ON TABLE public.service_plan_services IS 'Default service entries attached to a plan template.';

-- Assignments: property or unit level with honored pricing
CREATE TABLE IF NOT EXISTS public.service_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  plan_fee_amount numeric(12,2),
  plan_fee_percent numeric(5,2),
  plan_fee_frequency public.billing_frequency_enum NOT NULL,
  effective_start timestamptz NOT NULL DEFAULT now(),
  effective_end timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_plan_assignments_scope CHECK (
    property_id IS NOT NULL OR unit_id IS NOT NULL
  ),
  CONSTRAINT service_plan_assignments_fee_required CHECK (
    (plan_fee_amount IS NOT NULL)::int + (plan_fee_percent IS NOT NULL)::int >= 1
  )
);

-- One active assignment per scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_plan_assignments_property_active
  ON public.service_plan_assignments(org_id, property_id)
  WHERE unit_id IS NULL AND effective_end IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_plan_assignments_unit_active
  ON public.service_plan_assignments(org_id, unit_id)
  WHERE unit_id IS NOT NULL AND effective_end IS NULL;

-- Prevent overlapping effective ranges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_plan_assignments_no_overlap_property'
  ) THEN
    ALTER TABLE public.service_plan_assignments
      ADD CONSTRAINT service_plan_assignments_no_overlap_property
      EXCLUDE USING gist (
        org_id WITH =,
        property_id WITH =,
        tstzrange(effective_start, coalesce(effective_end, 'infinity'::timestamptz), '[)') WITH &&
      ) WHERE (unit_id IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_plan_assignments_no_overlap_unit'
  ) THEN
    ALTER TABLE public.service_plan_assignments
      ADD CONSTRAINT service_plan_assignments_no_overlap_unit
      EXCLUDE USING gist (
        org_id WITH =,
        unit_id WITH =,
        tstzrange(effective_start, coalesce(effective_end, 'infinity'::timestamptz), '[)') WITH &&
      ) WHERE (unit_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_plan_assignments_plan ON public.service_plan_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_service_plan_assignments_org ON public.service_plan_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_service_plan_assignments_active ON public.service_plan_assignments(org_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.service_plan_assignments IS 'Plan assignments at property or unit level with honored pricing and effective dating.';

-- Enforce property-level vs unit-level assignment mode based on properties.service_assignment
CREATE OR REPLACE FUNCTION public.enforce_service_assignment_mode()
RETURNS trigger AS $$
DECLARE
  target_property uuid;
  property_mode public.assignment_level;
BEGIN
  target_property := NEW.property_id;

  IF target_property IS NULL AND NEW.unit_id IS NOT NULL THEN
    SELECT u.property_id INTO target_property FROM public.units u WHERE u.id = NEW.unit_id;
  END IF;

  IF target_property IS NULL THEN
    RAISE EXCEPTION 'service_plan_assignments requires a property context';
  END IF;

  SELECT p.service_assignment INTO property_mode FROM public.properties p WHERE p.id = target_property;

  IF property_mode IS NULL THEN
    RAISE EXCEPTION 'Property % has no service_assignment configured', target_property;
  END IF;

  IF property_mode = 'Property Level'::public.assignment_level AND NEW.unit_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unit-level assignments are not allowed when property service_assignment is Property Level';
  END IF;

  IF property_mode = 'Unit Level'::public.assignment_level AND NEW.unit_id IS NULL THEN
    RAISE EXCEPTION 'Property-level assignments are not allowed when property service_assignment is Unit Level';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_service_assignment_mode ON public.service_plan_assignments;
CREATE TRIGGER trg_enforce_service_assignment_mode
  BEFORE INSERT OR UPDATE ON public.service_plan_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_assignment_mode();

-- Assignment-level service overrides
CREATE TABLE IF NOT EXISTS public.service_assignment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.service_plan_assignments(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  amount numeric(12,2),
  frequency public.billing_frequency_enum NOT NULL,
  is_included boolean DEFAULT false,
  effective_start timestamptz NOT NULL DEFAULT now(),
  effective_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_assignment_services_amount_non_negative CHECK (
    amount IS NULL OR amount >= 0
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_assignment_services_no_overlap'
  ) THEN
    ALTER TABLE public.service_assignment_services
      ADD CONSTRAINT service_assignment_services_no_overlap
      EXCLUDE USING gist (
        assignment_id WITH =,
        offering_id WITH =,
        tstzrange(effective_start, coalesce(effective_end, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_assignment_services_assignment ON public.service_assignment_services(assignment_id);
CREATE INDEX IF NOT EXISTS idx_service_assignment_services_offering ON public.service_assignment_services(offering_id);

COMMENT ON TABLE public.service_assignment_services IS 'Assignment-level service overrides (amount/frequency/included) with effective dating.';

-- Org-level GL mapping for offerings (required for posting)
CREATE TABLE IF NOT EXISTS public.org_service_offering_gl_accounts (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, offering_id),
  CONSTRAINT org_service_offering_gl_accounts_unique_gl UNIQUE (org_id, gl_account_id)
);

CREATE INDEX IF NOT EXISTS idx_org_service_offering_gl_accounts_gl
  ON public.org_service_offering_gl_accounts(org_id, gl_account_id);

COMMENT ON TABLE public.org_service_offering_gl_accounts IS 'Org-scoped GL account mapping for service offerings.';

-- Extend GL settings to include management fee income
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings_gl_accounts') THEN
    ALTER TABLE public.settings_gl_accounts
      ADD COLUMN IF NOT EXISTS management_fee_income uuid REFERENCES public.gl_accounts(id);
    
    EXECUTE 'COMMENT ON COLUMN public.settings_gl_accounts.management_fee_income IS ''GL account for management fee income (plan fee credit).''';
  END IF;
END $$;

-- Applied period tracking for transaction lines (nullable for backfill)
ALTER TABLE public.transaction_lines
  ADD COLUMN IF NOT EXISTS applied_period_start date;

COMMENT ON COLUMN public.transaction_lines.applied_period_start IS 'Start of the period this line applies to (nullable; backfilled from monthly logs).';

-- RLS for new org-scoped tables
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_assignment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_service_offering_gl_accounts ENABLE ROW LEVEL SECURITY;

-- Service plans: scoped by org
DROP POLICY IF EXISTS service_plans_rw ON public.service_plans;
CREATE POLICY service_plans_rw ON public.service_plans
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Plan services: inherit org via plan
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

-- Assignments: scoped by org_id column
DROP POLICY IF EXISTS service_plan_assignments_rw ON public.service_plan_assignments;
CREATE POLICY service_plan_assignments_rw ON public.service_plan_assignments
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Assignment services: scoped via assignment org
DROP POLICY IF EXISTS service_assignment_services_rw ON public.service_assignment_services;
CREATE POLICY service_assignment_services_rw ON public.service_assignment_services
  USING (
    EXISTS (
      SELECT 1 FROM public.service_plan_assignments a
      WHERE a.id = service_assignment_services.assignment_id
        AND public.is_org_member(auth.uid(), a.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_plan_assignments a
      WHERE a.id = service_assignment_services.assignment_id
        AND public.is_org_member(auth.uid(), a.org_id)
    )
  );

-- GL mapping: scoped by org
DROP POLICY IF EXISTS org_service_offering_gl_accounts_rw ON public.org_service_offering_gl_accounts;
CREATE POLICY org_service_offering_gl_accounts_rw ON public.org_service_offering_gl_accounts
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

COMMIT;

-- Backfill assignments from legacy property/unit fields (idempotent)
DO $$
DECLARE
  prop RECORD;
  plan_id uuid;
BEGIN
  FOR prop IN
    SELECT p.id as property_id,
           p.org_id,
           p.service_assignment,
           p.service_plan,
           p.fee_dollar_amount,
           p.fee_percentage,
           p.billing_frequency
    FROM public.properties p
    WHERE p.service_plan IS NOT NULL
      AND p.service_assignment IS NOT NULL
  LOOP
    -- Create a synthetic plan per org if missing (one per org called "Management Fee")
    SELECT sp.id INTO plan_id FROM public.service_plans sp
    WHERE sp.org_id = prop.org_id
      AND sp.name = 'Management Fee';

    IF plan_id IS NULL THEN
      INSERT INTO public.service_plans (org_id, name, amount_type, percent_basis, is_active)
      VALUES (prop.org_id, 'Management Fee', 'flat', 'lease_rent_amount', true)
      RETURNING id INTO plan_id;
    END IF;

    -- Insert property-level assignment if none exists (only if fee values are present)
    INSERT INTO public.service_plan_assignments (
      org_id, property_id, unit_id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, is_active
    )
    SELECT prop.org_id, prop.property_id, NULL, plan_id,
           prop.fee_dollar_amount, prop.fee_percentage, COALESCE(prop.billing_frequency, 'Monthly'), true
    WHERE prop.service_assignment = 'Property Level'
      AND (prop.fee_dollar_amount IS NOT NULL OR prop.fee_percentage IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.service_plan_assignments a
        WHERE a.property_id = prop.property_id AND a.unit_id IS NULL AND a.is_active = true
      );

    -- For unit-level mode, create assignment per unit if none exists (only if fee values are present)
    IF prop.service_assignment = 'Unit Level' AND (prop.fee_dollar_amount IS NOT NULL OR prop.fee_percentage IS NOT NULL) THEN
      INSERT INTO public.service_plan_assignments (
        org_id, property_id, unit_id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, is_active
      )
      SELECT prop.org_id, u.property_id, u.id, plan_id,
             prop.fee_dollar_amount, prop.fee_percentage, COALESCE(prop.billing_frequency, 'Monthly'), true
      FROM public.units u
      WHERE u.property_id = prop.property_id
        AND NOT EXISTS (
          SELECT 1 FROM public.service_plan_assignments a
          WHERE a.unit_id = u.id AND a.is_active = true
        );
    END IF;
  END LOOP;
END;
$$;
