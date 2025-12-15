-- Add dataset columns for DOB job application filings (DOB NOW + legacy BIS)

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_dob_now_job_filings TEXT NOT NULL DEFAULT 'w9ak-ipjd',
  ADD COLUMN IF NOT EXISTS dataset_dob_job_applications TEXT NOT NULL DEFAULT 'ic3t-wcy2';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_now_job_filings IS
  'Dataset ID for DOB NOW: Build – Job Application Filings.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_job_applications IS
  'Dataset ID for DOB Job Application Filings (BIS).';
