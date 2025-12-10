-- Add missing column for HPD complaints dataset to NYC Open Data integrations (idempotent)

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_hpd_complaints TEXT NOT NULL DEFAULT 'ygpa-z7cr';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_hpd_complaints IS 'Dataset ID for HPD complaints/problems.';
