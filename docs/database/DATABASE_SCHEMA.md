# Database Schema Documentation

> **Last Updated**: 2025-10-08T02:51:22.245Z (Auto-generated)

## Overview

This document provides a comprehensive overview of the Supabase database schema for the Ora Property Management system.

## Migration History

### 20240101000001_001_initial_schema.sql

**Description**: No description available

### 20240101000002_002_add_is_active_to_bank_accounts.sql

**Description**: Adds an is_active boolean field to track whether bank accounts are active or inactive

### 20240101000003_003_add_balance_fields_to_bank_accounts.sql

**Description**: Adds balance and buildium_balance numeric fields to track account balances

### 20240101000004_004_add_gl_account_relationship_to_bank_accounts.sql

**Description**: Adds a foreign key relationship from bank_accounts to gl_accounts table

### 20240101000005_005_cleanup_bank_accounts_table.sql

**Description**: Remove check printing and information fields, make key fields non-nullable

### 20240101000006_006_update_gl_accounts_field_mapping.sql

**Description**: No description available

### 20240101000007_007_add_building_name_to_units.sql

**Description**: No description available

### 20240101000008_008_standardize_timestamp_fields.sql

**Description**: Ensures all tables use consistent snake_case naming for created_at and updated_at fields

### 20240101000009_009_update_units_country_to_text.sql

**Description**: Change the country field in the units table from character varying(100) to text type

### 20240101000010_010_create_countries_enum.sql

**Description**: Create a comprehensive countries enum with all world countries

### 20240101000011_011_apply_countries_enum_to_tables.sql

**Description**: Update all country fields to use the standardized countries enum type

### 20240101000012_012_add_buildium_property_id_to_lease.sql

**Description**: Add buildium_property_id field to lease table for direct property reference

### 20240101000013_013_add_buildium_unit_id_to_lease.sql

**Description**: Add buildium_unit_id field to lease table for direct unit reference

### 20240101000044_014_add_vacant_units_count_to_properties.sql

**Description**: Adds a computed column that tracks the count of units with status 'Vacant' for each property

### 20240101000045_015_fix_properties_updated_at_default.sql

**Description**: No description available

### 20250103000000_016_fix_property_unit_counts.sql

**Description**: No description available

### 20250103000001_017_remove_vacant_units_count.sql

**Description**: No description available

### 20250301090000_allow_nullable_buildium_image_id_on_unit_images.sql

**Description**: No description available

### 20250301093000_add_unique_constraint_buildium_sync_status.sql

**Description**: No description available

### 20250826233007_018_add_sub_accounts_to_gl_accounts.sql

**Description**: Add sub_accounts field as UUID array to store child GL account references

### 20250828032609_019_add_data_integrity_functions.sql

**Description**: No description available

### 20250828054100_020_rename_transactions_columns_to_snake_case.sql

**Description**: No description available

### 20250828054110_021_rename_staff_and_lease_columns_to_snake_case.sql

**Description**: No description available

### 20250828060000_022_non_destructive_remote_alignment.sql

**Description**: No description available

### 20250828063500_023_cleanup_timestamp_standardization.sql

**Description**: No description available

### 20250828070000_024_add_missing_updated_at_triggers.sql

**Description**: No description available

### 20250828070500_025_staged_country_enum_constraints_and_report.sql

**Description**: No description available

### 20250828073000_026_normalize_countries_and_convert_to_enum.sql

**Description**: No description available

### 20250828134000_027_add_buildium_lease_id_to_transactions.sql

**Description**: Adds a nullable integer column `buildium_lease_id` to `public.transactions`

### 20250828143500_028_add_payment_method_enum_and_alter_transactions.sql

**Description**: Normalizes payment methods and converts column from text to enum, mapping known values and setting unknowns to NULL

### 20250828143600_029_drop_buildium_journal_id_from_transaction_lines.sql

**Description**: Field no longer needed per requirements

### 20250829010000_030_gl_journal_entry_and_sync_cursor.sql

**Description**: No description available

### 20250829013000_031_gl_reporting_views.sql

**Description**: No description available

### 20250829014500_032_bank_accounts_country_and_indexes.sql

**Description**: No description available

### 20250829021000_033_bank_account_type_check_constraint.sql

**Description**: No description available

### 20250829024550_034_add_unit_images_and_notes.sql

**Description**: No description available

### 20250829120000_035_update_vendors_schema_add_fields_remove_legacy.sql

**Description**: No description available

