-- Deprecated remote patch: lease document SHA metadata / integrity helpers.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should introduce
--   new columns, indexes, or helpers on lease_documents/files.
--
-- This file is retained for historical context only and MUST NOT be used
-- to apply schema changes. Use migrations (including the files/lease
-- unification migrations) as the single source of truth.

