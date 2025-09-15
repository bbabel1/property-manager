-- Add Missing Foreign Key Indexes for Performance Optimization
-- This migration adds covering indexes for foreign keys that were missing them,
-- which can significantly improve query performance for joins and foreign key operations

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- journal_entries.transaction_id -> transactions.id
-- This was specifically mentioned in the performance warning
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id 
ON public.journal_entries (transaction_id);

-- properties.operating_bank_account_id -> bank_accounts.id
CREATE INDEX IF NOT EXISTS idx_properties_operating_bank_account_id 
ON public.properties (operating_bank_account_id);

-- reconciliation_log.bank_account_id -> bank_accounts.id
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_bank_account_id 
ON public.reconciliation_log (bank_account_id);

-- task_categories.parent_id -> task_categories.id (self-referencing FK)
CREATE INDEX IF NOT EXISTS idx_task_categories_parent_id 
ON public.task_categories (parent_id);

-- tasks.requested_by_contact_id -> contacts.id
CREATE INDEX IF NOT EXISTS idx_tasks_requested_by_contact_id 
ON public.tasks (requested_by_contact_id);

-- ============================================================================
-- PART 2: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Added missing foreign key indexes for journal_entries.transaction_id, properties.operating_bank_account_id, reconciliation_log.bank_account_id, task_categories.parent_id, and tasks.requested_by_contact_id';