### 20250829123000_036_add_expense_gl_account_id_to_vendors.sql

**Description**: No description available

### 20250829124500_037_update_vendors_category_fields.sql

**Description**: No description available

### 20250829131500_038_add_vendor_contact_fk.sql

**Description**: No description available

### 20250829133000_039_require_vendors_contact_id.sql

**Description**: No description available

### 20250829140000_040_tasks_categories_and_relationships.sql

**Description**: No description available

### 20250829150000_041_add_appliance_buildium_and_service_history.sql

**Description**: No description available

### 20250829153000_042_tenants_sms_bool_and_tenant_notes.sql

**Description**: No description available

### 20250829180000_043_bank_accounts_extend_for_buildium.sql

**Description**: No description available

### 20250829181000_044_update_gl_accounts_field_mapping.sql

**Description**: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

### 20250829190000_045_owner_indexes.sql

**Description**: No description available

### 20250829190500_046_add_lease_notes_and_recurring.sql

**Description**: No description available

### 20250902090000_047_add_indexes_for_lease_transactions.sql

**Description**: No description available

### 20250904000000_048_add_total_vacant_units_to_properties.sql

**Description**: Adds total_vacant_units integer column and reuses the existing

### 20250904180100_049_add_more_unit_counts_to_properties.sql

**Description**: No description available

### 20250905010000_050_remove_vacant_units_count_and_add_occupancy_rate.sql

**Description**: No description available

### 20250905011000_051_remove_vacant_units_count.sql

**Description**: No description available

### 20250905013000_052_drop_square_footage_from_units.sql

**Description**: No description available

### 20250906000000_053_create_property_staff.sql

**Description**: No description available

### 20250906001000_054_add_location_fields_to_properties.sql

**Description**: No description available

### 20250906002000_055_add_property_type_enum_and_convert.sql

**Description**: No description available

### 20250906003000_056_drop_rental_sub_type.sql

**Description**: No description available

### 20250907091500_057_add_management_and_fee_fields_to_properties.sql

**Description**: No description available

### 20250907093000_058_convert_service_assignment_enum.sql

**Description**: No description available

### 20250907095500_059_rename_included_services_to_active_services.sql

**Description**: No description available

### 20250907113000_060_staff_roles_enum_and_convert.sql

**Description**: No description available

### 20250911090000_061_integrity_enforcements.sql

**Description**: No description available

### 20250911133000_062_rbac_and_tenancy.sql

**Description**: No description available

### 20250911140000_063_create_organizations_table.sql

**Description**: No description available

### 20260806103000_extend_organizations_profile.sql

**Description**: Adds company/contact/address/accounting fields to `organizations` plus defaults and name sync trigger.

### 20250911140900_100_jwt_custom_claims.sql

**Description**: No description available

### 20250911141000_064_extend_rls_and_portals.sql

**Description**: No description available

### 20250911143000_065_org_integrity_and_storage_fix.sql

**Description**: No description available

### 20250911150000_066_backfill_org_ids_and_constraints.sql

**Description**: No description available

### 20250912000000_068_add_security_deposit_flag.sql

**Description**: No description available

### 20250912000001_069_reconciliation_log_buildium.sql

**Description**: No description available

### 20250912000002_070_gl_account_activity.sql

**Description**: No description available

### 20250912000003_071_latest_reconciliation_view.sql

**Description**: No description available

### 20250912000004_072_reconciliation_unique_idx.sql

**Description**: No description available

### 20250912000005_073_reconciliation_variance.sql

**Description**: No description available

### 20250912000006_074_get_property_financials_use_finished.sql

**Description**: No description available

### 20250912000007_075_reconciliation_alerts.sql

**Description**: No description available

### 20250912000008_076_replace_get_property_financials.sql

**Description**: No description available

### 20250912120000_067_dashboard_kpis.sql

**Description**: No description available

### 20250912163000_101_property_financials.sql

**Description**: No description available

### 20250912180010_102_users_profiles_contacts_views.sql

**Description**: No description available

### 20250913000000_077_additional_perf_indexes.sql

**Description**: No description available

### 20250913000001_078_performance_indexes.sql

**Description**: No description available

### 20250914000000_103_property_staff_role_index.sql

**Description**: No description available

### 20250914000001_079_property_images.sql

**Description**: No description available

### 20250915000000_080_staff_profile_enum_and_links.sql

**Description**: No description available

### 20250915000001_081_staff_columns_only.sql

**Description**: No description available

