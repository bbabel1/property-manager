-- Add separate boiler compliance programs for low-pressure and high-pressure inspections/filings

DO $$
BEGIN
  -- Templates
  INSERT INTO public.compliance_program_templates (
    code, name, jurisdiction, frequency_months, lead_time_days, applies_to, severity_score, notes, criteria, is_active
  ) VALUES
    (
      'NYC_BOILER_LP_ANNUAL',
      'Annual Low-Pressure Boiler Inspection & Filing',
      'NYC_DOB',
      12,
      30,
      'asset',
      4,
      'Annual low-pressure boiler inspection and filing via DOB NOW: Safety. Late filings incur civil penalties.',
      jsonb_strip_nulls(
        jsonb_build_object(
          'asset_filters', jsonb_build_object('asset_types', ARRAY['boiler']::text[], 'active_only', true),
          'property_filters', jsonb_build_object('require_bin', true)
        )
      ),
      true
    ),
    (
      'NYC_BOILER_HP_ANNUAL',
      'Annual High-Pressure Boiler Internal/External Inspection',
      'NYC_DOB',
      12,
      30,
      'asset',
      5,
      'Annual internal and external inspections for high-pressure boilers; filings submitted via DOB NOW: Safety.',
      jsonb_strip_nulls(
        jsonb_build_object(
          'asset_filters', jsonb_build_object('asset_types', ARRAY['boiler']::text[], 'active_only', true),
          'property_filters', jsonb_build_object('require_bin', true)
        )
      ),
      true
    )
  ON CONFLICT (code) DO UPDATE
    SET
      name = EXCLUDED.name,
      jurisdiction = EXCLUDED.jurisdiction,
      frequency_months = EXCLUDED.frequency_months,
      lead_time_days = EXCLUDED.lead_time_days,
      applies_to = EXCLUDED.applies_to,
      severity_score = EXCLUDED.severity_score,
      notes = EXCLUDED.notes,
      criteria = EXCLUDED.criteria,
      is_active = EXCLUDED.is_active,
      updated_at = now();

  -- Enable for all orgs
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
    o.id AS org_id,
    t.id AS template_id,
    t.code,
    t.name,
    t.jurisdiction,
    t.frequency_months,
    t.lead_time_days,
    t.applies_to,
    t.severity_score,
    true AS is_enabled,
    t.notes,
    t.criteria
  FROM public.organizations o
  CROSS JOIN public.compliance_program_templates t
  WHERE t.code IN ('NYC_BOILER_LP_ANNUAL', 'NYC_BOILER_HP_ANNUAL')
  ON CONFLICT (org_id, code) DO UPDATE
    SET
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
END $$;
