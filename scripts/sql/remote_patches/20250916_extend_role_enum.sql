DO $$ BEGIN
  -- Add 'Guarantor' to existing lease_contact_role_enum if not present
  IF NOT EXISTS (SELECT 1 FROM pg_type t
                 JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'lease_contact_role_enum' AND e.enumlabel = 'Guarantor') THEN
    ALTER TYPE public.lease_contact_role_enum ADD VALUE 'Guarantor';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

