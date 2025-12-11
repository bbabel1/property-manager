-- Elevator compliance program enhancements

-- Upsert templates
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
   'Annual DOB periodic visual inspection; inspection Jan 1–Dec 31; report filed within 14 days; late after Jan 14 not accepted.', true,
   jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true))
  ),
  ('NYC_ELV_CAT1', 'Elevator (CAT1)', 'NYC_DOB', 12, 21, 'asset', 4,
   'Annual CAT1 no-load test Jan 1–Dec 31; filing within 21 days of test; late after Jan 21 not accepted; defects corrected within 90 days with AOC within 14 days of correction.', true,
   jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true))
  ),
  ('NYC_ELV_CAT5', 'Elevator (CAT5)', 'NYC_DOB', 60, 21, 'asset', 5,
   'Five-year CAT5 full-load test; due within 5 years of prior CAT5/new CoC; filing within 21 days of test and no later than 21st day of month after 5-year anniversary.', true,
   jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true))
  ),
  ('NYC_ELV_AOC', 'Elevator Defect Correction & Affirmation of Correction (AOC)', 'NYC_DOB', 12, 90, 'asset', 5,
   'Per-defect correction; defects corrected within 90 days; AOC filed within 14 days of correction; failure by day 104 yields FTC.', true,
   jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true))
  )
ON CONFLICT (code) DO UPDATE SET
  frequency_months = EXCLUDED.frequency_months,
  lead_time_days = EXCLUDED.lead_time_days,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  severity_score = EXCLUDED.severity_score,
  applies_to = EXCLUDED.applies_to,
  criteria = EXCLUDED.criteria,
  updated_at = now();

-- Enable templates for all orgs
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
  CASE WHEN t.code = 'NYC_ELV_AOC' THEN false ELSE true END as is_enabled,
  t.notes,
  t.criteria
FROM public.organizations o
CROSS JOIN public.compliance_program_templates t
WHERE t.code IN ('NYC_ELV_PERIODIC', 'NYC_ELV_CAT1', 'NYC_ELV_CAT5', 'NYC_ELV_AOC')
ON CONFLICT (org_id, code) DO UPDATE SET
  frequency_months = EXCLUDED.frequency_months,
  lead_time_days = EXCLUDED.lead_time_days,
  is_enabled = EXCLUDED.is_enabled,
  notes = EXCLUDED.notes,
  criteria = EXCLUDED.criteria,
  updated_at = now();

-- Ensure existing elevator programs carry criteria/notes updates
UPDATE public.compliance_programs
SET criteria = jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true)),
    notes = 'Annual CAT1 no-load test Jan 1–Dec 31; filing within 21 days; defects corrected within 90 days with AOC within 14 days of correction. Late after Jan 21 not accepted.'
WHERE code = 'NYC_ELV_CAT1';

UPDATE public.compliance_programs
SET criteria = jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true)),
    notes = 'Five-year CAT5 full-load test; filing within 21 days of test and no later than 21st day of month after 5-year anniversary.'
WHERE code = 'NYC_ELV_CAT5';

-- Periodic program criteria backfill
UPDATE public.compliance_programs
SET criteria = jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true)),
    notes = 'Annual DOB periodic visual inspection; inspection Jan 1–Dec 31; report filed within 14 days; late after Jan 14 not accepted.'
WHERE code = 'NYC_ELV_PERIODIC';

-- AOC program criteria backfill (disabled by default)
UPDATE public.compliance_programs
SET criteria = jsonb_build_object('asset_filters', jsonb_build_object('asset_types', ARRAY['elevator'], 'active_only', true), 'property_filters', jsonb_build_object('require_bin', true)),
    notes = 'Per-defect correction; defects corrected within 90 days; AOC filed within 14 days of correction; failure by day 104 yields FTC.',
    is_enabled = false
WHERE code = 'NYC_ELV_AOC';
