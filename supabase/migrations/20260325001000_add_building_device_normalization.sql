-- Add building occupancy/one-two family flags and device normalization fields

-- Buildings: occupancy + private residence flags
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS occupancy_group text,
  ADD COLUMN IF NOT EXISTS occupancy_description text,
  ADD COLUMN IF NOT EXISTS is_one_two_family boolean,
  ADD COLUMN IF NOT EXISTS is_private_residence_building boolean,
  ADD COLUMN IF NOT EXISTS dwelling_unit_count integer;

-- Backfill dwelling_unit_count and simple 1–2 family flags from properties when obvious
WITH property_stats AS (
  SELECT
    building_id,
    MAX(total_units) AS total_units,
    bool_or(coalesce(total_units, 0) <= 2) AS any_two_or_less
  FROM public.properties
  WHERE building_id IS NOT NULL
  GROUP BY building_id
)
UPDATE public.buildings b
SET
  dwelling_unit_count = COALESCE(b.dwelling_unit_count, ps.total_units),
  is_one_two_family = COALESCE(b.is_one_two_family, ps.any_two_or_less),
  is_private_residence_building = COALESCE(b.is_private_residence_building, CASE WHEN ps.any_two_or_less THEN true ELSE NULL END)
FROM property_stats ps
WHERE b.id = ps.building_id;

-- Compliance assets: normalized device fields
ALTER TABLE public.compliance_assets
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS device_technology text,
  ADD COLUMN IF NOT EXISTS device_subtype text,
  ADD COLUMN IF NOT EXISTS is_private_residence boolean;

-- Guardrails for common categories/tech values (soft enums)
ALTER TABLE public.compliance_assets
  DROP CONSTRAINT IF EXISTS compliance_assets_device_category_chk;

ALTER TABLE public.compliance_assets
  ADD CONSTRAINT compliance_assets_device_category_chk
    CHECK (
      device_category IS NULL OR device_category IN (
        'elevator','escalator','dumbwaiter','wheelchair_lift','material_lift',
        'manlift','pneumatic_elevator','other_vertical','lift','chairlift',
        'boiler','sprinkler','gas_piping','generic','other'
      )
    );

ALTER TABLE public.compliance_assets
  DROP CONSTRAINT IF EXISTS compliance_assets_device_technology_chk;

ALTER TABLE public.compliance_assets
  ADD CONSTRAINT compliance_assets_device_technology_chk
    CHECK (
      device_technology IS NULL OR device_technology IN (
        'traction','hydraulic','roped_hydraulic','mrl_traction','winding_drum','other'
      )
    );

-- Indexes to support applicability queries
CREATE INDEX IF NOT EXISTS idx_compliance_assets_category ON public.compliance_assets(device_category);
CREATE INDEX IF NOT EXISTS idx_compliance_assets_category_technology ON public.compliance_assets(device_category, device_technology);
CREATE INDEX IF NOT EXISTS idx_compliance_assets_private_residence ON public.compliance_assets(is_private_residence);

-- Normalization lookup table for device types
CREATE TABLE IF NOT EXISTS public.device_type_normalization (
  id bigserial PRIMARY KEY,
  source_system text NOT NULL,
  raw_device_type text NOT NULL,
  raw_description text,
  normalized_category text NOT NULL,
  normalized_technology text,
  normalized_subtype text,
  default_is_private_residence boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_type_normalization_source_type_key UNIQUE (source_system, raw_device_type)
);

-- Keep updated_at fresh if helper exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_device_type_normalization_updated_at ON public.device_type_normalization;
    CREATE TRIGGER trg_device_type_normalization_updated_at
      BEFORE UPDATE ON public.device_type_normalization
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
