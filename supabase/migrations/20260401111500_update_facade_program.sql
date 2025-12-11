-- Align facade compliance program (FISP/Local Law 11) with DOB NOW Safety Facade filings

DO $$
BEGIN
  UPDATE public.compliance_program_templates
  SET
    name = 'Facade Inspection Safety Program (FISP/LL11) – Critical Exam & Report',
    jurisdiction = 'NYC_DOB',
    frequency_months = 60,
    lead_time_days = 180,
    applies_to = 'asset',
    severity_score = 5,
    notes = 'Critical examination and report per FISP cycle (Local Law 11). Buildings > 6 stories with exterior walls facing a public right-of-way. QEWI files report (Safe / SWARMP / Unsafe); unsafe requires immediate protection/repair. Late/missing filings incur fines.',
    criteria = jsonb_strip_nulls(
      jsonb_build_object(
        'property_filters', jsonb_build_object('require_bin', true),
        'asset_filters', jsonb_build_object('asset_types', ARRAY['facade']::text[], 'active_only', true)
      )
    ),
    is_active = true,
    updated_at = now()
  WHERE code = 'NYC_FACADE_LL11';

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
  WHERE t.code = 'NYC_FACADE_LL11'
    AND p.code = 'NYC_FACADE_LL11';
END $$;
