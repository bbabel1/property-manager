-- Add DOB Certificate of Occupancy (Old) dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_certificate_of_occupancy_old TEXT NOT NULL DEFAULT 'bs8b-p36w';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_certificate_of_occupancy_old IS 'Dataset ID for DOB Certificate of Occupancy (Old).';
