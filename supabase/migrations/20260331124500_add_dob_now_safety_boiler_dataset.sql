-- Add DOB NOW: Safety Boiler dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_now_safety_boiler TEXT NOT NULL DEFAULT '52dp-yji6';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_now_safety_boiler IS 'Dataset ID for DOB NOW: Safety Boiler compliance filings.';
