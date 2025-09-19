BEGIN;

-- A) Ownership/disbursement totals must sum to 100% per property
CREATE OR REPLACE FUNCTION public.validate_ownership_totals(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
  v_own_total numeric(7,2);
  v_disb_total numeric(7,2);
BEGIN
  SELECT COUNT(*)::int,
         COALESCE(ROUND(SUM(ownership_percentage), 2), 0),
         COALESCE(ROUND(SUM(disbursement_percentage), 2), 0)
    INTO v_count, v_own_total, v_disb_total
    FROM public.ownerships
   WHERE property_id = p_property_id;

  -- Require exact totals only when ownership rows exist for the property
  IF v_count > 0 THEN
    IF v_own_total <> 100.00 THEN
      RAISE EXCEPTION 'Ownership percentages for property % must sum to 100.00 (current: %)', p_property_id, v_own_total
        USING ERRCODE = '23514';
    END IF;
    IF v_disb_total <> 100.00 THEN
      RAISE EXCEPTION 'Disbursement percentages for property % must sum to 100.00 (current: %)', p_property_id, v_disb_total
        USING ERRCODE = '23514';
    END IF;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_ownership_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.validate_ownership_totals(NEW.property_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Validate both old and new property when property_id changes
    IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
      PERFORM public.validate_ownership_totals(OLD.property_id);
    END IF;
    PERFORM public.validate_ownership_totals(NEW.property_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.validate_ownership_totals(OLD.property_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ownerships_validate_totals_ct') THEN
    EXECUTE 'DROP TRIGGER ownerships_validate_totals_ct ON public.ownerships';
  END IF;
END$$;

-- Deferrable constraint trigger to allow multi-row updates in one txn
CREATE CONSTRAINT TRIGGER ownerships_validate_totals_ct
AFTER INSERT OR UPDATE OR DELETE ON public.ownerships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_ownership_totals();

-- B) Add transactions.bank_account_id -> bank_accounts(id)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id
  ON public.transactions (bank_account_id);

-- C) work_orders.vendor_id + work_order_files table
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS vendor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_orders_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_id
  ON public.work_orders (vendor_id);

-- Optional files table for work orders (parallels task_history_files)
CREATE TABLE IF NOT EXISTS public.work_order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  buildium_file_id integer,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  file_url text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_order_files_buildium_file_id_uniq
  ON public.work_order_files (buildium_file_id)
  WHERE buildium_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_order_files_work_order_id
  ON public.work_order_files (work_order_id);

-- D) Unique on gl_accounts.account_number (prevent duplicate codes)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gl_accounts_account_number_not_null
  ON public.gl_accounts (account_number)
  WHERE account_number IS NOT NULL;

-- E) One active lease per unit (partial unique index)
-- Current schema uses uppercase 'ACTIVE'
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lease_per_unit
  ON public.lease (unit_id)
  WHERE status = 'ACTIVE';

COMMIT;

