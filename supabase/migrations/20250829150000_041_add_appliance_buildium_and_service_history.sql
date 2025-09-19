-- Add Buildium integration fields for appliances and create service history table
-- This migration augments the existing appliances table with Buildium sync fields
-- and introduces a dedicated table for appliance service history.

-- 1) Add Buildium appliance id and new fields to appliances
ALTER TABLE public.appliances
  ADD COLUMN IF NOT EXISTS buildium_appliance_id integer,
  ADD COLUMN IF NOT EXISTS installation_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.appliances.buildium_appliance_id IS 'Buildium API appliance ID for synchronization';
COMMENT ON COLUMN public.appliances.installation_date IS 'Date the appliance was installed';
COMMENT ON COLUMN public.appliances.is_active IS 'Whether the appliance is currently active';

CREATE INDEX IF NOT EXISTS appliances_buildium_appliance_id_idx
  ON public.appliances (buildium_appliance_id);

-- 2) Create enum for service history types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'appliance_service_type_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.appliance_service_type_enum AS ENUM (
      'Maintenance', 'Repair', 'Replacement', 'Installation', 'Inspection', 'Other'
    );
  END IF;
END $$;

-- 3) Create appliance_service_history table
CREATE TABLE IF NOT EXISTS public.appliance_service_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appliance_id uuid NOT NULL REFERENCES public.appliances(id) ON DELETE CASCADE,
  buildium_service_history_id integer,
  service_date date NOT NULL,
  service_type public.appliance_service_type_enum NOT NULL,
  description text,
  cost numeric(12,2),
  vendor_name text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS appliance_service_history_appliance_id_idx
  ON public.appliance_service_history (appliance_id);

CREATE INDEX IF NOT EXISTS appliance_service_history_buildium_id_idx
  ON public.appliance_service_history (buildium_service_history_id);

COMMENT ON TABLE public.appliance_service_history IS 'Service and maintenance history records for appliances';
COMMENT ON COLUMN public.appliance_service_history.buildium_service_history_id IS 'Buildium API service history ID for synchronization';

-- 4) Enable RLS and add secure policies
ALTER TABLE public.appliance_service_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appliance_service_history' AND policyname = 'appliance_service_history_read'
  ) THEN
    CREATE POLICY appliance_service_history_read ON public.appliance_service_history
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appliance_service_history' AND policyname = 'appliance_service_history_insert'
  ) THEN
    CREATE POLICY appliance_service_history_insert ON public.appliance_service_history
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appliance_service_history' AND policyname = 'appliance_service_history_update'
  ) THEN
    CREATE POLICY appliance_service_history_update ON public.appliance_service_history
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appliance_service_history' AND policyname = 'appliance_service_history_delete'
  ) THEN
    CREATE POLICY appliance_service_history_delete ON public.appliance_service_history
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

