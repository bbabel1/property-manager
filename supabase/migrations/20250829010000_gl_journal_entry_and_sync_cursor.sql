-- Add JournalEntry to transaction_type_enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type_enum' AND e.enumlabel = 'JournalEntry'
  ) THEN
    ALTER TYPE public.transaction_type_enum ADD VALUE 'JournalEntry';
  END IF;
END$$;

-- Create journal_entries table to store a normalized view of GL entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_gl_entry_id integer UNIQUE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  date date NOT NULL,
  memo text,
  check_number text,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Simple updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER set_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cursor table for idempotent GL sync windows
CREATE TABLE IF NOT EXISTS public.gl_import_cursors (
  key text PRIMARY KEY,
  last_imported_at timestamptz NOT NULL DEFAULT '1970-01-01'::timestamptz,
  window_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_gl_import_cursors_updated_at ON public.gl_import_cursors;
CREATE TRIGGER set_gl_import_cursors_updated_at
BEFORE UPDATE ON public.gl_import_cursors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

