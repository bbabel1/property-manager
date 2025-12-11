-- Refine elevator compliance program applicability and cadence

-- Create temporary table to hold criteria values (persists across statements)
CREATE TEMP TABLE IF NOT EXISTS elevator_criteria AS
SELECT
  jsonb_build_object(
    'property_filters', jsonb_build_object('require_bin', true),
    'asset_filters', jsonb_build_object(
      'asset_types', ARRAY['elevator'],
      'active_only', true,
      'device_categories', ARRAY['elevator','escalator','dumbwaiter','wheelchair_lift','material_lift','manlift','pneumatic_elevator']
    )
  ) AS periodic,
  jsonb_build_object(
    'property_filters', jsonb_build_object('require_bin', true),
    'asset_filters', jsonb_build_object(
      'asset_types', ARRAY['elevator'],
      'active_only', true,
      'device_categories', ARRAY['elevator','escalator','dumbwaiter','wheelchair_lift','material_lift','manlift','pneumatic_elevator']
    )
  ) AS cat1,
  jsonb_build_object(
    'property_filters', jsonb_build_object('require_bin', true),
    'asset_filters', jsonb_build_object(
      'asset_types', ARRAY['elevator'],
      'active_only', true,
      'device_categories', ARRAY['elevator'],
      'exclude_device_categories', ARRAY['wheelchair_lift','dumbwaiter','material_lift','manlift','pneumatic_elevator','escalator']
    )
  ) AS cat5,
  jsonb_build_object(
    'property_filters', jsonb_build_object('require_bin', true),
    'asset_filters', jsonb_build_object(
      'asset_types', ARRAY['elevator'],
      'active_only', true,
      'device_categories', ARRAY['elevator','escalator','dumbwaiter','wheelchair_lift','material_lift','manlift','pneumatic_elevator']
    )
  ) AS aoc;

-- Templates
UPDATE public.compliance_program_templates t
SET
  frequency_months = 12,
  lead_time_days = 14,
  criteria = c.periodic,
  notes = 'Annual DOB periodic visual inspection; inspection Jan 1–Dec 31; filing within 14 days (late after Jan 14 of following year not accepted). Applies to DOB-regulated elevators, escalators, dumbwaiters, platform/material lifts; limited single-family exemptions.'
FROM elevator_criteria c
WHERE t.code = 'NYC_ELV_PERIODIC';

UPDATE public.compliance_program_templates t
SET
  frequency_months = 12,
  lead_time_days = 21,
  criteria = c.cat1,
  notes = 'Annual CAT1 no-load test Jan 1–Dec 31; filing within 21 days (late after Jan 21 of following year not accepted). Defects corrected within 90 days with AOC within 14 days. Applies to DOB-regulated elevator/conveying devices.'
FROM elevator_criteria c
WHERE t.code = 'NYC_ELV_CAT1';

UPDATE public.compliance_program_templates t
SET
  frequency_months = 60,
  lead_time_days = 21,
  criteria = c.cat5,
  notes = 'Five-year CAT5 full-load test; due within 5 years of prior CAT5 or new C of C; filing within 21 days and no later than the 21st day of the month after the 5-year anniversary. Applies to most traction/passenger/freight elevators; excludes VPL, dumbwaiter, escalator, and similar lift devices unless DOB directs otherwise.'
FROM elevator_criteria c
WHERE t.code = 'NYC_ELV_CAT5';

UPDATE public.compliance_program_templates t
SET
  frequency_months = 0,
  lead_time_days = 0,
  criteria = c.aoc,
  notes = 'Per-defect correction and AOC filing tied to CAT1/periodic findings; correct within 90 days and file AOC within 14 days of correction (FTC after day 104). Device-level, disabled by default, ad-hoc cadence.'
FROM elevator_criteria c
WHERE t.code = 'NYC_ELV_AOC';

-- Programs (org-scoped copies)
UPDATE public.compliance_programs p
SET
  frequency_months = 12,
  lead_time_days = 14,
  criteria = c.periodic,
  notes = 'Annual DOB periodic visual inspection; inspection Jan 1–Dec 31; filing within 14 days (late after Jan 14 of following year not accepted). Applies to DOB-regulated elevators, escalators, dumbwaiters, platform/material lifts; limited single-family exemptions.'
FROM elevator_criteria c
WHERE p.code = 'NYC_ELV_PERIODIC';

UPDATE public.compliance_programs p
SET
  frequency_months = 12,
  lead_time_days = 21,
  criteria = c.cat1,
  notes = 'Annual CAT1 no-load test Jan 1–Dec 31; filing within 21 days (late after Jan 21 of following year not accepted). Defects corrected within 90 days with AOC within 14 days. Applies to DOB-regulated elevator/conveying devices.'
FROM elevator_criteria c
WHERE p.code = 'NYC_ELV_CAT1';

UPDATE public.compliance_programs p
SET
  frequency_months = 60,
  lead_time_days = 21,
  criteria = c.cat5,
  notes = 'Five-year CAT5 full-load test; due within 5 years of prior CAT5 or new C of C; filing within 21 days and no later than the 21st day of the month after the 5-year anniversary. Applies to most traction/passenger/freight elevators; excludes VPL, dumbwaiter, escalator, and similar lift devices unless DOB directs otherwise.'
FROM elevator_criteria c
WHERE p.code = 'NYC_ELV_CAT5';

UPDATE public.compliance_programs p
SET
  frequency_months = 0,
  lead_time_days = 0,
  criteria = c.aoc,
  notes = 'Per-defect correction and AOC filing tied to CAT1/periodic findings; correct within 90 days and file AOC within 14 days of correction (FTC after day 104). Device-level, disabled by default, ad-hoc cadence.',
  is_enabled = false
FROM elevator_criteria c
WHERE p.code = 'NYC_ELV_AOC';
