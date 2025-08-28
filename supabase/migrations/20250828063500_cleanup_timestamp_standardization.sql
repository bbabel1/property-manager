-- Cleanup migration: standardize timestamps to snake_case
-- Tables: public.lease, public.staff
-- Actions:
--  - Backfill snake_case from camelCase if needed
--  - Drop sync triggers and helper functions
--  - Add standard updated_at triggers using public.set_updated_at()
--  - Drop camelCase columns

-- 1) Lease: backfill snake_case from camelCase where missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'UPDATE public.lease SET created_at = COALESCE(created_at, "createdAt"), updated_at = COALESCE(updated_at, "updatedAt")';
  END IF;
END
$$;

-- 2) Staff: backfill snake_case from camelCase where missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'UPDATE public.staff SET created_at = COALESCE(created_at, "createdAt"), updated_at = COALESCE(updated_at, "updatedAt")';
  END IF;
END
$$;

-- 3) Drop sync triggers if present
DROP TRIGGER IF EXISTS "lease_timestamps_sync" ON "public"."lease";
DROP TRIGGER IF EXISTS "staff_timestamps_sync" ON "public"."staff";

-- 4) Drop sync functions if present
DROP FUNCTION IF EXISTS "public"."sync_lease_timestamps"();
DROP FUNCTION IF EXISTS "public"."sync_staff_timestamps"();

-- 5) Ensure standard updated_at triggers exist
-- Create (or replace) BEFORE UPDATE triggers to set updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_lease_updated_at'
  ) THEN
    CREATE TRIGGER "trg_lease_updated_at"
    BEFORE UPDATE ON "public"."lease"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_staff_updated_at'
  ) THEN
    CREATE TRIGGER "trg_staff_updated_at"
    BEFORE UPDATE ON "public"."staff"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
  END IF;
END
$$;

-- 6) Drop camelCase columns now that snake_case is authoritative
ALTER TABLE "public"."lease"
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE "public"."staff"
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";
