-- Extend property-level compliance program overrides to track assignment state and audit info

ALTER TABLE public.compliance_property_program_overrides
  ADD COLUMN IF NOT EXISTS is_assigned boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);

-- Backfill existing rows so the new columns are populated
UPDATE public.compliance_property_program_overrides
SET
  is_assigned = COALESCE(is_assigned, true),
  assigned_at = COALESCE(assigned_at, created_at)
WHERE is_assigned IS NULL
   OR assigned_at IS NULL;

ALTER TABLE public.compliance_property_program_overrides
  ALTER COLUMN is_assigned SET DEFAULT true,
  ALTER COLUMN is_assigned SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_property_program_overrides_assignment
  ON public.compliance_property_program_overrides(property_id, program_id, is_assigned);
