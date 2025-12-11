-- Align HPD registration compliance program with MDR applicability and criteria

DO $$
BEGIN
  UPDATE public.compliance_program_templates
  SET
    name = 'Annual Property / Multiple Dwelling Registration (MDR)',
    jurisdiction = 'NYC_HPD',
    frequency_months = 12,
    lead_time_days = 60,
    applies_to = 'property',
    severity_score = 2,
    notes = 'Annual HPD registration (MDR) for residential buildings (3+ units) and 1–2 family where neither owner nor immediate family resides. Registration required to resolve HPD violations and bring housing court actions.',
    criteria = jsonb_strip_nulls(
      jsonb_build_object(
        'property_filters',
        jsonb_build_object(
          'require_bin', true,
          'min_dwelling_units', 3,
          'is_private_residence_building', false
        )
      )
    ),
    is_active = true,
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
