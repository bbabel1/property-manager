-- Add HPD Registrations dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_hpd_registrations TEXT NOT NULL DEFAULT 'tesw-yqqr';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_hpd_registrations IS 'Dataset ID for HPD Registrations.';
