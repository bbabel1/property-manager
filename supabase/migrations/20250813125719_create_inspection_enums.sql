-- Migration: Create inspection_status_enum and inspection_type_enum

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status_enum') THEN
    CREATE TYPE inspection_status_enum AS ENUM ('Scheduled', 'Completed');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_type_enum') THEN
    CREATE TYPE inspection_type_enum AS ENUM ('Periodic', 'Move-In', 'Move-Out');
  END IF;
END$$;
