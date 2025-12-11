-- Elevator compliance program redesign and property-level overrides

-- Create property-level compliance program overrides
CREATE TABLE IF NOT EXISTS public.compliance_property_program_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  program_id uuid NOT NULL,
  is_enabled boolean,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT compliance_property_program_overrides_org_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT compliance_property_program_overrides_property_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  CONSTRAINT compliance_property_program_overrides_program_fkey FOREIGN KEY (program_id) REFERENCES public.compliance_programs(id) ON DELETE CASCADE,
  CONSTRAINT compliance_property_program_overrides_property_program_key UNIQUE (property_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_property_program_overrides_org ON public.compliance_property_program_overrides(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_property_program_overrides_property ON public.compliance_property_program_overrides(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_property_program_overrides_program ON public.compliance_property_program_overrides(program_id);

-- Trigger to maintain updated_at
CREATE TRIGGER update_compliance_property_program_overrides_updated_at
    BEFORE UPDATE ON public.compliance_property_program_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.compliance_property_program_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_property_program_overrides_select ON public.compliance_property_program_overrides
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY compliance_property_program_overrides_insert ON public.compliance_property_program_overrides
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY compliance_property_program_overrides_update ON public.compliance_property_program_overrides
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY compliance_property_program_overrides_delete ON public.compliance_property_program_overrides
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Normalize elevator templates/programs (device-scoped)
WITH criteria AS (
  SELECT jsonb_build_object(
    'asset_filters', jsonb_build_object(
      'asset_types', ARRAY['elevator'],
      'active_only', true,
      'device_categories', ARRAY['elevator']
    )
  ) AS base
)
INSERT INTO public.compliance_program_templates (
  code,
  name,
  jurisdiction,
  frequency_months,
  lead_time_days,
  applies_to,
  severity_score,
  notes,
  is_active,
  criteria
) VALUES
  ('NYC_ELV_PERIODIC', 'Elevator Periodic Inspection (visual)', 'NYC_DOB', 12, 14, 'asset', 4,
   'Annual visual inspection by approved elevator agency; inspection Jan 1–Dec 31 with filing within 14 days (late after Jan 14 of the following year not accepted). Applies to DOB-regulated elevators; inspecting agency must be independent of maintenance; late/missing filings trigger “Failure to File” violations.',
   true, (SELECT base FROM criteria)),
  ('NYC_ELV_CAT1', 'Elevator (CAT1)', 'NYC_DOB', 12, 21, 'asset', 4,
   'Annual CAT1 no-load test Jan 1–Dec 31; filing within 21 days of test (late after Jan 21 of following year not accepted). Applies to all elevators under DOB jurisdiction; defects corrected within 90 days with AOC within 14 days of correction; owner must hire approved third-party inspection agency.',
   true, (SELECT base FROM criteria)),
  ('NYC_ELV_CAT5', 'Elevator (CAT5)', 'NYC_DOB', 60, 21, 'asset', 5,
   'Five-year CAT5 full-load test; due within 5 years of prior CAT5/new certificate. Filing within 21 days of test and no later than the 21st day of the month after the 5-year anniversary. Applies to most traction/passenger/freight elevators; coordinate with an approved agency; late filings trigger significant penalties.',
   true, (SELECT base FROM criteria))
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  jurisdiction = EXCLUDED.jurisdiction,
  frequency_months = EXCLUDED.frequency_months,
  lead_time_days = EXCLUDED.lead_time_days,
  applies_to = EXCLUDED.applies_to,
  severity_score = EXCLUDED.severity_score,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  criteria = EXCLUDED.criteria,
  updated_at = now();

-- Upsert org-scoped programs from templates
INSERT INTO public.compliance_programs (
  org_id,
  template_id,
  code,
  name,
  jurisdiction,
  frequency_months,
  lead_time_days,
  applies_to,
  severity_score,
  is_enabled,
  notes,
  criteria
)
SELECT
  o.id,
  t.id,
  t.code,
  t.name,
  t.jurisdiction,
  t.frequency_months,
  t.lead_time_days,
  t.applies_to,
  t.severity_score,
  true,
  t.notes,
  t.criteria
FROM public.organizations o
CROSS JOIN public.compliance_program_templates t
WHERE t.code IN ('NYC_ELV_PERIODIC', 'NYC_ELV_CAT1', 'NYC_ELV_CAT5')
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  jurisdiction = EXCLUDED.jurisdiction,
  frequency_months = EXCLUDED.frequency_months,
  lead_time_days = EXCLUDED.lead_time_days,
  applies_to = EXCLUDED.applies_to,
  severity_score = EXCLUDED.severity_score,
  is_enabled = EXCLUDED.is_enabled,
  notes = EXCLUDED.notes,
  criteria = EXCLUDED.criteria,
  updated_at = now();

-- Disable legacy AOC template/program for elevators (kept for historical data)
UPDATE public.compliance_program_templates
SET is_active = false,
    frequency_months = 0,
    lead_time_days = 0
WHERE code = 'NYC_ELV_AOC';

UPDATE public.compliance_programs
SET is_enabled = false,
    frequency_months = 0,
    lead_time_days = 0
WHERE code = 'NYC_ELV_AOC';
