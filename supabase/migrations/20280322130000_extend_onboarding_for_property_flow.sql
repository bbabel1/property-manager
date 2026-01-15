-- Migration: Extend onboarding for property flow
-- Purpose: Add new onboarding status enum values, recreate property_onboarding table with JSONB current_stage,
--          and create agreement_send_log table for audit logging.

BEGIN;

-- 1) Extend onboarding_status_enum with new values
-- Note: PostgreSQL doesn't support IF NOT EXISTS for enum values, so we use DO blocks

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DRAFT'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'DRAFT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'OWNERS_ADDED'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'OWNERS_ADDED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'UNITS_ADDED'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'UNITS_ADDED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'READY_TO_SEND'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'READY_TO_SEND';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'AGREEMENT_SENT'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'AGREEMENT_SENT';
  END IF;
END $$;

-- P1 statuses (Buildium sync)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'READY_FOR_BUILDIUM'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'READY_FOR_BUILDIUM';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BUILDIUM_SYNCED'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'BUILDIUM_SYNCED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BUILDIUM_SYNC_FAILED'
    AND enumtypid = 'public.onboarding_status_enum'::regtype
  ) THEN
    ALTER TYPE public.onboarding_status_enum ADD VALUE 'BUILDIUM_SYNC_FAILED';
  END IF;
END $$;

COMMIT;

-- 2) Alter property_onboarding table to use JSONB for current_stage
-- The table already exists from migration 20250912120000_067_dashboard_kpis.sql
-- We need to convert current_stage from TEXT to JSONB

BEGIN;

-- Add normalized_address_key column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'property_onboarding'
    AND column_name = 'normalized_address_key'
  ) THEN
    ALTER TABLE public.property_onboarding
      ADD COLUMN normalized_address_key text;
  END IF;
END $$;

-- Convert current_stage from TEXT to JSONB if it's currently TEXT
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'property_onboarding'
    AND column_name = 'current_stage';

  IF col_type = 'text' THEN
    -- First, update any NULL or empty values to valid JSON
    UPDATE public.property_onboarding
    SET current_stage = '{}'
    WHERE current_stage IS NULL OR current_stage = '';

    -- Convert valid JSON strings, wrap non-JSON in legacy_text object
    UPDATE public.property_onboarding
    SET current_stage = CASE
      WHEN current_stage::text ~ '^[\s]*[\[\{]' THEN current_stage::text
      ELSE jsonb_build_object('legacy_text', current_stage::text)::text
    END
    WHERE current_stage IS NOT NULL AND current_stage != '{}';

    -- Alter column type to JSONB
    ALTER TABLE public.property_onboarding
      ALTER COLUMN current_stage TYPE jsonb USING current_stage::jsonb;

    -- Set default value
    ALTER TABLE public.property_onboarding
      ALTER COLUMN current_stage SET DEFAULT '{}'::jsonb;

    -- Set NOT NULL constraint
    ALTER TABLE public.property_onboarding
      ALTER COLUMN current_stage SET NOT NULL;
  END IF;
END $$;

-- Add index on normalized_address_key for deduplication queries
CREATE INDEX IF NOT EXISTS idx_property_onboarding_normalized_address_key
  ON public.property_onboarding(normalized_address_key)
  WHERE normalized_address_key IS NOT NULL;

-- Add composite index for org + status queries
CREATE INDEX IF NOT EXISTS idx_property_onboarding_org_status
  ON public.property_onboarding(org_id, status);

-- Add index for created_at DESC (for listing drafts)
CREATE INDEX IF NOT EXISTS idx_property_onboarding_created_at_desc
  ON public.property_onboarding(created_at DESC);

COMMIT;

-- 3) Create agreement_send_log table for audit logging

BEGIN;

CREATE TABLE IF NOT EXISTS public.agreement_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  onboarding_id uuid REFERENCES public.property_onboarding(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  template_name text,
  recipients jsonb NOT NULL, -- Array of {email, name, role?} objects
  recipient_hash text NOT NULL, -- Deterministic hash for idempotency queries
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  webhook_payload jsonb,
  webhook_response jsonb,
  error_message text,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.agreement_send_log ENABLE ROW LEVEL SECURITY;

-- Read policy: org members can read
DROP POLICY IF EXISTS "agreement_send_log_org_read" ON public.agreement_send_log;
CREATE POLICY "agreement_send_log_org_read" ON public.agreement_send_log
  FOR SELECT USING (is_org_member(auth.uid(), org_id));

-- Insert policy: org admins/managers can insert
DROP POLICY IF EXISTS "agreement_send_log_org_insert" ON public.agreement_send_log;
CREATE POLICY "agreement_send_log_org_insert" ON public.agreement_send_log
  FOR INSERT WITH CHECK (is_org_admin_or_manager(auth.uid(), org_id));

-- Update policy: org admins/managers can update (for retry status updates)
DROP POLICY IF EXISTS "agreement_send_log_org_update" ON public.agreement_send_log;
CREATE POLICY "agreement_send_log_org_update" ON public.agreement_send_log
  FOR UPDATE USING (is_org_admin_or_manager(auth.uid(), org_id))
  WITH CHECK (is_org_admin_or_manager(auth.uid(), org_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_property ON public.agreement_send_log(property_id);
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_sent_at ON public.agreement_send_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_status ON public.agreement_send_log(status);
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_recipient_hash ON public.agreement_send_log(recipient_hash);
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_org ON public.agreement_send_log(org_id);

-- Partial index for 24h idempotency window queries (non-unique, idempotency handled by idempotency_keys table)
CREATE INDEX IF NOT EXISTS idx_agreement_send_log_idempotency_window
  ON public.agreement_send_log(property_id, template_id, recipient_hash, DATE(sent_at))
  WHERE sent_at > now() - interval '24 hours';

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_agreement_send_log_updated_at ON public.agreement_send_log;
CREATE TRIGGER trg_agreement_send_log_updated_at
  BEFORE UPDATE ON public.agreement_send_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- Add comments for documentation
COMMENT ON TABLE public.agreement_send_log IS 'Audit log for agreement sends during property onboarding';
COMMENT ON COLUMN public.agreement_send_log.recipient_hash IS 'SHA256 hash of property_id + template_id + sorted recipients for idempotency queries';
COMMENT ON COLUMN public.agreement_send_log.recipients IS 'Array of {email, name, role?} objects representing agreement recipients';
