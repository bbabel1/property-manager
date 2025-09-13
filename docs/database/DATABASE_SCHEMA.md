# Database Schema Documentation

> **Last Updated**: 2025-09-13T04:22:14.362Z (Auto-generated)

## Overview

This document provides a comprehensive overview of the Supabase database schema for the Ora Property Management system.

## Migration History

### 001_initial_schema.sql
**Description**: No description available

### 002_add_is_active_to_bank_accounts.sql
**Description**: Adds an is_active boolean field to track whether bank accounts are active or inactive

### 003_add_balance_fields_to_bank_accounts.sql
**Description**: Adds balance and buildium_balance numeric fields to track account balances

### 004_add_gl_account_relationship_to_bank_accounts.sql
**Description**: Adds a foreign key relationship from bank_accounts to gl_accounts table

### 005_cleanup_bank_accounts_table.sql
**Description**: Remove check printing and information fields, make key fields non-nullable

### 006_update_gl_accounts_field_mapping.sql
**Description**: No description available

### 007_add_building_name_to_units.sql
**Description**: No description available

### 008_standardize_timestamp_fields.sql
**Description**: Ensures all tables use consistent snake_case naming for created_at and updated_at fields

### 009_update_units_country_to_text.sql
**Description**: Change the country field in the units table from character varying(100) to text type

### 010_create_countries_enum.sql
**Description**: Create a comprehensive countries enum with all world countries

### 011_apply_countries_enum_to_tables.sql
**Description**: Update all country fields to use the standardized countries enum type

### 012_add_buildium_property_id_to_lease.sql
**Description**: Add buildium_property_id field to lease table for direct property reference

### 013_add_buildium_unit_id_to_lease.sql
**Description**: Add buildium_unit_id field to lease table for direct unit reference

### 044_add_vacant_units_count_to_properties.sql
**Description**: Adds a computed column that tracks the count of units with status 'Vacant' for each property

### 045_fix_properties_updated_at_default.sql
**Description**: No description available

### 20250103000000_fix_property_unit_counts.sql
**Description**: No description available

### 20250103000001_remove_vacant_units_count.sql
**Description**: No description available

### 20250826233007_add_sub_accounts_to_gl_accounts.sql
**Description**: Add sub_accounts field as UUID array to store child GL account references

### 20250828032609_add_data_integrity_functions.sql
**Description**: No description available

### 20250828054100_rename_transactions_columns_to_snake_case.sql
**Description**: No description available

### 20250828054110_rename_staff_and_lease_columns_to_snake_case.sql
**Description**: No description available

### 20250828060000_non_destructive_remote_alignment.sql
**Description**: No description available

### 20250828063500_cleanup_timestamp_standardization.sql
**Description**: No description available

### 20250828070000_add_missing_updated_at_triggers.sql
**Description**: No description available

### 20250828070500_staged_country_enum_constraints_and_report.sql
**Description**: No description available

### 20250828073000_normalize_countries_and_convert_to_enum.sql
**Description**: No description available

### 20250828134000_add_buildium_lease_id_to_transactions.sql
**Description**: Adds a nullable integer column `buildium_lease_id` to `public.transactions`

### 20250828143500_add_payment_method_enum_and_alter_transactions.sql
**Description**: Normalizes payment methods and converts column from text to enum, mapping known values and setting unknowns to NULL

### 20250828143600_drop_buildium_journal_id_from_transaction_lines.sql
**Description**: Field no longer needed per requirements

### 20250829010000_gl_journal_entry_and_sync_cursor.sql
**Description**: No description available

### 20250829013000_gl_reporting_views.sql
**Description**: No description available

### 20250829014500_bank_accounts_country_and_indexes.sql
**Description**: No description available

### 20250829021000_bank_account_type_check_constraint.sql
**Description**: No description available

### 20250829024550_add_unit_images_and_notes.sql
**Description**: No description available

### 20250829120000_update_vendors_schema_add_fields_remove_legacy.sql
**Description**: No description available

### 20250829123000_add_expense_gl_account_id_to_vendors.sql
**Description**: No description available

### 20250829124500_update_vendors_category_fields.sql
**Description**: No description available

### 20250829131500_add_vendor_contact_fk.sql
**Description**: No description available

### 20250829133000_require_vendors_contact_id.sql
**Description**: No description available

### 20250829140000_tasks_categories_and_relationships.sql
**Description**: No description available

