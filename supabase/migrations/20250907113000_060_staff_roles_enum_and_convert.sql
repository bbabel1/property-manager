-- Create enum staff_roles and convert public.staff.role to use it

BEGIN;

-- 1) Create enum if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'staff_roles'
  ) THEN
    CREATE TYPE public.staff_roles AS ENUM ('Property Manager','Bookkeeper');
    COMMENT ON TYPE public.staff_roles IS 'Roles for internal staff accounts.';
  END IF;
END $$;

-- 2) Add temp column of enum type
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS role_new public.staff_roles;

-- 3) Backfill mapping from legacy varchar role
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'role'
  ) THEN
    UPDATE public.staff s
    SET role_new = CASE
      WHEN upper(coalesce(s.role::text,'')) IN ('PROPERTY_MANAGER','PROPERTY MANAGER') THEN 'Property Manager'::public.staff_roles
      WHEN upper(coalesce(s.role::text,'')) IN ('BOOKKEEPER','BOOK KEEPER') THEN 'Bookkeeper'::public.staff_roles
      ELSE 'Property Manager'::public.staff_roles
    END
    WHERE s.role_new IS NULL;
  END IF;
END $$;

-- 4) Swap columns safely
ALTER TABLE public.staff DROP COLUMN IF EXISTS role;
ALTER TABLE public.staff RENAME COLUMN role_new TO role;

-- 5) Defaults and not null
ALTER TABLE public.staff ALTER COLUMN role SET DEFAULT 'Property Manager';
ALTER TABLE public.staff ALTER COLUMN role SET NOT NULL;

COMMENT ON COLUMN public.staff.role IS 'Staff role (enum)';

COMMIT;

