-- Deposit locking and forward-only status transitions driven by bank reconciliation

-- 1) When a bank-side state moves to reconciled for a deposit transaction, mark the deposit as reconciled
CREATE OR REPLACE FUNCTION public.update_deposit_status_on_bank_reconciled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_type text;
  v_transaction_id uuid;
BEGIN
  IF NEW.status <> 'reconciled' THEN
    RETURN NEW;
  END IF;

  v_transaction_id := NEW.transaction_id;

  SELECT t.transaction_type
  INTO v_tx_type
  FROM public.transactions t
  WHERE t.id = v_transaction_id;

  IF v_tx_type IS DISTINCT FROM 'Deposit' THEN
    RETURN NEW;
  END IF;

  -- Forward-only update to reconciled
  UPDATE public.deposit_meta
  SET status = 'reconciled',
      updated_at = now()
  WHERE transaction_id = v_transaction_id
    AND status <> 'reconciled';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_deposit_status_on_bank_reconciled ON public.bank_register_state;
CREATE TRIGGER trg_update_deposit_status_on_bank_reconciled
  AFTER UPDATE OF status ON public.bank_register_state
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'reconciled')
  EXECUTE FUNCTION public.update_deposit_status_on_bank_reconciled();

-- 2) Prevent deposit status regression (only forward transitions allowed)
CREATE OR REPLACE FUNCTION public.prevent_deposit_status_regression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- reconciled cannot regress
  IF OLD.status = 'reconciled' AND NEW.status <> 'reconciled' THEN
    RAISE EXCEPTION 'Cannot change deposit status from reconciled to %', NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  -- voided cannot regress
  IF OLD.status = 'voided' AND NEW.status <> 'voided' THEN
    RAISE EXCEPTION 'Cannot change deposit status from voided to %', NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  -- posted can move to reconciled or voided only
  IF OLD.status = 'posted' AND NEW.status NOT IN ('posted', 'reconciled', 'voided') THEN
    RAISE EXCEPTION 'Invalid deposit status transition from posted to %', NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_deposit_status_regression ON public.deposit_meta;
CREATE TRIGGER trg_prevent_deposit_status_regression
  BEFORE UPDATE ON public.deposit_meta
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.prevent_deposit_status_regression();

-- 3) Prevent edits to reconciled deposits (bank-side fields and totals)
CREATE OR REPLACE FUNCTION public.prevent_reconciled_deposit_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.deposit_status_enum;
BEGIN
  -- Only enforce for deposit transactions
  IF NEW.transaction_type IS DISTINCT FROM 'Deposit' THEN
    RETURN NEW;
  END IF;

  SELECT dm.status INTO v_status
  FROM public.deposit_meta dm
  WHERE dm.transaction_id = NEW.id;

  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_status = 'reconciled' THEN
    IF OLD.bank_gl_account_id IS DISTINCT FROM NEW.bank_gl_account_id THEN
      RAISE EXCEPTION 'Cannot change bank account of reconciled deposit'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      RAISE EXCEPTION 'Cannot change total amount of reconciled deposit'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reconciled_deposit_edits ON public.transactions;
CREATE TRIGGER trg_prevent_reconciled_deposit_edits
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (OLD.transaction_type = 'Deposit' AND NEW.transaction_type = 'Deposit')
  EXECUTE FUNCTION public.prevent_reconciled_deposit_edits();

-- 4) Prevent transaction_line edits for reconciled deposits (bank-side locking)
CREATE OR REPLACE FUNCTION public.prevent_reconciled_deposit_line_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.deposit_status_enum;
  v_transaction_id uuid;
BEGIN
  v_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  IF v_transaction_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT dm.status INTO v_status
  FROM public.deposit_meta dm
  WHERE dm.transaction_id = v_transaction_id;

  IF v_status IS NULL OR v_status <> 'reconciled' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete transaction lines from a reconciled deposit'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      RAISE EXCEPTION 'Cannot change line amount for a reconciled deposit'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.gl_account_id IS DISTINCT FROM NEW.gl_account_id THEN
      RAISE EXCEPTION 'Cannot change line account for a reconciled deposit'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reconciled_deposit_line_edits ON public.transaction_lines;
CREATE TRIGGER trg_prevent_reconciled_deposit_line_edits
  BEFORE UPDATE OR DELETE ON public.transaction_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reconciled_deposit_line_edits();
