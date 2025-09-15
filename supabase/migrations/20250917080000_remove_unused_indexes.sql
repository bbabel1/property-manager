-- Remove Unused Indexes for Performance Optimization
-- This migration removes indexes that have never been used (0 scans) to improve
-- write performance and reduce storage overhead

-- ============================================================================
-- PART 1: REMOVE UNUSED INDEXES
-- ============================================================================

-- Remove unused indexes from reconciliation_log table
-- These indexes have 0 scans and are not being used
DROP INDEX IF EXISTS public.idx_reconciliation_log_bank_account_id;
DROP INDEX IF EXISTS public.rl_buildium_rec_uidx;
DROP INDEX IF EXISTS public.rl_gl_idx;
DROP INDEX IF EXISTS public.rl_prop_gl_asof_uidx;
DROP INDEX IF EXISTS public.rl_prop_idx;

-- Remove unused index from staff table
-- This index has 0 scans and is not being used
DROP INDEX IF EXISTS public."Staff_buildium_user_id_idx";

-- ============================================================================
-- PART 2: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Removed 6 unused indexes (5 from reconciliation_log, 1 from staff) to improve write performance and reduce storage overhead';
