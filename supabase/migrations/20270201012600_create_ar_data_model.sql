-- A/R data model: charges, receivables (optional aggregate), payment allocations, and AR view

DO $$
BEGIN
  CREATE TYPE public.charge_type_enum AS ENUM ('rent', 'late_fee', 'utility', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.charge_status_enum AS ENUM ('open', 'partial', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.receivable_type_enum AS ENUM ('rent', 'fee', 'utility', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.receivable_status_enum AS ENUM ('open', 'partial', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lease_id bigint NOT NULL REFERENCES public.lease(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  charge_type public.charge_type_enum NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  amount_open numeric(14,2) NOT NULL,
  due_date date NOT NULL,
  description text,
  is_prorated boolean DEFAULT false,
  proration_days integer,
  base_amount numeric(14,2),
  status public.charge_status_enum NOT NULL DEFAULT 'open',
  paid_amount numeric(14,2) GENERATED ALWAYS AS (amount - amount_open) STORED,
  buildium_charge_id integer,
  external_id text,
  source text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT charges_amount_open_nonnegative CHECK (amount_open >= 0),
  CONSTRAINT charges_amount_open_not_exceed CHECK (amount_open <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_org_external_id ON public.charges(org_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_charges_org_status_due_date ON public.charges(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_charges_org_lease_due_date ON public.charges(org_id, lease_id, due_date);
CREATE INDEX IF NOT EXISTS idx_charges_transaction_id ON public.charges(transaction_id);
CREATE INDEX IF NOT EXISTS idx_charges_buildium_charge_id ON public.charges(buildium_charge_id) WHERE buildium_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_charges_open_due_date ON public.charges(org_id, due_date) WHERE status IN ('open', 'partial') AND amount_open > 0;

CREATE OR REPLACE FUNCTION public.set_charges_amount_open_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount_open IS NULL THEN
    NEW.amount_open := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_charges_set_amount_open_default ON public.charges;
CREATE TRIGGER trg_charges_set_amount_open_default
  BEFORE INSERT ON public.charges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_charges_amount_open_default();

DROP TRIGGER IF EXISTS trg_charges_updated_at ON public.charges;
CREATE TRIGGER trg_charges_updated_at
  BEFORE UPDATE ON public.charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS charges_org_read ON public.charges;
CREATE POLICY charges_org_read
ON public.charges
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS charges_org_insert ON public.charges;
CREATE POLICY charges_org_insert
ON public.charges
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS charges_org_update ON public.charges;
CREATE POLICY charges_org_update
ON public.charges
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS charges_org_delete ON public.charges;
CREATE POLICY charges_org_delete
ON public.charges
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));

CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lease_id bigint NOT NULL REFERENCES public.lease(id) ON DELETE CASCADE,
  receivable_type public.receivable_type_enum NOT NULL,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  outstanding_amount numeric(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date date NOT NULL,
  description text,
  status public.receivable_status_enum NOT NULL DEFAULT 'open',
  external_id text,
  source text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receivables_paid_not_exceed CHECK (paid_amount <= total_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receivables_org_external_id ON public.receivables(org_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receivables_org_status_due_date ON public.receivables(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_org_lease_due_date ON public.receivables(org_id, lease_id, due_date);

DROP TRIGGER IF EXISTS trg_receivables_updated_at ON public.receivables;
CREATE TRIGGER trg_receivables_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receivables_org_read ON public.receivables;
CREATE POLICY receivables_org_read
ON public.receivables
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS receivables_org_insert ON public.receivables;
CREATE POLICY receivables_org_insert
ON public.receivables
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS receivables_org_update ON public.receivables;
CREATE POLICY receivables_org_update
ON public.receivables
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS receivables_org_delete ON public.receivables;
CREATE POLICY receivables_org_delete
ON public.receivables
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  charge_id uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  allocation_order integer NOT NULL CHECK (allocation_order >= 0),
  external_id text,
  source text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_payment_charge_unique UNIQUE (payment_transaction_id, charge_id),
  CONSTRAINT payment_allocations_allocation_order_unique UNIQUE (payment_transaction_id, allocation_order)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_allocations_org_external_id ON public.payment_allocations(org_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_charge ON public.payment_allocations(charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_org ON public.payment_allocations(org_id);

DROP TRIGGER IF EXISTS trg_payment_allocations_updated_at ON public.payment_allocations;
CREATE TRIGGER trg_payment_allocations_updated_at
  BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_allocations_org_read ON public.payment_allocations;
CREATE POLICY payment_allocations_org_read
ON public.payment_allocations
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS payment_allocations_org_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_org_insert
ON public.payment_allocations
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS payment_allocations_org_update ON public.payment_allocations;
CREATE POLICY payment_allocations_org_update
ON public.payment_allocations
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS payment_allocations_org_delete ON public.payment_allocations;
CREATE POLICY payment_allocations_org_delete
ON public.payment_allocations
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP VIEW IF EXISTS public.v_ar_receivables;
CREATE VIEW public.v_ar_receivables AS
SELECT
  c.org_id,
  c.lease_id,
  SUM(c.amount_open) AS amount_open_total,
  COUNT(*) FILTER (WHERE c.amount_open > 0) AS open_charge_count,
  MIN(c.due_date) FILTER (WHERE c.amount_open > 0) AS oldest_due_date
FROM public.charges c
WHERE c.status IN ('open', 'partial')
  AND c.amount_open > 0
GROUP BY c.org_id, c.lease_id;

COMMENT ON VIEW public.v_ar_receivables IS 'Aggregated AR position per lease derived from open charges.';
