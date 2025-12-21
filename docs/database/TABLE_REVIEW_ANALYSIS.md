# Database Table Review Analysis

**Date**: 2025-01-31  
**Total Base Tables**: 90  
**Total Views**: 25

## Summary of Findings

### ✅ Tables to Keep (Core Business Logic)

#### Property Management Core

- `properties`, `buildings`, `units` - Core property data
- `owners`, `ownerships` - Property ownership
- `lease`, `lease_contacts`, `lease_recurring_transactions`, `rent_schedules` - Lease management
- `tenants`, `contacts` - People management
- `vendors`, `vendor_categories` - Vendor management
- `tasks`, `task_categories`, `task_history` - Task/work order management
- `work_orders` - Work order tracking

#### Financial Core

- `gl_accounts`, `gl_account_category`, `gl_import_cursors` - General ledger
- `transactions`, `transaction_lines`, `transaction_type_sign` - Transaction tracking
- `journal_entries` - Journal entries
- `reconciliation_log` - Bank reconciliation
- `billing_events` - Billing events
- `monthly_logs`, `monthly_log_task_rules` - Monthly statement generation

#### Service Management

- `service_plans`, `service_plan_assignments`, `service_plan_services` - Service plan management
- `service_offerings`, `service_offering_assignments` - Service offerings
- `service_automation_rules`, `service_fee_history` - Service automation

#### RBAC (New System)

- `organizations`, `org_memberships` - Organization management
- `roles`, `role_permissions`, `membership_roles`, `permissions` - RBAC system
- `profiles` - User profiles

#### Files & Media

- `files`, `file_categories` - File management
- `property_images`, `unit_images` - Image storage

#### Compliance & Permits

- `compliance_programs`, `compliance_program_templates` - Compliance programs
- `compliance_assets`, `compliance_items`, `compliance_item_work_orders` - Compliance tracking
- `compliance_events`, `compliance_violations` - Compliance events
- `compliance_property_program_overrides` - Property-specific overrides
- `building_permits`, `building_permit_units` - NYC building permits
- `nyc_open_data_integrations` - NYC Open Data integration

#### Integrations

- `buildium_integrations` - Buildium integration config
- `gmail_integrations`, `google_calendar_integrations` - Google integrations
- `email_templates`, `statement_emails` - Email management
- `idempotency_keys` - API idempotency

#### Property Management

- `property_staff`, `staff` - Staff management
- `property_automation_overrides`, `property_onboarding`, `property_onboarding_tasks` - Property setup
- `property_notes`, `unit_notes`, `lease_notes`, `tenant_notes` - Notes

#### Appliances

- `appliances`, `device_type_normalization` - Appliance tracking
- `appliance_service_history` - Appliance service history

#### Sync & Audit

- `buildium_webhook_events`, `webhook_event_flags` - Webhook processing
- `buildium_sync_status`, `buildium_sync_runs` - Buildium sync tracking
- `buildium_api_log`, `buildium_integration_audit_log` - API logging
- `external_sync_state` - External sync state (compliance, etc.)
- `sync_operations` - General sync operations
- `data_sources` - Data source tracking

---

## ⚠️ Tables to Consider for Removal

### 1. Cache Tables (Low Usage)

#### `buildium_api_cache` (0 rows, 48 kB)

- **Purpose**: Cache Buildium API responses
- **Usage**: Only referenced in types, not actively used in code
- **Recommendation**: **REMOVE** - Not being used, 0 rows
- **Risk**: Low - can be recreated if needed

#### `owners_list_cache` (6 rows, 80 kB)

- **Purpose**: Cache owner lists for performance
- **Usage**: Not found in active code (only in types)
- **Recommendation**: **CONSIDER REMOVING** - Appears unused
- **Risk**: Low - data can be regenerated from `owners` + `ownerships`
- **Note**: Excluded from public_id rollout due to issues

#### `property_ownerships_cache` (18 rows, 96 kB)

- **Purpose**: Cache property-owner relationships
- **Usage**: Used as fallback in `property-service.ts` when ownerships table is empty
- **Recommendation**: **KEEP FOR NOW** - Has active fallback logic
- **Risk**: Medium - used as safety net for cache drift
- **Alternative**: Could be removed if we ensure ownerships table is always populated

### 2. Potentially Redundant Sync Tables

#### `buildium_sync_status` vs `buildium_sync_runs`

- **`buildium_sync_status`** (176 kB): Per-entity sync status
- **`buildium_sync_runs`** (40 kB): Overall sync run tracking
- **Usage**: Both actively used in `buildium-sync.ts`
- **Recommendation**: **KEEP BOTH** - Serve different purposes (entity-level vs run-level)

#### `sync_operations` vs `buildium_sync_status`

