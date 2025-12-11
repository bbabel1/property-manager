-- Add criteria for compliance programs and templates

ALTER TABLE public.compliance_program_templates
  ADD COLUMN IF NOT EXISTS criteria jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.compliance_programs
  ADD COLUMN IF NOT EXISTS criteria jsonb DEFAULT '{}'::jsonb;

-- Ensure criteria stays an object when present
ALTER TABLE public.compliance_programs
  ADD CONSTRAINT compliance_programs_criteria_object_chk
  CHECK (criteria IS NULL OR jsonb_typeof(criteria) = 'object');

ALTER TABLE public.compliance_program_templates
  ADD CONSTRAINT compliance_program_templates_criteria_object_chk
  CHECK (criteria IS NULL OR jsonb_typeof(criteria) = 'object');

-- Index for criteria lookups
CREATE INDEX IF NOT EXISTS idx_compliance_programs_criteria ON public.compliance_programs USING gin (criteria);

-- Backfill defaults to mirror existing implicit rules
UPDATE public.compliance_programs
SET criteria = jsonb_strip_nulls(
  jsonb_build_object(
    'asset_filters', jsonb_build_object('asset_types', ARRAY['elevator']::text[], 'active_only', true),
    'property_filters', jsonb_build_object('require_bin', true)
  )
)
WHERE code LIKE 'NYC_ELV_%';

UPDATE public.compliance_programs
SET criteria = jsonb_strip_nulls(
  jsonb_build_object(
    'asset_filters', jsonb_build_object('asset_types', ARRAY['boiler']::text[], 'active_only', true),
    'property_filters', jsonb_build_object('require_bin', true)
  )
)
WHERE code = 'NYC_BOILER_ANNUAL';

UPDATE public.compliance_programs
SET criteria = jsonb_strip_nulls(
  jsonb_build_object(
    'asset_filters', jsonb_build_object('asset_types', ARRAY['sprinkler']::text[], 'active_only', true)
  )
)
WHERE code = 'NYC_SPRINKLER_ANNUAL';

UPDATE public.compliance_programs
SET criteria = jsonb_strip_nulls(
  jsonb_build_object(
    'property_filters', jsonb_build_object('require_bin', true)
  )
)
WHERE code IN ('NYC_GAS_PIPING', 'NYC_FACADE_LL11', 'NYC_HPD_REGISTRATION');
