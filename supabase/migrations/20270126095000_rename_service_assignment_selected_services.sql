-- Rename assignment-level selected services table to service_offering_assignments.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_assignment_selected_services'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_offering_assignments'
  ) THEN
    ALTER TABLE public.service_assignment_selected_services
      RENAME TO service_offering_assignments;
  END IF;
END $$;

-- Rename indexes if they exist (optional; keeps schema tidy).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_service_assignment_selected_services_assignment') THEN
    ALTER INDEX public.idx_service_assignment_selected_services_assignment
      RENAME TO idx_service_offering_assignments_assignment;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_service_assignment_selected_services_offering') THEN
    ALTER INDEX public.idx_service_assignment_selected_services_offering
      RENAME TO idx_service_offering_assignments_offering;
  END IF;
END $$;

-- Rename policy if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_offering_assignments'
      AND policyname = 'service_assignment_selected_services_rw'
  ) THEN
    ALTER POLICY service_assignment_selected_services_rw
      ON public.service_offering_assignments
      RENAME TO service_offering_assignments_rw;
  END IF;
END $$;

COMMIT;

-- Refresh PostgREST schema cache so the renamed table becomes available immediately.
NOTIFY pgrst, 'reload schema';