- **`sync_operations`** (56 kB): General sync operations with retry logic
- **`buildium_sync_status`**: Buildium-specific sync status
- **Usage**: `sync_operations` used in `sync-error-recovery.ts`
- **Recommendation**: **KEEP BOTH** - Different scopes (general vs Buildium-specific)

#### `external_sync_state` (112 kB)

- **Purpose**: Track external sync state (compliance, NYC data)
- **Usage**: Actively used in `compliance-sync-service.ts` (12 references)
- **Recommendation**: **KEEP** - Active compliance sync tracking

### 3. Audit/Log Tables (Consider Archival Strategy)

#### `buildium_api_log` (24 kB)

- **Purpose**: Log all Buildium API requests
- **Usage**: Not actively queried in application code
- **Recommendation**: **KEEP** but implement archival/rotation
- **Risk**: Low - useful for debugging but could grow large
- **Action**: Add data retention policy (e.g., keep 90 days)

#### `buildium_integration_audit_log` (112 kB)

- **Purpose**: Audit Buildium integration operations
- **Usage**: Not actively queried in application code
- **Recommendation**: **KEEP** but implement archival/rotation
- **Risk**: Low - useful for audit trail
- **Action**: Add data retention policy

#### `buildium_webhook_events` (312 kB)

- **Purpose**: Store webhook events from Buildium
- **Usage**: Actively used for webhook processing
- **Recommendation**: **KEEP** but implement archival/rotation
- **Risk**: Medium - needed for webhook processing
- **Action**: Archive processed events older than 30 days

### 4. Unused/Rarely Used Tables

#### `appliance_service_history` (40 kB, 0 references in code)

- **Purpose**: Track appliance service history
- **Usage**: Only in types, no active code references
- **Recommendation**: **CONSIDER REMOVING** if not used
- **Risk**: Low - can be recreated if needed
- **Alternative**: Could be replaced by `task_history` or `work_orders`

#### `inspections` (24 kB)

- **Purpose**: Property inspections
- **Usage**: Not found in active code
- **Recommendation**: **CONSIDER REMOVING** if not actively used
- **Risk**: Low - can be recreated if needed

---

## 📊 Recommendations Summary

### Immediate Actions (Low Risk)

1. **DROP `buildium_api_cache`** - 0 rows, not used

   ```sql
   DROP TABLE IF EXISTS public.buildium_api_cache CASCADE;
   ```

2. **DROP `owners_list_cache`** - Appears unused, excluded from public_id rollout

   ```sql
   DROP TABLE IF EXISTS public.owners_list_cache CASCADE;
   ```

3. **INVESTIGATE `appliance_service_history`** - No code references
   - Check if this is used in any external processes
   - If not, drop it

4. **INVESTIGATE `inspections`** - No code references
   - Check if this is used in any external processes
   - If not, drop it

### Medium-Term Actions

5. **Implement data retention policies** for audit/log tables:
   - `buildium_api_log`: Keep 90 days
   - `buildium_integration_audit_log`: Keep 90 days
   - `buildium_webhook_events`: Archive processed events > 30 days old

6. **Consider removing `property_ownerships_cache`** after ensuring:
   - Ownerships table is always properly populated
   - Remove fallback logic in `property-service.ts`
   - Test thoroughly before removal

### Keep (Active Use)

- All core business tables (properties, units, leases, etc.)
- All financial tables (transactions, gl_accounts, etc.)
- All RBAC tables (roles, permissions, membership_roles)
- All compliance tables (actively used)
- All integration tables (buildium_integrations, gmail_integrations, etc.)
- `sync_operations`, `buildium_sync_status`, `buildium_sync_runs` (all serve different purposes)
- `external_sync_state` (active compliance sync)

---

## 🎯 Proposed Cleanup Migration

```sql
-- Remove unused cache and tracking tables
BEGIN;

-- 1. Drop unused API cache (0 rows, not referenced)
DROP TABLE IF EXISTS public.buildium_api_cache CASCADE;

-- 2. Drop unused owners list cache (excluded from public_id, not actively used)
DROP TABLE IF EXISTS public.owners_list_cache CASCADE;

-- 3. Check and potentially drop appliance_service_history if confirmed unused
-- DROP TABLE IF EXISTS public.appliance_service_history CASCADE;

-- 4. Check and potentially drop inspections if confirmed unused
-- DROP TABLE IF EXISTS public.inspections CASCADE;

COMMIT;
```

**Estimated space savings**: ~200 kB (minimal, but reduces complexity)

**Risk level**: Low - these tables are not actively used in the application

---

## 📝 Notes

- Most tables serve active purposes and should be retained
- The database is well-organized with clear separation of concerns
- Main opportunity for cleanup is in unused cache tables and implementing data retention policies for audit logs
- Before dropping any table, verify it's not used in:
  - Supabase Edge Functions
  - External scripts
  - Scheduled jobs
  - Third-party integrations
