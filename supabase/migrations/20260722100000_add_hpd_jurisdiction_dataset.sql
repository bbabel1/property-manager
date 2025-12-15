-- Add HPD full response field for Buildings Subject to HPD Jurisdiction dataset

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS hpd jsonb;

COMMENT ON COLUMN public.buildings.hpd IS 'Full HPD Buildings (kj4p-ruqc) response for BIN-level lookups.';

-- Seed/update global data_sources catalog entry for HPD buildings dataset
INSERT INTO public.data_sources (key, dataset_id, title, description, is_enabled, deleted_at)
VALUES (
  'buildingsSubjectToHPD',
  'kj4p-ruqc',
  'Buildings Subject to HPD Jurisdiction',
  'HPD buildings dataset keyed by BIN/BuildingID for properties under HPD jurisdiction.',
  true,
  NULL
)
ON CONFLICT (key) DO UPDATE
SET dataset_id = EXCLUDED.dataset_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_enabled = true,
    deleted_at = NULL;
