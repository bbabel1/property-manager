-- Add canonical PaidBy/PaidTo columns on transactions for single-source-of-truth storage.
-- Notes:
-- - paid_to_type remains free-text initially (aligned to Buildium responses). We can migrate to an enum later.
-- - RLS stays enforced via existing transactions policies; this migration only adds columns/indexes.

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by_accounting_entity_id integer,
  ADD COLUMN IF NOT EXISTS paid_by_accounting_entity_type text,
  ADD COLUMN IF NOT EXISTS paid_by_accounting_entity_href text,
  ADD COLUMN IF NOT EXISTS paid_by_accounting_unit_id integer,
  ADD COLUMN IF NOT EXISTS paid_by_accounting_unit_href text,
  ADD COLUMN IF NOT EXISTS paid_by_label text,
  ADD COLUMN IF NOT EXISTS paid_to_buildium_id integer,
  ADD COLUMN IF NOT EXISTS paid_to_type text,
  ADD COLUMN IF NOT EXISTS paid_to_name text,
  ADD COLUMN IF NOT EXISTS paid_to_href text,
  ADD COLUMN IF NOT EXISTS paid_to_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_to_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Ensure only one local counterparty FK is set at a time.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_paid_to_single_fk_chk
    CHECK (
      (paid_to_vendor_id IS NULL OR paid_to_tenant_id IS NULL)
    );

-- Indexes to support bank register lookups and (optional) property filters.
CREATE INDEX IF NOT EXISTS idx_transactions_bank_gl_date
  ON public.transactions (bank_gl_account_id, date);

CREATE INDEX IF NOT EXISTS idx_transactions_bank_gl_entity
  ON public.transactions (bank_gl_account_id, paid_by_accounting_entity_id);

COMMIT;

