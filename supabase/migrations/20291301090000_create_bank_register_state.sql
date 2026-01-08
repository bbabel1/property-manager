-- Phase 1: Bank register state overlay table and guardrails
-- Creates enum, table, indexes, RLS policies, and triggers to seed/clean state

-- 1) Enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typname = 'bank_entry_status_enum'
  ) THEN
    CREATE TYPE bank_entry_status_enum AS ENUM ('uncleared', 'cleared', 'reconciled');
  END IF;
END
$$;

-- 2) State overlay table
CREATE TABLE IF NOT EXISTS public.bank_register_state (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  -- Optional Buildium mapping for transactions originating from Buildium
  buildium_transaction_id integer,
  -- Status tracking (Buildium-aligned)
  status bank_entry_status_enum NOT NULL DEFAULT 'uncleared',
  -- Reconciliation linkage (nullable; set while pending or reconciled)
  current_reconciliation_log_id uuid REFERENCES public.reconciliation_log(id) ON DELETE SET NULL,
  -- Audit fields
  cleared_at timestamptz,
  cleared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_at timestamptz,
  reconciled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Grain: one row per org / bank GL / transaction (supports transfers)
  PRIMARY KEY (org_id, bank_gl_account_id, transaction_id)
);

-- 3) Indexes (including filtered indexes for common lookups)
CREATE INDEX IF NOT EXISTS idx_bank_register_state_bank_gl_account_id
  ON public.bank_register_state(bank_gl_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_register_state_transaction_id
  ON public.bank_register_state(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_register_state_status
  ON public.bank_register_state(status);
CREATE INDEX IF NOT EXISTS idx_bank_register_state_reconciliation
  ON public.bank_register_state(current_reconciliation_log_id)
  WHERE current_reconciliation_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_register_state_buildium_txn
  ON public.bank_register_state(buildium_transaction_id)
  WHERE buildium_transaction_id IS NOT NULL;
-- Cleared/reconciled filtered lookups for balances
CREATE INDEX IF NOT EXISTS idx_bank_register_state_cleared
  ON public.bank_register_state(bank_gl_account_id, transaction_id)
  WHERE status IN ('cleared', 'reconciled');
CREATE INDEX IF NOT EXISTS idx_bank_register_state_reconciled
  ON public.bank_register_state(bank_gl_account_id, transaction_id)
  WHERE status = 'reconciled';

-- 4) RLS policies (aligned with existing patterns)
ALTER TABLE public.bank_register_state ENABLE ROW LEVEL SECURITY;

-- Org member read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_register_state'
      AND policyname = 'bank_register_state_org_read'
  ) THEN
    CREATE POLICY bank_register_state_org_read
      ON public.bank_register_state
      FOR SELECT
      USING (public.is_org_member((SELECT auth.uid()), org_id));
  END IF;
END
$$;

-- Org member write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_register_state'
      AND policyname = 'bank_register_state_org_write'
  ) THEN
    CREATE POLICY bank_register_state_org_write
      ON public.bank_register_state
      FOR ALL
      USING (public.is_org_member((SELECT auth.uid()), org_id))
      WITH CHECK (public.is_org_member((SELECT auth.uid()), org_id));
  END IF;
END
$$;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_register_state'
      AND policyname = 'bank_register_state_service_role_full_access'
  ) THEN
    CREATE POLICY bank_register_state_service_role_full_access
      ON public.bank_register_state
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

-- 5) Ensure updated_at maintenance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bank_register_state_updated_at'
      AND tgrelid = 'public.bank_register_state'::regclass
  ) THEN
    CREATE TRIGGER trg_bank_register_state_updated_at
      BEFORE UPDATE ON public.bank_register_state
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- 6) Guard: ensure bank_gl_account_id points to a bank account on insert/update
CREATE OR REPLACE FUNCTION public.validate_bank_register_state_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_bank boolean;
BEGIN
  SELECT ga.is_bank_account
  INTO v_is_bank
  FROM public.gl_accounts ga
  WHERE ga.id = COALESCE(NEW.bank_gl_account_id, OLD.bank_gl_account_id);

  IF v_is_bank IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'bank_register_state requires a bank GL account'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_bank_register_state_bank_account'
      AND tgrelid = 'public.bank_register_state'::regclass
  ) THEN
    CREATE TRIGGER trg_validate_bank_register_state_bank_account
      BEFORE INSERT OR UPDATE ON public.bank_register_state
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_bank_register_state_bank_account();
  END IF;
