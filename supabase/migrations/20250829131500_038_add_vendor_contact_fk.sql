-- Migration: Add contact_id FK to vendors -> contacts(id)

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS contact_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND constraint_name = 'vendors_contact_id_fkey'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_contact_id ON public.vendors(contact_id);

COMMENT ON COLUMN public.vendors.contact_id IS 'FK to contacts.id for the vendor primary contact';

