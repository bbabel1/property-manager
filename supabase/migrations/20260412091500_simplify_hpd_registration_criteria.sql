-- Simplify MDR applicability to residential unit threshold sourced from PLUTO (UnitsRes)

DO $$
BEGIN
  UPDATE public.compliance_program_templates
  SET
    criteria = jsonb_strip_nulls(
      jsonb_build_object(
        'property_filters',
        jsonb_build_object('min_dwelling_units', 3)
      )
    ),
    notes = 'Annual HPD registration (MDR) for residential buildings with 3+ units (PLUTO UnitsRes). Registration required to resolve HPD violations and bring housing court actions.',
    updated_at = now()
  WHERE code = 'NYC_HPD_REGISTRATION';

  UPDATE public.compliance_programs p
  SET
    name = t.name,
    jurisdiction = t.jurisdiction,
    frequency_months = t.frequency_months,
    lead_time_days = t.lead_time_days,
    applies_to = t.applies_to,
    severity_score = t.severity_score,
    notes = t.notes,
    criteria = t.criteria,
    is_enabled = true,
    updated_at = now()
  FROM public.compliance_program_templates t
  WHERE t.code = 'NYC_HPD_REGISTRATION'
    AND p.code = 'NYC_HPD_REGISTRATION';
END $$;
