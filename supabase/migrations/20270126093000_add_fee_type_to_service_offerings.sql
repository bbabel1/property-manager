-- Add fee_type to service_offerings so default rates can be tracked as percentage or flat values

BEGIN;

-- Ensure enum exists (restored in later migrations but guard for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'fee_type_enum'
  ) THEN
    CREATE TYPE public.fee_type_enum AS ENUM ('Percentage', 'Flat Rate');
    COMMENT ON TYPE public.fee_type_enum IS 'Fee type for management fees (Percentage or Flat Rate).';
  END IF;
END $$;

ALTER TABLE public.service_offerings
  ADD COLUMN IF NOT EXISTS fee_type public.fee_type_enum DEFAULT 'Flat Rate';

-- Backfill existing rows to a sensible default
UPDATE public.service_offerings
SET fee_type = 'Flat Rate'
WHERE fee_type IS NULL;

COMMIT;