### 20250829150000_add_appliance_buildium_and_service_history.sql
**Description**: No description available

### 20250829153000_tenants_sms_bool_and_tenant_notes.sql
**Description**: No description available

### 20250829154500_add_property_id_to_appliances.sql
**Description**: No description available

### 20250829180000_bank_accounts_extend_for_buildium.sql
**Description**: No description available

### 20250829181000_update_gl_accounts_field_mapping.sql
**Description**: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

### 20250829190000_owner_indexes.sql
**Description**: No description available

### 20250829190500_add_lease_notes_and_recurring.sql
**Description**: No description available

### 20250902090000_add_indexes_for_lease_transactions.sql
**Description**: No description available

### 20250904180100_add_more_unit_counts_to_properties.sql
**Description**: No description available

### 20250904_add_total_vacant_units_to_properties.sql
**Description**: Adds total_vacant_units integer column and reuses the existing

### 20250905010000_remove_vacant_units_count_and_add_occupancy_rate.sql
**Description**: No description available

### 20250905011000_remove_vacant_units_count.sql
**Description**: No description available

### 20250905013000_drop_square_footage_from_units.sql
**Description**: No description available

### 20250906000000_create_property_staff.sql
**Description**: No description available

### 20250906001000_add_location_fields_to_properties.sql
**Description**: No description available

### 20250906002000_add_property_type_enum_and_convert.sql
**Description**: No description available

### 20250906003000_drop_rental_sub_type.sql
**Description**: No description available

### 20250907091500_add_management_and_fee_fields_to_properties.sql
**Description**: No description available

### 20250907093000_convert_service_assignment_enum.sql
**Description**: No description available

### 20250907095500_rename_included_services_to_active_services.sql
**Description**: No description available

### 20250907113000_staff_roles_enum_and_convert.sql
**Description**: No description available

### 20250911090000_integrity_enforcements.sql
**Description**: No description available

### 20250911133000_rbac_and_tenancy.sql
**Description**: No description available

### 20250911140900_jwt_custom_claims.sql
**Description**: No description available

### 20250911141000_extend_rls_and_portals.sql
**Description**: No description available

### 20250911143000_org_integrity_and_storage_fix.sql
**Description**: No description available

### 20250911150000_backfill_org_ids_and_constraints.sql
**Description**: No description available

### 20250912120000_dashboard_kpis.sql
**Description**: No description available

### 20250912163000_property_financials.sql
**Description**: No description available

### 20250912180010_users_profiles_contacts_views.sql
**Description**: No description available

### 20250912_add_security_deposit_flag.sql
**Description**: No description available

### 20250912_get_property_financials_use_finished.sql
**Description**: No description available

### 20250912_gl_account_activity.sql
**Description**: No description available

### 20250912_latest_reconciliation_view.sql
**Description**: No description available

### 20250912_reconciliation_alerts.sql
**Description**: No description available

### 20250912_reconciliation_log_buildium.sql
**Description**: No description available

### 20250912_reconciliation_unique_idx.sql
**Description**: No description available

### 20250912_reconciliation_variance.sql
**Description**: No description available

### 20250912_replace_get_property_financials.sql
**Description**: No description available

### 20250913_additional_perf_indexes.sql
**Description**: No description available

### 20250913_performance_indexes.sql
**Description**: No description available

### 20250914000000_property_staff_role_index.sql
**Description**: No description available


## Current Schema Status

- **Total Migrations**: 82
- **Database Provider**: PostgreSQL via Supabase
- **ORM**: Direct Supabase client operations
- **Security**: Row Level Security (RLS) enabled on all tables

## Core Tables

### Properties
- **Purpose**: Central property information
- **Relationships**: One-to-many with units, many-to-many with owners
- **Key Features**: International address support, Buildium integration

### Owners  
- **Purpose**: Property owners (individuals and companies)
- **Relationships**: Many-to-many with properties via ownership table
- **Key Features**: Tax information, separate business and personal details

### Ownership
- **Purpose**: Property-owner relationships with percentages
- **Key Features**: Ownership vs disbursement percentages, primary owner designation

### Units
- **Purpose**: Individual rental units within properties
- **Key Features**: Bedroom/bathroom classification, market rent tracking

### Bank Accounts
- **Purpose**: Financial account management
- **Key Features**: Check printing, account types, integration with properties

For detailed schema information, see the individual migration files in `supabase/migrations/`.
