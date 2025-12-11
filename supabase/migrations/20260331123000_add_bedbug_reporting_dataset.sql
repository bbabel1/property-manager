-- Add Bedbug Reporting dataset slot to NYC Open Data integrations

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_bedbug_reporting TEXT NOT NULL DEFAULT 'wz6d-d3jb';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_bedbug_reporting IS 'Dataset ID for HPD Bedbug Reporting (Local Law 69 of 2017 filings).';
