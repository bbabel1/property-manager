-- Rename boiler compliance programs to remove "Internal/External" and "& Filing"

DO $$
BEGIN
  -- Templates
  UPDATE public.compliance_program_templates
  SET name = 'Annual High-Pressure Boiler Inspection'
  WHERE code = 'NYC_BOILER_HP_ANNUAL';

  UPDATE public.compliance_program_templates
  SET name = 'Annual Low-Pressure Boiler Inspection'
  WHERE code = 'NYC_BOILER_LP_ANNUAL';

  -- Org-level programs
  UPDATE public.compliance_programs
  SET name = 'Annual High-Pressure Boiler Inspection'
  WHERE code = 'NYC_BOILER_HP_ANNUAL';

  UPDATE public.compliance_programs
  SET name = 'Annual Low-Pressure Boiler Inspection'
  WHERE code = 'NYC_BOILER_LP_ANNUAL';
END $$;
