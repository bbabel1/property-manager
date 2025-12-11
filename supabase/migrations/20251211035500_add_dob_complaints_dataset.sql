-- Add DOB complaints dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_complaints TEXT NOT NULL DEFAULT 'eabe-havv';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_complaints IS 'Dataset ID for DOB complaints received (Open Data).';
