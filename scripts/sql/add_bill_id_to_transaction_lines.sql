-- Deprecated schema patch: add buildium_bill_id to transaction_lines.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should define or
--   modify the canonical database schema.
--
-- The authoritative Buildium bill linkage now lives on public.transactions
-- (see initial schema and later bill-related migrations). There is no
-- application code that relies on a buildium_bill_id column on
-- transaction_lines, and this script MUST NOT be used to add one.
--
-- Read-only drift check: shows whether any database has this extra column.
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transaction_lines'
  AND column_name = 'buildium_bill_id';

