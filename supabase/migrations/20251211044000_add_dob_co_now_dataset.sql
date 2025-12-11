-- Add DOB NOW Certificate of Occupancy dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_certificate_of_occupancy_now TEXT NOT NULL DEFAULT 'pkdm-hqz6';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_certificate_of_occupancy_now IS 'Dataset ID for DOB NOW: Certificate of Occupancy.';
