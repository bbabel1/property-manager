-- Remove legacy monitoring view that is no longer used after GL-only bank migration.
-- transactions_missing_bank_line was introduced as a diagnostic for orphaned transactions
-- without a bank GL line. App/edge code no longer references it, so it can be dropped safely.

DROP VIEW IF EXISTS public.transactions_missing_bank_line;
