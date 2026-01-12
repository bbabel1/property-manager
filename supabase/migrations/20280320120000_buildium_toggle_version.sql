-- Add versioning and disabled_at tracking to buildium_integrations
BEGIN;

ALTER TABLE public.buildium_integrations
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

ALTER TABLE public.buildium_integrations
  ADD COLUMN IF NOT EXISTS config_version bigint NOT NULL DEFAULT 1;

UPDATE public.buildium_integrations
  SET config_version = 1
  WHERE config_version IS NULL;

COMMIT;
