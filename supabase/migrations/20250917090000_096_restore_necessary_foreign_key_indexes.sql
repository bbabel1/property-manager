-- Restore Necessary Foreign Key Indexes
-- This migration adds back the foreign key indexes that were accidentally removed
-- but are actually needed for foreign key constraints

-- ============================================================================
-- PART 1: RESTORE NECESSARY FOREIGN KEY INDEXES
-- ============================================================================

-- reconciliation_log.bank_account_id -> bank_accounts.id
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_bank_account_id 
ON public.reconciliation_log (bank_account_id);

-- reconciliation_log.gl_account_id -> gl_accounts.id
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_gl_account_id 
ON public.reconciliation_log (gl_account_id);

-- reconciliation_log.property_id -> properties.id
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_property_id 
ON public.reconciliation_log (property_id);

-- ============================================================================
-- PART 2: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Restored necessary foreign key indexes for reconciliation_log table that were accidentally removed';