### 20250915000002_082_convert_roles_to_enum.sql

**Description**: No description available

### 20250915000003_083_buildium_sync_runs.sql

**Description**: No description available

### 20250916090000_084_rls_performance_fixes.sql

**Description**: No description available

### 20250916093000_085_drop_duplicate_indexes.sql

**Description**: No description available

### 20250916102000_086_rls_policy_cleanup.sql

**Description**: No description available

### 20250917000000_087_fix_auth_rls_initialization_plan.sql

**Description**: No description available

### 20250917010000_088_comprehensive_auth_rls_fix.sql

**Description**: No description available

### 20250917020000_089_fix_permissive_policies_and_duplicate_indexes.sql

**Description**: No description available

### 20250917030000_090_cleanup_remaining_duplicate_indexes.sql

**Description**: No description available

### 20250917040000_091_fix_remaining_auth_rls_initialization_plan.sql

**Description**: No description available

### 20250917050000_092_fix_all_permissive_policies.sql

**Description**: No description available

### 20251109090000_add_payment_terms_days_to_vendors.sql

**Description**: Add payment_terms_days column to vendors to capture default bill term length in days

### 20250917060000_093_consolidate_overlapping_permissive_policies.sql

**Description**: No description available

### 20250917070000_094_add_missing_foreign_key_indexes.sql

**Description**: No description available

### 20250917080000_095_remove_unused_indexes.sql

**Description**: No description available

### 20250917090000_096_restore_necessary_foreign_key_indexes.sql

**Description**: No description available

### 20250917100000_097_remove_additional_unused_indexes.sql

**Description**: No description available

### 20250917110000_098_add_missing_inspections_unit_id_index.sql

**Description**: No description available

### 20250917120000_099_optimize_query_performance.sql

**Description**: No description available

### 20250917130000_104_additional_query_optimizations.sql

**Description**: No description available

### 20250919000000_105_add_onetime_to_rent_cycle_enum.sql

**Description**: Adds 'OneTime' value to rent_cycle_enum to support one-off lease templates

### 20250919000001_106_constraints_and_indexes.sql

**Description**: Adds various constraints and indexes for data integrity and performance

### 20250919000002_107_idempotency_enhancements.sql

**Description**: Adds idempotency checks and error handling to prevent duplicate operations

### 20250919000003_108_update_fn_create_lease_aggregate_bigint_and_lock.sql

**Description**: Updates fn_create_lease_aggregate to handle bigint IDs and add row locking

### 20250919000004_109_webhook_events_unique.sql

**Description**: Prevents duplicate webhook events from being processed

### 20250919093000_110_sync_tables_org_rls_and_grants.sql

**Description**: No description available

### 20250924000000_111_fix_org_memberships_infinite_recursion.sql

**Description**: No description available

### 20250924000001_112_fix_all_recursive_policies.sql

**Description**: No description available

### 20250924000002_113_fix_rls_policies_for_updates.sql

**Description**: No description available

### 20250924000003_114_fix_rls_policies_comprehensive.sql

**Description**: No description available

### 20250924000004_115_add_property_images_rls.sql

**Description**: No description available

### 20250924010000_115_restore_secure_rls.sql

**Description**: No description available

### 20250925000005_fix_lease_tenant_org_and_people.sql

**Description**: No description available

### 20250925020000_add_status_to_rent_schedules.sql

**Description**: Creates rent_schedule_status enum and adds status column to rent_schedules

### 20250925031500_update_transaction_type_enum.sql

**Description**: No description available

### 20250926000005_add_receipt_flags_to_transactions.sql

**Description**: No description available

### 20251008120000_001_files_unified_schema.sql

**Description**: No description available

### 20251008121000_002_files_backfill.sql

**Description**: No description available

### 20251008123000_003_files_lease_documents_trigger.sql

**Description**: No description available

### 20251103000000_143_consolidate_file_storage.sql

**Description**: Consolidates file storage into simplified schema with direct entity association. Creates `file_categories` table for Buildium category sync and new `files` table with entity_type/entity_id pattern (replaces file_links polymorphic association). Adds entity_type_enum for Buildium file entity types.

### 20251202020000_add_files_category_fk.sql

**Description**: Adds `category` column (uuid) to `files` table as a foreign key to `file_categories.id` for
database-level referential integrity. This complements the existing `buildium_category_id` field which is used
for Buildium synchronization.

### 20251008124500_004_drop_legacy_file_tables.sql

**Description**: No description available

