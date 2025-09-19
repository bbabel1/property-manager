-- Migration: Add expense_gl_account_id (int4) to vendors
-- Purpose: Track an external expense GL account id alongside the existing gl_account UUID FK

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS expense_gl_account_id integer;

COMMENT ON COLUMN public.vendors.expense_gl_account_id IS 'External expense GL account identifier (e.g., Buildium GLAccount.Id)';

CREATE INDEX IF NOT EXISTS idx_vendors_expense_gl_account_id ON public.vendors(expense_gl_account_id);