END
$$;

-- 7) Seeder trigger: ensure state rows exist for bank-side transaction lines
CREATE OR REPLACE FUNCTION public.ensure_bank_register_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_is_bank_account boolean;
  v_old_is_bank boolean;
  v_bank_gl_account_id uuid;
  v_old_bank_gl_account_id uuid;
BEGIN
  -- Resolve org and bank flag for this transaction line (new state)
  SELECT ga.is_bank_account, t.org_id, NEW.gl_account_id
  INTO v_is_bank_account, v_org_id, v_bank_gl_account_id
  FROM public.transactions t
  JOIN public.gl_accounts ga ON ga.id = NEW.gl_account_id
  WHERE t.id = NEW.transaction_id;

  -- Resolve prior bank flag when updating an existing line
  IF TG_OP = 'UPDATE' THEN
    SELECT ga.is_bank_account, OLD.gl_account_id
    INTO v_old_is_bank, v_old_bank_gl_account_id
    FROM public.gl_accounts ga
    WHERE ga.id = OLD.gl_account_id;
  END IF;

  -- Only insert state for bank accounts
  IF v_is_bank_account = true THEN
    INSERT INTO public.bank_register_state (
      org_id,
      bank_gl_account_id,
      transaction_id,
      status
    )
    VALUES (
      v_org_id,
      v_bank_gl_account_id,
      NEW.transaction_id,
      'uncleared'::bank_entry_status_enum
    )
    ON CONFLICT (org_id, bank_gl_account_id, transaction_id) DO NOTHING;
  END IF;

  -- If a bank line was moved to a non-bank account or a different bank account, clean up the old state row
  IF TG_OP = 'UPDATE' AND v_old_is_bank = true THEN
    IF v_is_bank_account IS DISTINCT FROM true OR v_old_bank_gl_account_id IS DISTINCT FROM v_bank_gl_account_id THEN
      DELETE FROM public.bank_register_state
      WHERE transaction_id = NEW.transaction_id
        AND bank_gl_account_id = v_old_bank_gl_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_ensure_bank_register_state'
      AND tgrelid = 'public.transaction_lines'::regclass
  ) THEN
    CREATE TRIGGER trg_ensure_bank_register_state
      AFTER INSERT OR UPDATE ON public.transaction_lines
      FOR EACH ROW
      EXECUTE FUNCTION public.ensure_bank_register_state();
  END IF;
END
$$;

-- 8) Cleanup on transaction_line delete: remove state row if no remaining bank lines for that account
CREATE OR REPLACE FUNCTION public.cleanup_bank_register_state_on_line_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_bank boolean;
  v_remaining integer;
BEGIN
  SELECT ga.is_bank_account INTO v_is_bank
  FROM public.gl_accounts ga
  WHERE ga.id = OLD.gl_account_id;

  IF v_is_bank IS DISTINCT FROM TRUE THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.transaction_lines tl
  JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id AND ga.is_bank_account = true
  WHERE tl.transaction_id = OLD.transaction_id
    AND tl.gl_account_id = OLD.gl_account_id
    AND tl.id <> OLD.id;

  IF COALESCE(v_remaining, 0) = 0 THEN
    DELETE FROM public.bank_register_state
    WHERE transaction_id = OLD.transaction_id
      AND bank_gl_account_id = OLD.gl_account_id;
  END IF;

  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_bank_register_state_on_line_delete'
      AND tgrelid = 'public.transaction_lines'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_bank_register_state_on_line_delete
      AFTER DELETE ON public.transaction_lines
      FOR EACH ROW
      EXECUTE FUNCTION public.cleanup_bank_register_state_on_line_delete();
  END IF;
END
$$;

-- 8) Cleanup trigger: remove state rows when a transaction is deleted
CREATE OR REPLACE FUNCTION public.cleanup_bank_register_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.bank_register_state
  WHERE transaction_id = OLD.id;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_bank_register_state'
      AND tgrelid = 'public.transactions'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_bank_register_state
      AFTER DELETE ON public.transactions
      FOR EACH ROW
      EXECUTE FUNCTION public.cleanup_bank_register_state();
  END IF;
END
$$;
