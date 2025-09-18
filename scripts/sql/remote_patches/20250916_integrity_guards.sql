-- Integrity constraints and guards

-- 1) Unique safety for lease_contacts (lease_id, tenant_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_lease_contacts_lease_tenant'
  ) THEN
    CREATE UNIQUE INDEX uq_lease_contacts_lease_tenant ON public.lease_contacts(lease_id, tenant_id);
  END IF;
END $$;

-- 2) Prevent overlapping rent_schedules per lease and ensure ranges are inside lease dates
-- Enable btree_gist for exclusion constraints if not installed
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Add exclusion constraint using daterange
DO $$ BEGIN
  ALTER TABLE public.rent_schedules
    ADD CONSTRAINT rent_schedules_no_overlap
    EXCLUDE USING gist (
      lease_id WITH =,
      daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger to enforce schedule within lease dates
CREATE OR REPLACE FUNCTION public.fn_rent_schedule_within_lease()
RETURNS trigger AS $$
DECLARE
  lease_rec record;
BEGIN
  SELECT lease_from_date, lease_to_date INTO lease_rec FROM public.lease WHERE id = NEW.lease_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease % not found for rent schedule', NEW.lease_id USING ERRCODE = '23503';
  END IF;
  IF NEW.start_date < lease_rec.lease_from_date THEN
    RAISE EXCEPTION 'Schedule start_date (%) is before lease start_date (%)', NEW.start_date, lease_rec.lease_from_date USING ERRCODE = '23514';
  END IF;
  IF lease_rec.lease_to_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date > lease_rec.lease_to_date THEN
    RAISE EXCEPTION 'Schedule end_date (%) is after lease end_date (%)', NEW.end_date, lease_rec.lease_to_date USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rent_schedule_within_lease_insupd ON public.rent_schedules;
CREATE CONSTRAINT TRIGGER trg_rent_schedule_within_lease_insupd
AFTER INSERT OR UPDATE ON public.rent_schedules
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.fn_rent_schedule_within_lease();

-- 3) Transaction lines sum equals transactions.total_amount
CREATE OR REPLACE FUNCTION public.fn_transaction_total_matches()
RETURNS trigger AS $$
DECLARE
  s numeric;
  t numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO s FROM public.transaction_lines WHERE transaction_id = NEW.id;
  SELECT total_amount INTO t FROM public.transactions WHERE id = NEW.id;
  IF COALESCE(t,0) <> COALESCE(s,0) THEN
    RAISE EXCEPTION 'Transaction % total_amount (%) does not equal sum of lines (%)', NEW.id, t, s USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_total_matches ON public.transactions;
CREATE CONSTRAINT TRIGGER trg_transaction_total_matches
AFTER INSERT OR UPDATE ON public.transactions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.fn_transaction_total_matches();

-- Also check on line changes
CREATE OR REPLACE FUNCTION public.fn_transaction_total_matches_on_lines()
RETURNS trigger AS $$
DECLARE
  hdr public.transactions%ROWTYPE;
BEGIN
  -- Find header id based on operation
  PERFORM 1;
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO hdr FROM public.transactions WHERE id = OLD.transaction_id;
    IF NOT FOUND THEN RETURN OLD; END IF;
    PERFORM public.fn_transaction_total_matches(hdr::public.transactions);
    RETURN OLD;
  ELSE
    SELECT * INTO hdr FROM public.transactions WHERE id = NEW.transaction_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    PERFORM public.fn_transaction_total_matches(hdr::public.transactions);
    RETURN NEW;
  END IF;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_total_lines_insupd ON public.transaction_lines;
CREATE CONSTRAINT TRIGGER trg_transaction_total_lines_insupd
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_lines
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.fn_transaction_total_matches_on_lines();

