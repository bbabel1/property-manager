-- Convert tenants.sms_opt_in_status from VARCHAR to BOOLEAN and add tenant_notes table

BEGIN;

-- 1) Convert sms_opt_in_status to boolean (nullable)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS sms_opt_in_status_bool boolean;

UPDATE public.tenants
SET sms_opt_in_status_bool = CASE
  WHEN sms_opt_in_status IS NULL THEN NULL
  WHEN lower(sms_opt_in_status) IN ('true','t','yes','y','1') THEN TRUE
  WHEN lower(sms_opt_in_status) IN ('false','f','no','n','0') THEN FALSE
  ELSE NULL
END;

ALTER TABLE public.tenants DROP COLUMN IF EXISTS sms_opt_in_status;
ALTER TABLE public.tenants RENAME COLUMN sms_opt_in_status_bool TO sms_opt_in_status;

COMMENT ON COLUMN public.tenants.sms_opt_in_status IS 'SMS opt-in status mapped from Buildium (boolean)';

-- 2) Create tenant_notes table for offline access and search
CREATE TABLE IF NOT EXISTS public.tenant_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  buildium_tenant_id integer,
  buildium_note_id integer,
  subject text,
  note text,
  buildium_created_at timestamptz,
  buildium_updated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.tenant_notes IS 'Local cache of Buildium tenant notes for offline access and search';
COMMENT ON COLUMN public.tenant_notes.buildium_tenant_id IS 'Buildium Tenant Id';
COMMENT ON COLUMN public.tenant_notes.buildium_note_id IS 'Buildium Note Id';

CREATE INDEX IF NOT EXISTS idx_tenant_notes_tenant_id ON public.tenant_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notes_buildium_ids ON public.tenant_notes(buildium_tenant_id, buildium_note_id);

-- Enable RLS and add permissive policies like other tables
ALTER TABLE public.tenant_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_notes' AND policyname = 'tenant_notes_read_policy'
  ) THEN
    CREATE POLICY tenant_notes_read_policy ON public.tenant_notes FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_notes' AND policyname = 'tenant_notes_insert_policy'
  ) THEN
    CREATE POLICY tenant_notes_insert_policy ON public.tenant_notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_notes' AND policyname = 'tenant_notes_update_policy'
  ) THEN
    CREATE POLICY tenant_notes_update_policy ON public.tenant_notes FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_notes' AND policyname = 'tenant_notes_delete_policy'
  ) THEN
    CREATE POLICY tenant_notes_delete_policy ON public.tenant_notes FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Keep grants consistent with other tables
GRANT ALL ON TABLE public.tenant_notes TO anon;
GRANT ALL ON TABLE public.tenant_notes TO authenticated;
GRANT ALL ON TABLE public.tenant_notes TO service_role;

COMMIT;

