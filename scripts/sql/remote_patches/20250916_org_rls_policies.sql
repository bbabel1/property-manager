-- Deprecated remote patch: organization-scoped RLS policies and grants.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should add or
--   modify RLS policies and privileges.
--
-- This file is retained for historical context only and MUST NOT be used
-- to apply schema changes. Organization RLS is now maintained exclusively
-- via migrations (see the 20250911–20250919 RLS/auth migration tranche).

