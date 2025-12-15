-- Align boiler programs with pressure_type criteria

DO $$
BEGIN
  UPDATE public.compliance_program_templates
  SET criteria = jsonb_strip_nulls(
    jsonb_build_object(
      'asset_filters',
      jsonb_build_object(
        'asset_types', ARRAY['boiler']::text[],
        'active_only', true,
        'pressure_type', 'low_pressure'
      ),
      'property_filters', jsonb_build_object('require_bin', true)
    )
  )
  WHERE code = 'NYC_BOILER_LP_ANNUAL';

  UPDATE public.compliance_program_templates
  SET criteria = jsonb_strip_nulls(
    jsonb_build_object(
      'asset_filters',
      jsonb_build_object(
        'asset_types', ARRAY['boiler']::text[],
        'active_only', true,
        'pressure_type', 'high_pressure'
      ),
      'property_filters', jsonb_build_object('require_bin', true)
    )
  )
  WHERE code = 'NYC_BOILER_HP_ANNUAL';

  UPDATE public.compliance_programs p
  SET criteria = t.criteria
  FROM public.compliance_program_templates t
  WHERE p.code = t.code
    AND p.code IN ('NYC_BOILER_LP_ANNUAL', 'NYC_BOILER_HP_ANNUAL');
END $$;
