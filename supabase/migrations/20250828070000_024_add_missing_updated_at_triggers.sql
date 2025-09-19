-- Ensure every table with an updated_at column has a standard BEFORE UPDATE trigger
-- Uses public.set_updated_at() which sets NEW.updated_at := now()

DO $$
DECLARE
  r RECORD;
  trig_name text;
BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  ) LOOP
    trig_name := 'trg_' || r.table_name || '_updated_at';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = r.table_schema
        AND c.relname = r.table_name
        AND t.tgname = trig_name
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()'
        , trig_name, r.table_schema, r.table_name
      );
    END IF;
  END LOOP;
END
$$;

