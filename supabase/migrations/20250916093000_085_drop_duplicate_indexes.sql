-- Drop unambiguous duplicate indexes to address performance warnings
-- Safe to run repeatedly; only drops if the index exists.

-- transaction_lines: two indexes on buildium_unit_id existed
drop index if exists public.journal_entries_buildium_unit_id_idx;

-- rent_schedules: duplicate lease_id indexes (keep rent_schedules_lease_id_idx)
drop index if exists public.idx_rent_schedules_lease_id;

-- units: our later convenience indexes duplicate initial ones
drop index if exists public.idx_units_property_id;
drop index if exists public.idx_units_property_id_unit_number;

-- reconciliation_log: prefer the earlier rl_* names
drop index if exists public.idx_recon_log_buildium_id;
drop index if exists public.idx_recon_log_property_id;

-- owners: duplicate of initial idx_owners_buildium_id
drop index if exists public.idx_owners_buildium_owner_id;

