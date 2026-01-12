-- Deprecated remote patch: property/org-specific RLS policies.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should update
--   RLS policies and row-security configuration.
--
-- This file is retained for historical context only and MUST NOT be used
-- to apply schema changes. Property/org RLS is now managed in the RLS
-- migration tranche; add new migrations for future changes.

