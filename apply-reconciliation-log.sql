 
-- Deprecated schema apply script for reconciliation_log.
-- 
-- Phase 1 goal: ensure only Supabase migrations change schema.
-- The authoritative DDL for reconciliation_log now lives in:
--   supabase/migrations/20250912000001_069_reconciliation_log_buildium.sql
--
-- This file is intentionally read-only. It can be used to sanity‑check
-- that the expected columns exist, but MUST NOT mutate schema.

-- Basic verification query (safe to run in Supabase SQL editor)
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reconciliation_log'
order by ordinal_position;