### 20251008130000_005_unify_lease_documents_and_fn.sql

**Description**: No description available

## Current Schema Status

- **Total Migrations**: 127
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

### Files and File Categories

- **file_categories**: Buildium file categories synced per organization
  - Links category names to Buildium category IDs
  - Supports active/inactive state
  - Scoped by org_id
- **files**: Unified file storage with direct entity association
  - **Key Change**: Replaces polymorphic `file_links` table with direct `entity_type` + `entity_id` pattern
  - **Entity Types**: Uses `entity_type_enum` (Account, Association, Lease, Rental, Tenant, Vendor, etc.)
  - **Entity IDs**: Stores Buildium entity IDs directly (not local UUIDs)
  - **Association**: Files are directly linked via `entity_type` and `entity_id` columns
  - **Categories**:
    - `category` (uuid): Foreign key to `file_categories.id` for database-level referential integrity
    - `buildium_category_id` (integer): Buildium category ID for synchronization (application-level validation)
  - **Storage**: Supports Supabase, S3, Buildium, and external storage providers
  - **Buildium Sync**: Tracks `buildium_file_id` and `buildium_href` for synced files

**Migration Note**: The old `file_links` table and related views (`task_history_files`, `work_order_files`) were dropped. All file associations now use the direct entity_type/entity_id pattern.

### Email Templates

**Table**: `email_templates`

**Purpose**: Centralized email template management system for organizations with dynamic variable substitution support.

**Schema**:

- `id` (uuid, PK): Primary key
- `org_id` (uuid, FK → organizations.id): Organization scope
- `template_key` (text): Unique template identifier (e.g., 'monthly_rental_statement')
- `name` (text, max 255): Display name
- `description` (text, max 1000, nullable): Template description
- `subject_template` (text, max 500): Email subject with {{variable}} placeholders
- `body_html_template` (text, max 50000): HTML email body with {{variable}} placeholders
- `body_text_template` (text, max 50000, nullable): Plain text email body
- `available_variables` (jsonb): Array of variable definitions with metadata
- `status` (text): Template status ('active', 'inactive', 'archived')
- `created_at` (timestamptz): Creation timestamp
- `updated_at` (timestamptz): Last update timestamp (auto-updated via trigger)
- `created_by_user_id` (uuid, FK → auth.users.id): User who created (auto-set via trigger)
- `updated_by_user_id` (uuid, FK → auth.users.id): User who last updated (auto-set via trigger)

**Constraints**:

- `UNIQUE(org_id, template_key)`: One template per key per organization
- `CHECK (template_key IN ('monthly_rental_statement'))`: Enum enforcement
- `CHECK (char_length(subject_template) <= 500)`: Subject length limit
- `CHECK (char_length(body_html_template) <= 50000)`: HTML body length limit
- `CHECK (body_text_template IS NULL OR char_length(body_text_template) <= 50000)`: Text body length limit

**Indexes**:

- `idx_email_templates_org_id`: On `org_id` for org-scoped queries
- `idx_email_templates_org_key`: On `(org_id, template_key)` for unique lookups
- `idx_email_templates_org_key_active`: Partial index on `(org_id, template_key) WHERE status = 'active'` for fast active template lookup
- `idx_email_templates_status`: Partial index on `(org_id, status) WHERE status = 'active'` for filtering

**Triggers**:

- `trg_email_templates_updated_at`: Auto-updates `updated_at` on UPDATE
- `trg_email_templates_created_by`: Auto-sets `created_by_user_id` from `auth.uid()` on INSERT (prevents spoofing)
- `trg_email_templates_updated_by`: Auto-sets `updated_by_user_id` from `auth.uid()` on UPDATE (prevents spoofing)
- `trg_email_templates_prevent_key_change`: Prevents `template_key` changes after creation

**RLS Policies**:

- `email_templates_select_org_members`: SELECT - Users with org membership can read templates for their orgs
- `email_templates_insert_admins`: INSERT - Only org_admin/org_manager can create
- `email_templates_update_admins`: UPDATE - Only org_admin/org_manager can update
- `email_templates_delete_admins`: DELETE - Only org_admin/org_manager can delete (soft delete via status = 'archived')

**Migrations**:

- `20251207190927_create_email_templates_table.sql`: Creates table, indexes, constraints, triggers, and RLS policies
- `20251207190928_seed_default_email_templates.sql`: Seeds default Monthly Rental Statement template for all existing organizations

For detailed schema information, see the individual migration files in `supabase/migrations/`.
