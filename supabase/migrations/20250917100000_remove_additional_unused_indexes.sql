-- Remove Additional Unused Indexes for Performance Optimization
-- This migration removes indexes that have never been used (0 scans) to improve
-- write performance and reduce storage overhead, as identified in the latest scan.

-- ============================================================================
-- PART 1: REMOVE UNUSED INDEXES (EXCLUDING PRIMARY KEYS AND FOREIGN KEY INDEXES)
-- ============================================================================

-- Remove unused indexes from public.bill_categories table
-- Keep primary key and foreign key indexes, remove unused ones
DROP INDEX IF EXISTS public.idx_bill_categories_active;
DROP INDEX IF EXISTS public.idx_bill_categories_buildium_id;
DROP INDEX IF EXISTS public.idx_bill_categories_name;

-- Remove unused indexes from public.buildium_api_log table
-- Keep primary key, remove unused ones
DROP INDEX IF EXISTS public.idx_buildium_api_log_created;
DROP INDEX IF EXISTS public.idx_buildium_api_log_endpoint;
DROP INDEX IF EXISTS public.idx_buildium_api_log_method;
DROP INDEX IF EXISTS public.idx_buildium_api_log_status;

-- Remove unused indexes from public.inspections table
-- Keep primary key, remove unused ones
DROP INDEX IF EXISTS public.inspections_property_idx;
DROP INDEX IF EXISTS public.inspections_unit_id_idx;
DROP INDEX IF EXISTS public.inspections_unit_idx;

-- ============================================================================
-- PART 2: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Removed 10 additional unused indexes to improve write performance and reduce storage overhead';
