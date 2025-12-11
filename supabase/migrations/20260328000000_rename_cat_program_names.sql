-- Rename elevator CAT1/CAT5 programs and templates to the new short names

UPDATE public.compliance_program_templates
SET name = 'Elevator (CAT1)', updated_at = now()
WHERE code = 'NYC_ELV_CAT1';

UPDATE public.compliance_program_templates
SET name = 'Elevator (CAT5)', updated_at = now()
WHERE code = 'NYC_ELV_CAT5';

UPDATE public.compliance_programs
SET name = 'Elevator (CAT1)', updated_at = now()
WHERE code = 'NYC_ELV_CAT1';

UPDATE public.compliance_programs
SET name = 'Elevator (CAT5)', updated_at = now()
WHERE code = 'NYC_ELV_CAT5';
