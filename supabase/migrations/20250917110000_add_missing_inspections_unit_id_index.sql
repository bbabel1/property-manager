-- Add Missing Foreign Key Index for inspections.unit_id
-- This migration adds the missing index for the foreign key constraint

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEX
-- ============================================================================

-- inspections.unit_id -> units.id
CREATE INDEX IF NOT EXISTS idx_inspections_unit_id 
ON public.inspections (unit_id);

-- ============================================================================
-- PART 2: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Added missing foreign key index for inspections.unit_id to optimize join performance';
