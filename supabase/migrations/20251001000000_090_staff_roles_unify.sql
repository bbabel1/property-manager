-- Unify staff role enum usage on staff/property_staff to the canonical staff_roles enum
-- Adds missing enum values and migrates columns to use public.staff_roles (Title Case values)

BEGIN;

-- 1) Ensure staff_roles enum exists with full set of values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'staff_roles'
  ) THEN
    CREATE TYPE public.staff_roles AS ENUM (
      'Property Manager',
      'Assistant Property Manager',
      'Maintenance Coordinator',
      'Accountant',
      'Administrator',
      'Bookkeeper'
    );
    COMMENT ON TYPE public.staff_roles IS 'Roles for internal staff accounts.';
  ELSE
    -- Add missing values idempotently
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'staff_roles' AND e.enumlabel = 'Assistant Property Manager'
    ) THEN ALTER TYPE public.staff_roles ADD VALUE 'Assistant Property Manager'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'staff_roles' AND e.enumlabel = 'Maintenance Coordinator'
    ) THEN ALTER TYPE public.staff_roles ADD VALUE 'Maintenance Coordinator'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'staff_roles' AND e.enumlabel = 'Accountant'
    ) THEN ALTER TYPE public.staff_roles ADD VALUE 'Accountant'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'staff_roles' AND e.enumlabel = 'Administrator'
    ) THEN ALTER TYPE public.staff_roles ADD VALUE 'Administrator'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'staff_roles' AND e.enumlabel = 'Bookkeeper'
    ) THEN ALTER TYPE public.staff_roles ADD VALUE 'Bookkeeper'; END IF;
  END IF;
END $$;

-- Helper to migrate a column to staff_roles when it is still using staff_role
DO $$ DECLARE
  col_type text;
BEGIN
  -- staff.role
  SELECT atttypid::regtype::text INTO col_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'staff' AND a.attname = 'role';

  IF col_type IS NOT NULL AND col_type <> 'public.staff_roles' THEN
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role_new public.staff_roles;
    UPDATE public.staff s
      SET role_new = CASE
        WHEN upper(coalesce(s.role::text, '')) IN ('PROPERTY_MANAGER','PROPERTY MANAGER') THEN 'Property Manager'::public.staff_roles
        WHEN upper(coalesce(s.role::text, '')) IN ('ASSISTANT_PROPERTY_MANAGER','ASSISTANT PROPERTY MANAGER') THEN 'Assistant Property Manager'::public.staff_roles
        WHEN upper(coalesce(s.role::text, '')) IN ('MAINTENANCE_COORDINATOR','MAINTENANCE COORDINATOR') THEN 'Maintenance Coordinator'::public.staff_roles
        WHEN upper(coalesce(s.role::text, '')) IN ('ACCOUNTANT') THEN 'Accountant'::public.staff_roles
        WHEN upper(coalesce(s.role::text, '')) IN ('ADMINISTRATOR') THEN 'Administrator'::public.staff_roles
        ELSE 'Property Manager'::public.staff_roles
      END
    WHERE s.role_new IS NULL;

    ALTER TABLE public.staff DROP COLUMN IF EXISTS role;
    ALTER TABLE public.staff RENAME COLUMN role_new TO role;
    ALTER TABLE public.staff ALTER COLUMN role SET DEFAULT 'Property Manager'::public.staff_roles;
    ALTER TABLE public.staff ALTER COLUMN role SET NOT NULL;
    COMMENT ON COLUMN public.staff.role IS 'Staff role (enum)';
  END IF;
END $$;

-- property_staff.role
DO $$ DECLARE
  col_type text;
BEGIN
  SELECT atttypid::regtype::text INTO col_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'property_staff' AND a.attname = 'role';

  IF col_type IS NOT NULL AND col_type <> 'public.staff_roles' THEN
    ALTER TABLE public.property_staff ADD COLUMN IF NOT EXISTS role_new public.staff_roles;
    UPDATE public.property_staff ps
      SET role_new = CASE
        WHEN upper(coalesce(ps.role::text, '')) IN ('PROPERTY_MANAGER','PROPERTY MANAGER') THEN 'Property Manager'::public.staff_roles
        WHEN upper(coalesce(ps.role::text, '')) IN ('ASSISTANT_PROPERTY_MANAGER','ASSISTANT PROPERTY MANAGER') THEN 'Assistant Property Manager'::public.staff_roles
        WHEN upper(coalesce(ps.role::text, '')) IN ('MAINTENANCE_COORDINATOR','MAINTENANCE COORDINATOR') THEN 'Maintenance Coordinator'::public.staff_roles
        WHEN upper(coalesce(ps.role::text, '')) IN ('ACCOUNTANT') THEN 'Accountant'::public.staff_roles
        WHEN upper(coalesce(ps.role::text, '')) IN ('ADMINISTRATOR') THEN 'Administrator'::public.staff_roles
        WHEN upper(coalesce(ps.role::text, '')) IN ('BOOKKEEPER','BOOK KEEPER') THEN 'Bookkeeper'::public.staff_roles
        ELSE 'Property Manager'::public.staff_roles
      END
    WHERE ps.role_new IS NULL;

    ALTER TABLE public.property_staff DROP COLUMN IF EXISTS role;
    ALTER TABLE public.property_staff RENAME COLUMN role_new TO role;
    ALTER TABLE public.property_staff ALTER COLUMN role SET DEFAULT 'Property Manager'::public.staff_roles;
    ALTER TABLE public.property_staff ALTER COLUMN role SET NOT NULL;
  END IF;
END $$;

-- Indexes remain valid; defaults re-applied above

COMMIT;
