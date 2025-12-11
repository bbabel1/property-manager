-- Add metadata payload to compliance violations so we can retain full Open Data rows

ALTER TABLE public.compliance_violations
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.compliance_violations.metadata IS 'Raw/source metadata for the violation (e.g., NYC Open Data row)';

-- Repurpose the elevator violations dataset slot to track DOB Safety Violations
ALTER TABLE public.nyc_open_data_integrations
  ALTER COLUMN dataset_elevator_violations SET DEFAULT '855j-jady';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_elevator_violations IS 'Dataset ID for DOB Safety Violations (Open Data).';
