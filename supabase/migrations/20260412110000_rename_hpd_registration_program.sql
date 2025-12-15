-- Rename MDR program to HPD Registrations

DO $$
BEGIN
  UPDATE public.compliance_program_templates
  SET name = 'HPD Registrations', updated_at = now()
  WHERE code = 'NYC_HPD_REGISTRATION';

  UPDATE public.compliance_programs
  SET name = 'HPD Registrations', updated_at = now()
  WHERE code = 'NYC_HPD_REGISTRATION';
END $$;
