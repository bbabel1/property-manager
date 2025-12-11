-- Add sidewalk violations dataset slot to NYC Open Data integration table

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_sidewalk_violations TEXT NOT NULL DEFAULT '6kbp-uz6m';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_sidewalk_violations IS 'Dataset ID for Sidewalk Management Database - Violations (NYC DOT, queried by BBL).';
