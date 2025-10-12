-- Migration: Keep transactions.total_amount in sync with transaction_lines
-- Ensures headers always reflect the sum of their detailed lines

BEGIN;

-- Ensure new rows default to zero until lines populate
ALTER TABLE public.transactions
  ALTER COLUMN total_amount SET DEFAULT 0;

-- Calculate the signed total for a single transaction
CREATE OR REPLACE FUNCTION public.fn_calculate_transaction_total(p_transaction_id uuid)
RETURNS numeric
LANGUAGE sql
AS $function$
  SELECT COALESCE(SUM(
    CASE
      WHEN upper(COALESCE(posting_type, '')) IN ('CREDIT', 'CR') THEN -ABS(COALESCE(amount, 0))
      WHEN upper(COALESCE(posting_type, '')) IN ('DEBIT', 'DR') THEN ABS(COALESCE(amount, 0))
      ELSE COALESCE(amount, 0)
    END
  ), 0)
  FROM public.transaction_lines
  WHERE transaction_id = p_transaction_id;
$function$;

-- Trigger helper: update the header total whenever lines change
CREATE OR REPLACE FUNCTION public.fn_sync_transaction_total()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_new uuid;
  target_old uuid;
  computed_total numeric;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    target_new := NEW.transaction_id;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    target_old := OLD.transaction_id;
  END IF;

  IF target_old IS NOT NULL AND (TG_OP = 'DELETE' OR target_old IS DISTINCT FROM target_new) THEN
    SELECT public.fn_calculate_transaction_total(target_old) INTO computed_total;
    UPDATE public.transactions
       SET total_amount = computed_total
     WHERE id = target_old;
  END IF;

  IF target_new IS NOT NULL THEN
    SELECT public.fn_calculate_transaction_total(target_new) INTO computed_total;
    UPDATE public.transactions
       SET total_amount = computed_total
     WHERE id = target_new;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_transaction_lines_refresh_total ON public.transaction_lines;

CREATE TRIGGER trg_transaction_lines_refresh_total
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_lines
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_transaction_total();

-- Enforce header totals stay derived from line items
CREATE OR REPLACE FUNCTION public.fn_transactions_enforce_total()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  computed_total numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT public.fn_calculate_transaction_total(NEW.id) INTO computed_total;
    NEW.total_amount := computed_total;
  ELSIF TG_OP = 'INSERT' AND NEW.total_amount IS NULL THEN
    NEW.total_amount := 0;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_transactions_enforce_total ON public.transactions;

CREATE TRIGGER trg_transactions_enforce_total
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.fn_transactions_enforce_total();

-- Backfill existing totals from their related lines
WITH totals AS (
  SELECT DISTINCT transaction_id
  FROM public.transaction_lines
  WHERE transaction_id IS NOT NULL
)
UPDATE public.transactions AS t
SET total_amount = public.fn_calculate_transaction_total(t.id)
FROM totals
WHERE totals.transaction_id = t.id;

-- Normalize any rows that still have NULL totals
UPDATE public.transactions
SET total_amount = 0
WHERE total_amount IS NULL;

COMMIT;
