-- Add OneTime to rent_cycle_enum for one-off templates
DO $$ BEGIN
  ALTER TYPE public.rent_cycle_enum ADD VALUE IF NOT EXISTS 'OneTime';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

