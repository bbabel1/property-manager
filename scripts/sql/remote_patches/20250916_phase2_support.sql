-- Phase 2 support: idempotency for postings, GL settings, webhook events

-- 1) transactions.idempotency_key for dedup
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_transactions_idem'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_transactions_idem ON public.transactions(idempotency_key) WHERE idempotency_key IS NOT NULL';
  END IF;
END $$;

-- 2) per‑org GL account settings
DO $$ BEGIN
  CREATE TABLE public.settings_gl_accounts (
    org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    ar_lease uuid NOT NULL,
    rent_income uuid NOT NULL,
    cash_operating uuid NOT NULL,
    cash_trust uuid,
    tenant_deposit_liability uuid NOT NULL,
    late_fee_income uuid,
    write_off uuid,
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 3) Buildium webhook events table (idempotent ingest)
DO $$ BEGIN
  CREATE TABLE public.buildium_webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text UNIQUE,
    event_type text,
    signature text,
    payload jsonb,
    status text DEFAULT 'received',
    error text,
    received_at timestamptz DEFAULT now(),
    processed_at timestamptz
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
