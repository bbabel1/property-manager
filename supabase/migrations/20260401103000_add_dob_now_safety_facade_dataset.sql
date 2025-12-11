-- Add DOB NOW: Safety – Facades Compliance Filings dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_now_safety_facade TEXT NOT NULL DEFAULT 'xubg-57si';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_now_safety_facade IS 'Dataset ID for DOB NOW: Safety – Facades Compliance Filings.';
