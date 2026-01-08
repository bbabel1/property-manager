-- Phase 3: Guardrails for reconciled transactions and bank register state transitions

-- Ensure banking_audit_log exists before triggers reference it (guard against migration ordering)
CREATE TABLE IF NOT EXISTS public.banking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN (
    'transaction_cleared',
    'transaction_uncleared',
    'transaction_reconciled',
    'reconciliation_created',
    'reconciliation_locked',
    'reconciliation_unlocked',
    'reconciliation_finalized',
    'edit_blocked_reconciled',
    'status_change_blocked',
    'system_sync'
  )),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  bank_gl_account_id uuid REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  reconciliation_id uuid REFERENCES public.reconciliation_log(id) ON DELETE SET NULL,
  field_changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1) Helper: check if a transaction has reconciled bank lines (optionally scoped to a bank GL account)
CREATE OR REPLACE FUNCTION public.has_reconciled_bank_lines(
  p_transaction_id uuid,
  p_bank_gl_account_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bank_register_state brs
    JOIN public.reconciliation_log rl
      ON rl.id = brs.current_reconciliation_log_id
    WHERE brs.transaction_id = p_transaction_id
      AND rl.locked_at IS NOT NULL
      AND brs.status = 'reconciled'
      AND (p_bank_gl_account_id IS NULL OR brs.bank_gl_account_id = p_bank_gl_account_id)
  );
$$;

-- 2) Guard: prevent bank-side edits on reconciled transactions
CREATE OR REPLACE FUNCTION public.prevent_reconciled_bank_line_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_bank_account boolean;
  v_is_reconciled boolean;
  v_gl_account_id uuid;
  v_transaction_id uuid;
  v_org_id uuid;
BEGIN
  v_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
  v_gl_account_id := COALESCE(NEW.gl_account_id, OLD.gl_account_id);

  IF v_gl_account_id IS NULL OR v_transaction_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT ga.is_bank_account INTO v_is_bank_account
  FROM public.gl_accounts ga
  WHERE ga.id = v_gl_account_id;

  SELECT t.org_id INTO v_org_id
  FROM public.transactions t
  WHERE t.id = v_transaction_id;

  IF v_is_bank_account IS DISTINCT FROM TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT public.has_reconciled_bank_lines(v_transaction_id, v_gl_account_id)
  INTO v_is_reconciled;

  IF NOT v_is_reconciled THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Block INSERT of new bank lines into reconciled transaction
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.banking_audit_log (org_id, actor_user_id, action, transaction_id, bank_gl_account_id, field_changes)
    VALUES (v_org_id, (SELECT auth.uid()), 'edit_blocked_reconciled', v_transaction_id, v_gl_account_id, jsonb_build_object('operation', 'insert_line'));
    RAISE EXCEPTION 'Cannot add new bank-side transaction lines to a transaction that is part of a locked reconciliation.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Block changes to bank-side amount/posting type/GL account
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.gl_account_id IS NOT NULL AND NEW.gl_account_id IS NOT NULL AND OLD.gl_account_id <> NEW.gl_account_id)
       OR (OLD.amount IS NOT NULL AND NEW.amount IS NOT NULL AND OLD.amount <> NEW.amount)
       OR (OLD.posting_type IS NOT NULL AND NEW.posting_type IS NOT NULL AND OLD.posting_type <> NEW.posting_type) THEN
      INSERT INTO public.banking_audit_log (org_id, actor_user_id, action, transaction_id, bank_gl_account_id, field_changes)
      VALUES (v_org_id, (SELECT auth.uid()), 'edit_blocked_reconciled', v_transaction_id, v_gl_account_id, jsonb_build_object('operation', 'update_line'));
      RAISE EXCEPTION 'Cannot modify bank-side GL account, amount, or posting type for a transaction that is part of a locked reconciliation. Only metadata (memo, date) can be edited.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Block DELETE of reconciled bank lines
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.banking_audit_log (org_id, actor_user_id, action, transaction_id, bank_gl_account_id, field_changes)
    VALUES (v_org_id, (SELECT auth.uid()), 'edit_blocked_reconciled', v_transaction_id, v_gl_account_id, jsonb_build_object('operation', 'delete_line'));
    RAISE EXCEPTION 'Cannot delete bank-side transaction line that is part of a locked reconciliation.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reconciled_bank_line_edit ON public.transaction_lines;
CREATE TRIGGER trg_prevent_reconciled_bank_line_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reconciled_bank_line_edit();

-- 3) Guard: prevent deleting a transaction with reconciled bank lines
CREATE OR REPLACE FUNCTION public.prevent_reconciled_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_reconciled boolean;
  v_org_id uuid;
BEGIN
  SELECT public.has_reconciled_bank_lines(OLD.id) INTO v_has_reconciled;

  SELECT t.org_id INTO v_org_id
  FROM public.transactions t
  WHERE t.id = OLD.id;

  IF v_has_reconciled THEN
    INSERT INTO public.banking_audit_log (org_id, actor_user_id, action, transaction_id, bank_gl_account_id, field_changes)
    VALUES (v_org_id, (SELECT auth.uid()), 'edit_blocked_reconciled', OLD.id, NULL, jsonb_build_object('operation', 'delete_transaction'));
    RAISE EXCEPTION 'Cannot delete transaction that has bank-side lines part of a locked reconciliation.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reconciled_transaction_delete ON public.transactions;
CREATE TRIGGER trg_prevent_reconciled_transaction_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reconciled_transaction_delete();

-- 4) Guard: enforce forward-only state transitions on bank_register_state
CREATE OR REPLACE FUNCTION public.enforce_bank_register_state_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Block backward moves from reconciled
  IF OLD.status = 'reconciled' AND NEW.status IN ('cleared', 'uncleared') THEN
    RAISE EXCEPTION 'Cannot change status backward from reconciled. Transaction is locked in reconciliation.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Block clearing reversal inside an active reconciliation
  IF OLD.status = 'cleared'
     AND NEW.status = 'uncleared'
     AND OLD.current_reconciliation_log_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot unclear a transaction that is part of an active reconciliation.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_state_transitions ON public.bank_register_state;
CREATE TRIGGER trg_enforce_state_transitions
  BEFORE UPDATE ON public.bank_register_state
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enforce_bank_register_state_transitions();
