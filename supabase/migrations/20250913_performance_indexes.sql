-- Performance indexes for property details, ownerships, and reconciliation flows
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a function/transaction.
-- These indexes are created without CONCURRENTLY to allow transactional migrations.

-- Units by property with orderable unit_number
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id_unit_number ON public.units(property_id, unit_number);

-- Existing ownerships indexes for property_id and owner_id are defined in
-- supabase/migrations/20250829190000_owner_indexes.sql. We only add the
-- new composite index below to enhance filtering by the primary flag.
CREATE INDEX IF NOT EXISTS idx_ownerships_property_primary ON public.ownerships(property_id, "primary");

-- Property staff by property
-- Already created in 20250906000000_create_property_staff.sql

-- Reconciliation log accelerators
CREATE INDEX IF NOT EXISTS idx_recon_log_buildium_id ON public.reconciliation_log(buildium_reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_recon_log_property_id ON public.reconciliation_log(property_id);

-- Optional transactional indexes (comment out if these tables are not present in your environment)
-- CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON public.transactions(property_id);
-- CREATE INDEX IF NOT EXISTS idx_transactions_property_date ON public.transactions(property_id, date);
-- CREATE INDEX IF NOT EXISTS idx_tx_lines_property_id ON public.transaction_lines(property_id);
-- CREATE INDEX IF NOT EXISTS idx_tx_lines_property_date ON public.transaction_lines(property_id, date);
