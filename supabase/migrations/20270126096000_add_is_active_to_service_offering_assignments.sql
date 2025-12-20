-- Add active/inactive control to service_offering_assignments.

BEGIN;

ALTER TABLE IF EXISTS public.service_offering_assignments
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_service_offering_assignments_active
  ON public.service_offering_assignments(assignment_id, is_active);

COMMIT;

NOTIFY pgrst, 'reload schema';

