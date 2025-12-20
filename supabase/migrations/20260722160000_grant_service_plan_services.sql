-- Ensure PostgREST roles can access service_plan_services (required for schema cache visibility).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_plan_services'
  ) THEN
    EXECUTE 'GRANT ALL ON TABLE public.service_plan_services TO anon, authenticated, service_role';
  END IF;
END $$;

-- Refresh PostgREST schema cache so the table becomes available immediately.
NOTIFY pgrst, 'reload schema';

