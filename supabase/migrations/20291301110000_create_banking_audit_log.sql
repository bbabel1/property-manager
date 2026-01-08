-- Phase 4: Banking audit log table and triggers

-- 1) Table definition (append-only)
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

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_org_id ON public.banking_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_transaction_id ON public.banking_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_reconciliation_id ON public.banking_audit_log(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_created_at ON public.banking_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_action ON public.banking_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_banking_audit_log_actor_user_id
  ON public.banking_audit_log(actor_user_id)
  WHERE actor_user_id IS NOT NULL;

-- 3) RLS policies
ALTER TABLE public.banking_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'banking_audit_log'
      AND policyname = 'banking_audit_log_org_read'
  ) THEN
    CREATE POLICY banking_audit_log_org_read
      ON public.banking_audit_log
      FOR SELECT
      USING (public.is_org_member((SELECT auth.uid()), org_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'banking_audit_log'
      AND policyname = 'banking_audit_log_service_role_full_access'
  ) THEN
    CREATE POLICY banking_audit_log_service_role_full_access
      ON public.banking_audit_log
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

-- 4) Trigger: audit state changes on bank_register_state
CREATE OR REPLACE FUNCTION public.audit_bank_register_state_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_reconciliation_log_id IS DISTINCT FROM NEW.current_reconciliation_log_id) THEN
    v_action := CASE
      WHEN NEW.status = 'cleared' THEN 'transaction_cleared'
      WHEN NEW.status = 'uncleared' THEN 'transaction_uncleared'
      WHEN NEW.status = 'reconciled' THEN 'transaction_reconciled'
      ELSE 'system_sync'
    END;

    INSERT INTO public.banking_audit_log (
      org_id,
      actor_user_id,
      action,
      transaction_id,
      bank_gl_account_id,
      reconciliation_id,
      field_changes
    )
    VALUES (
      NEW.org_id,
      (SELECT auth.uid()),
      v_action,
      NEW.transaction_id,
      NEW.bank_gl_account_id,
      NEW.current_reconciliation_log_id,
      jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
        'reconciliation_id', jsonb_build_object('old', OLD.current_reconciliation_log_id, 'new', NEW.current_reconciliation_log_id)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_bank_register_state_changes ON public.bank_register_state;
CREATE TRIGGER trg_audit_bank_register_state_changes
  AFTER UPDATE ON public.bank_register_state
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_reconciliation_log_id IS DISTINCT FROM NEW.current_reconciliation_log_id)
  EXECUTE FUNCTION public.audit_bank_register_state_changes();
