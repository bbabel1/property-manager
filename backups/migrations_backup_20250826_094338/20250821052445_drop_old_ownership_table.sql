-- Drop the old ownership table after migrating to ownerships table
-- Migration: 20250821052445_drop_old_ownership_table.sql

-- Drop the old ownership table and related triggers/functions
drop trigger if exists trigger_update_owner_name_insert on ownership;
drop trigger if exists trigger_update_owner_name_update on ownership;
drop trigger if exists trigger_update_ownership_owner_name on owners;

drop function if exists update_owner_name();
drop function if exists update_ownership_owner_name();

-- Drop the old ownership table
drop table if exists public.ownership;

-- Clean up any remaining references in documentation
-- Note: This migration assumes all code has been updated to use 'ownerships' table
