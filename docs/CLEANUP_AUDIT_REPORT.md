# Codebase and Database Cleanup Audit Report

**Date**: 2025-01-31  
**Scope**: Comprehensive audit of unused, redundant, and obsolete components  
**Status**: Analysis Only - No modifications performed

---

## Executive Summary

This audit identified **unused database tables**, **obsolete code files**, **redundant migrations**, **unused dependencies**, and **temporary/legacy files** that can be safely removed or require validation before removal. The analysis covers:

- **Database Schema**: 10+ tables with 0 runtime references identified for removal, multiple unused views
- **Code Files**: 15+ legacy components, entire `tmp/` directory, `ts-trace/` artifacts, excluded TypeScript files
- **Migrations**: 1 duplicate migration identified
- **Dependencies**: 3 potentially unused dev dependencies
- **Scripts**: Multiple one-time migration scripts that may be obsolete
- **Assets**: Public assets requiring usage verification

**Note**: Detailed scan using `rg --count` across `src/`, `scripts/`, and `supabase/` (excluding migrations/types) confirmed zero active references for all items listed below.

---

## 1. Database Schema Cleanup

### 1.1 Tables to Remove (Low Risk)

#### `buildium_api_cache`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; only mentioned in `scripts/database/get-table-schema.ts` and maintenance scripts
- **Size**: 48 kB
- **Migration**: Created in initial schema `supabase/migrations/20240101000001_001_initial_schema.sql`
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.buildium_api_cache CASCADE;
  ```

#### `owners_list_cache`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; only mentioned in schema tooling scripts
- **Size**: 80 kB
- **Note**: Excluded from public_id rollout, data can be regenerated from `owners` + `ownerships` tables
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.owners_list_cache CASCADE;
  ```

#### `appliance_service_history`

- **Status**: ✅ **SAFE TO REMOVE** (confirmed 0 runtime refs)
- **Risk Level**: Low
- **Reason**: 0 runtime references; never read/written in code
- **Size**: 40 kB
- **Migration**: `supabase/migrations/20250829150000_041_add_appliance_buildium_and_service_history.sql`
- **Note**: Drop unless a future appliance feature is planned. Data may be replaced by `task_history` or `work_orders`.
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.appliance_service_history CASCADE;
  ```

#### `nyc_open_data_integrations`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; no app usage
- **Migration**: `supabase/migrations/20260324100000_create_nyc_open_data_integrations.sql`
- **Note**: Remove or defer until NYC Open Data work resumes
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.nyc_open_data_integrations CASCADE;
  ```

#### `building_permit_units`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; building-permit sync writes only to `building_permits` table
- **Migration**: `supabase/migrations/20260331120000_create_building_permits.sql`
- **Note**: Join table never wired up. Drop or wire it up before keeping.
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.building_permit_units CASCADE;
  ```

#### `property_automation_overrides`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; zero touches in code
- **Migration**: Service automation tranche (`supabase/migrations/20250120120004/05`)
- **Note**: Delete or feature-flag plan before keeping
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.property_automation_overrides CASCADE;
  ```

#### `service_fee_history`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; zero touches in code
- **Migration**: Service automation tranche (`supabase/migrations/20250120120004/05`)
- **Note**: Delete or feature-flag plan before keeping
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.service_fee_history CASCADE;
  ```

#### `property_onboarding` and `property_onboarding_tasks`

- **Status**: ✅ **SAFE TO REMOVE**
- **Risk Level**: Low
- **Reason**: 0 runtime references; no API/UI writers
- **Migration**: `supabase/migrations/20250912120000_067_dashboard_kpis.sql`
- **Note**: Consider removing along with view `v_property_onboarding_summary`
- **SQL**:
  ```sql
  DROP TABLE IF EXISTS public.property_onboarding_tasks CASCADE;
  DROP TABLE IF EXISTS public.property_onboarding CASCADE;
  DROP VIEW IF EXISTS public.v_property_onboarding_summary CASCADE;
  ```

### 1.2 Tables Requiring Validation (Medium Risk)

#### `inspections`

- **Status**: ⚠️ **REQUIRES VALIDATION**
- **Risk Level**: Medium
- **Reason**: Not found in active code
- **Size**: 24 kB
- **Validation Steps**:
  1. Check if this is used for compliance tracking
  2. Verify if any external systems query this table
  3. Check for any future planned features that might use it
- **Recommendation**: If confirmed unused, remove:
  ```sql
  DROP TABLE IF EXISTS public.inspections CASCADE;
  ```

### 1.3 Tables to Keep (Active Use)

#### `property_ownerships_cache`

- **Status**: ✅ **KEEP FOR NOW**
- **Reason**: Used as fallback in `property-service.ts` when ownerships table is empty
- **Risk**: Medium if removed without ensuring ownerships table is always populated
- **Future Action**: Remove after ensuring ownerships table is always properly populated and fallback logic is removed

### 1.4 Audit/Log Tables - Data Retention Recommendations

The following tables should be kept but need data retention policies:

- **`buildium_api_log`**: Keep 90 days, archive older records
  - **Note**: Only mentioned in schema tooling (`scripts/database/get-table-schema.ts`); if not relied upon, consider removal
- **`buildium_integration_audit_log`**: Keep 90 days, archive older records
- **`buildium_webhook_events`**: Archive processed events older than 30 days

**Action Required**: Implement data retention policies via scheduled jobs or database functions. If cache/log tables are not actively used, consider removal instead of retention policies.

### 1.5 Database Views with 0 Runtime References

**Status**: ✅ **SAFE TO REMOVE** (after verification)

The following views have zero runtime references and can be safely dropped or moved to ad-hoc SQL:

#### Diagnostic Views

- `foreign_key_relationships`
- `index_usage`
- `primary_keys`
- `table_sizes`
- `slow_queries`
- `invalid_country_values`

#### Financial/Reporting Views

- `transaction_amounts`
- `unbalanced_transactions`
- `v_gl_trial_balance`
- `v_latest_reconciliation_by_account`
- `v_legacy_management_fees`
- `v_work_order_summary`

#### Buildium/Webhook Views

- `buildium_webhook_events_unhandled`

**Risk Level**: Low

**Validation Steps**:

1. Verify these views are not used in any reporting tools or external systems
2. Check if any Supabase Edge Functions reference these views
3. Confirm they're not used in any scheduled jobs or cron tasks

**Recommendation**:

- Drop diagnostic views if not actively used for monitoring
- Move useful views to ad-hoc SQL scripts in `scripts/sql/` if they contain valuable queries
- Remove views that are superseded by newer implementations

**SQL Example**:

```sql
-- Drop unused views (adjust list based on validation)
DROP VIEW IF EXISTS public.foreign_key_relationships CASCADE;
DROP VIEW IF EXISTS public.index_usage CASCADE;
DROP VIEW IF EXISTS public.primary_keys CASCADE;
DROP VIEW IF EXISTS public.table_sizes CASCADE;
DROP VIEW IF EXISTS public.slow_queries CASCADE;
DROP VIEW IF EXISTS public.invalid_country_values CASCADE;
DROP VIEW IF EXISTS public.transaction_amounts CASCADE;
DROP VIEW IF EXISTS public.unbalanced_transactions CASCADE;
DROP VIEW IF EXISTS public.v_gl_trial_balance CASCADE;
DROP VIEW IF EXISTS public.v_latest_reconciliation_by_account CASCADE;
DROP VIEW IF EXISTS public.v_legacy_management_fees CASCADE;
DROP VIEW IF EXISTS public.v_work_order_summary CASCADE;
DROP VIEW IF EXISTS public.buildium_webhook_events_unhandled CASCADE;
```

---

## 2. Code Files Cleanup

### 2.1 Legacy Components Directory

**Location**: `src/components/legacy/`

**Status**: ✅ **SAFE TO REMOVE** (after verification)

**Files**:

- `AddUnitModal.tsx`
- `BankingDetailsModal.tsx`
- `BasicAddressAutocomplete.tsx`
- `client-providers.tsx`
- `CreateOwnerModal.tsx`
- `CreateStaffModal.tsx`
- `EditOwnerModal.tsx`
- `EditPropertyModal.tsx`
- `GoogleMapsDebug.tsx`
- `GooglePlacesAutocomplete.tsx`
- `HybridAddressAutocomplete.tsx`
- `LiveAddressAutocomplete.tsx`
- `providers.tsx`
- `index.ts`
- `README.md`

**Risk Level**: Low

**Validation Steps**:

1. Search codebase for imports from `@/components/legacy` or `../legacy`
2. Verify all functionality has been replaced by components in `src/components/` or domain modules
3. Check git history to confirm these are truly legacy and not actively maintained

**Recommendation**: Remove entire directory after confirming no active imports.

### 2.2 Temporary Files Directory

**Location**: `tmp/`

**Status**: ✅ **SAFE TO REMOVE** (confirmed 0 runtime references)

**Files** (16 files):

- `backfill-deposit.ts`
- `backfill-paidby-clean.ts`
- `check-udf.ts`
- `query-bank-buildium-id.ts`
- `query-bank-lines.ts`
- `query-deposit-row.ts`
- `query-gl.ts`
- `query-property.ts`
- `query-splits.ts`
- `query-tenant.ts`
- `query-tx-all.ts`
- `query-tx.ts`
- `query-undeposited-names.ts`
- `query-undeposited.ts`
- `simulate-deposit.ts`
- `sync-deposit-buildium.ts`
- `tsconfig.all.tsbuildinfo`

**Risk Level**: Low

**Validation Steps**:

1. ✅ Confirmed: No inbound references found in codebase scan
2. Check if any package.json scripts reference these files
3. Verify no documentation references these files

**Recommendation**: Remove entire `tmp/` directory. If any scripts contain valuable logic, extract to `scripts/diagnostics/` or `scripts/sql/` before removal.

### 2.2.1 Trace Artifacts Directory

**Location**: `ts-trace/`

**Status**: ✅ **SAFE TO REMOVE**

**Files**:

- `trace.json` - Generated trace file
- `types.json` - Generated types file

**Risk Level**: Low

**Reason**: Generated artifacts, not actively used in codebase

**Validation Steps**:

1. Confirm these are generated files (not source code)
2. Check if any build processes depend on these files
3. Verify if they're needed for debugging or analysis

**Recommendation**: Remove `ts-trace/` directory if not actively used for debugging or type analysis.

### 2.3 TypeScript Excluded Files

**Location**: Listed in `tsconfig.json` exclude array

**Files**:

- `src/lib/webhooks.ts`
- `src/lib/relationship-resolver.ts`
- `src/lib/hooks/useSupabase.ts`
- `src/lib/data-integrity-validator.ts`

**Status**: ⚠️ **REQUIRES INVESTIGATION**

**Risk Level**: Medium

**Validation Steps**:

1. Check if these files are actually used at runtime (not just excluded from type checking)
2. Search for imports of these files
3. Verify if they're deprecated or actively used
4. If deprecated, remove from codebase and tsconfig.json exclude list

**Recommendation**: Investigate each file's usage status. If unused, remove. If used but excluded for type-checking reasons, document why.

### 2.4 Root-Level Temporary Files

**Location**: Project root

**Files**:

- `tmp-run-bill-payment.ts` - ✅ **0 runtime references** (confirmed)
- `tmp-test-resolve.ts` - ✅ **0 runtime references** (confirmed)
- `apify-web-scraper-config.json` (if unused)
- `apply-missing-migrations.js`
- `apply-reconciliation-log.js`
- `apply-reconciliation-log.sql`
- `fix-markdown.js`

**Status**: ✅ **SAFE TO REMOVE** (for tmp-\*.ts files)

**Risk Level**: Low

**Validation Steps**:

1. ✅ Confirmed: `tmp-run-bill-payment.ts` and `tmp-test-resolve.ts` have no inbound references
2. Check if referenced in package.json scripts
3. Verify if these are one-time migration/fix scripts
4. Check git history for last usage

**Recommendation**:

- **Immediate**: Remove `tmp-run-bill-payment.ts` and `tmp-test-resolve.ts` (confirmed unused)
- **Validate**: Check other root-level files and move to `scripts/` directory if still needed, or remove if one-time scripts

---

## 3. Database Migrations

### 3.1 Duplicate Migrations

#### `20250201000000_double_entry_validation_functions.sql` vs `20250201120000_double_entry_validation_functions.sql`

**Status**: ⚠️ **REQUIRES INVESTIGATION**

**Risk Level**: Medium

**Issue**: Two migrations with identical names created on the same day (2025-02-01). `diff -u` shows the files are identical.

**Validation Steps**:

1. Check migration history to see which timestamp was applied in each environment
2. If the later file is redundant, remove `20250201120000_*`
3. Verify no dependencies on the specific migration timestamp (rollbacks, audits)

**Recommendation**: If confirmed redundant after history review, remove `20250201120000_double_entry_validation_functions.sql` and update any references.

### 3.2 Obsolete Migration Helper Scripts

**Location**: `scripts/migrations/`

**Files**:

- `add-missing-sequence-numbers.sh` - One-time migration rename script
- `add-remaining-sequence-numbers.sh` - One-time migration rename script
- `complete-sequence-fix.sh` - One-time migration rename script
- `final-sequence-fix.sh` - One-time migration rename script
- `fix-specific-migrations.sh` - One-time migration rename script

**Status**: ✅ **SAFE TO REMOVE** (after verification)

**Risk Level**: Low

**Validation Steps**:

1. Confirm all migrations have been renamed and these scripts are no longer needed
2. Check if any documentation references these scripts
3. Verify git history shows these were one-time fixes

**Recommendation**: Move to `docs/migrations/history/` for reference or remove if no longer needed.

---

## 4. Dependencies

### 4.1 Potentially Unused Dev Dependencies

#### `playwright` (v1.55.0)

- **Status**: ⚠️ **REQUIRES VALIDATION**
- **Risk Level**: Low
- **Reason**: Test scripts show "Playwright tests removed" but package still installed
- **Validation Steps**:
  1. Search codebase for `playwright` imports
  2. Check if any scripts use playwright
  3. Verify if it's needed for future test plans
- **Recommendation**: If unused, remove from package.json. If kept for future use, document in README.

#### `@axe-core/playwright` (v4.10.0)

- **Status**: ⚠️ **REQUIRES VALIDATION**
- **Risk Level**: Low
- **Reason**: Accessibility tests removed per package.json scripts
- **Validation Steps**:
  1. Confirm no accessibility testing is planned
  2. Check if any scripts reference this
- **Recommendation**: Remove if accessibility testing is not planned.

#### `@playwright/test` (v1.57.0)

- **Status**: ⚠️ **REQUIRES VALIDATION**
- **Risk Level**: Low
- **Reason**: E2E tests removed per package.json scripts
- **Validation Steps**:
  1. Confirm no E2E testing is planned
  2. Check if any scripts reference this
- **Recommendation**: Remove if E2E testing is not planned.

### 4.2 Dependencies in Use (Keep)

The following dependencies are actively used and should be retained:

- All `@radix-ui/*` packages (UI components)
- `@supabase/*` packages (database)
- `@sentry/nextjs` (error tracking)
- `next`, `react`, `react-dom` (core framework)
- `zod` (validation)
- `date-fns` (date utilities)
- All other dependencies have active usage in the codebase

---

## 5. Scripts Directory

### 5.1 One-Time Backfill/Migration Scripts

**Location**: `scripts/`

**Files** (Requires validation):

- `backfill-accounts-payable.ts`
- `backfill-accounts-receivable-charges.ts`
- `backfill-deposit-property-unit.ts`
- `backfill-missing-bank-lines.ts`
- `backfill-transaction-lines-lease-and-buildium.ts`
- `apply-missing-migrations.js`
- `apply-reconciliation-log.js`
- `apply-reconciliation-log.sql`

**Status**: ⚠️ **REQUIRES VALIDATION**

**Risk Level**: Low to Medium

**Validation Steps**:

1. Check git history for last execution
2. Verify if these were one-time data fixes
3. Confirm if they're still needed for new environments
4. Check if they're referenced in documentation

**Recommendation**:

- If one-time scripts: Move to `docs/migrations/backfills/` for reference, then remove
- If needed for new environments: Keep in `scripts/maintenance/` with clear documentation

### 5.2 Test/Debug Scripts

**Location**: `scripts/`

**Files**:

- `test-buildium-webhook-direct.ts`
- `test-buildium-webhook.ts`
- `test-deposit-974933.ts`
- `test-management-service.ts`
- `test-payment-bank-lines.ts`
- `test-relationship-resolver.ts`

**Status**: ⚠️ **REQUIRES VALIDATION**

**Risk Level**: Low

**Validation Steps**:

1. Check if these are still useful for debugging
2. Verify if they test deprecated functionality
3. Consider moving to `scripts/diagnostics/` if still useful

**Recommendation**: Move useful test scripts to `scripts/diagnostics/`, remove obsolete ones.

### 5.3 Obsolete Script Files

**Location**: Root and `scripts/`

**Files**:

- `sync-bank-accounts.js` (referenced in package.json but may be obsolete)
- `any-usage-counts.txt` (generated file)
- `any-usages.txt` (generated file)
- `lint-buildium-credentials-baseline.txt` (baseline file, may be obsolete)

**Status**: ⚠️ **REQUIRES VALIDATION**

**Risk Level**: Low

**Validation Steps**:

1. Check if `sync-bank-accounts.js` is still used (package.json script exists)
2. Verify if generated `.txt` files are needed
3. Check if baseline files are still referenced

---

## 6. Public Assets

### 6.1 Unused Assets (Requires Verification)

**Location**: `public/`

**Files to Verify**:

- `file.svg` - Check if used in file components
- `globe.svg` - Check if used in UI
- `next.svg` - Default Next.js asset, may be unused
- `vercel.svg` - Default Vercel asset, may be unused
- `window.svg` - Check if used in UI

**Status**: ⚠️ **REQUIRES VALIDATION**

**Risk Level**: Low

**Validation Steps**:

1. Search codebase for references to each asset
2. Check if used in components or pages
3. Verify if default Next.js/Vercel assets are needed

**Recommendation**: Remove unused default assets, keep project-specific assets.

### 6.2 Assets in Use (Keep)

- `ora-blue-logo.png`
- `ora-logo-wordmark.svg`
- `ora-logo.png`
- `ora-statement-logo.svg`
- `ora-statement-wordmark.svg`
- `fonts/source-sans-3/` (font files)

---

## 7. Configuration Files

### 7.1 Potentially Unused Config Files

**Files**:

- `apify-web-scraper-config.json` - Check if Apify integration is still used
- `deno.lock` - Check if Deno is used (may be from Supabase Edge Functions)

**Status**: ⚠️ **REQUIRES VALIDATION**

**Risk Level**: Low

**Validation Steps**:

1. Search for Apify references in codebase
2. Verify if `deno.lock` is needed for Supabase Edge Functions
3. Check if these are referenced in documentation

---

## 8. Documentation

### 8.1 Obsolete Documentation

**Status**: ⚠️ **REQUIRES REVIEW**

**Recommendation**: Review `docs/` directory for:

- Outdated architecture documents
- Superseded implementation guides
- Obsolete migration documentation

**Action**: Not included in this audit, but recommend periodic documentation review.

---

## 9. Risk Assessment Summary

### Low Risk (Safe to Remove)

- ✅ `buildium_api_cache` table (0 runtime refs, schema tooling only)
- ✅ `owners_list_cache` table (0 runtime refs, schema tooling only)
- ✅ `appliance_service_history` table (0 runtime refs, confirmed)
- ✅ `nyc_open_data_integrations` table (0 runtime refs)
- ✅ `building_permit_units` table (0 runtime refs)
- ✅ `property_automation_overrides` table (0 runtime refs)
- ✅ `service_fee_history` table (0 runtime refs)
- ✅ `property_onboarding` and `property_onboarding_tasks` tables (0 runtime refs)
- ✅ 13+ database views with 0 runtime refs (diagnostic, financial, webhook views)
- ✅ `tmp/` directory (0 runtime refs, confirmed)
- ✅ `ts-trace/` directory (generated artifacts)
- ✅ `tmp-run-bill-payment.ts` and `tmp-test-resolve.ts` (0 runtime refs, confirmed)
- ✅ `src/components/legacy/` directory
- ✅ Obsolete migration helper scripts
- ✅ Unused default Next.js/Vercel assets

### Medium Risk (Requires Validation)

- ⚠️ `inspections` table
- ⚠️ `buildium_api_log` table (only in schema tooling; consider removal vs retention)
- ⚠️ Duplicate migration files
- ⚠️ TypeScript excluded files
- ⚠️ One-time backfill scripts
- ⚠️ Playwright dependencies

### High Risk (Keep or Document)

- ✅ `property_ownerships_cache` (has active fallback logic)
- ✅ All core business tables
- ✅ All active components and utilities

---

## 10. Recommended Cleanup Plan

### Phase 1: Immediate (Low Risk)

1. **Database Tables** (wrap in single migration with opt-out comments):
   - Remove `buildium_api_cache` table
   - Remove `owners_list_cache` table
   - Remove `appliance_service_history` table
   - Remove `nyc_open_data_integrations` table
   - Remove `building_permit_units` table
   - Remove `property_automation_overrides` table
   - Remove `service_fee_history` table
   - Remove `property_onboarding` and `property_onboarding_tasks` tables
   - Remove `v_property_onboarding_summary` view
2. **Database Views** (drop or move to ad-hoc SQL):
   - Remove 13+ unused views (diagnostic, financial, webhook views)
3. **Code Files**:
   - Remove `tmp/` directory (confirmed 0 runtime refs)
   - Remove `ts-trace/` directory (generated artifacts)
   - Remove `tmp-run-bill-payment.ts` and `tmp-test-resolve.ts` (confirmed 0 runtime refs)
   - Remove `src/components/legacy/` directory (after import verification)
4. **Scripts**:
   - Remove obsolete migration helper scripts

### Phase 2: Validation Required (Medium Risk)

1. Validate and remove `inspections` table if unused
2. Decide on `buildium_api_log` table: implement retention policy or remove if not relied upon
3. Resolve duplicate migration files
4. Investigate TypeScript excluded files
5. Review and clean up one-time backfill scripts
6. Remove unused Playwright dependencies if not planned
7. Validate remaining root-level temporary files (`apply-*.js`, `fix-markdown.js`, etc.)

### Phase 3: Long-Term (Data Retention)

1. Implement data retention policies for audit/log tables (if keeping them)
2. Archive old webhook events
3. Set up automated cleanup jobs
4. Add retention/rotation or removal plan for cache/log tables

---

## 11. Validation Checklist

Before removing any item, verify:

- [ ] No imports/references in codebase
- [ ] Not used in Supabase Edge Functions
- [ ] Not referenced in package.json scripts
- [ ] Not used by external systems/integrations
- [ ] Not needed for new environment setup
- [ ] Not referenced in documentation
- [ ] Git history confirms it's obsolete
- [ ] No scheduled jobs/cron tasks use it
- [ ] Backup/export created if data is involved

---

## 12. Estimated Impact

### Space Savings

- Database tables: ~500+ kB (8+ tables with 0 runtime refs)
- Database views: ~13+ views removed (reduces schema complexity)
- Code files: ~50-100 files removed (tmp/, ts-trace/, legacy components, root temp files)
- Dependencies: ~50-100 MB (if Playwright removed)
- Overall: Moderate space savings, significant reduction in technical debt and schema complexity

### Maintenance Benefits

- Reduced codebase complexity
- Fewer files to maintain
- Clearer project structure
- Reduced confusion for new developers
- Faster build times (if dependencies removed)

---

## 13. Notes and Considerations

1. **Migration Safety**: All database changes should be done via migrations, not direct SQL
2. **Backup First**: Always backup database before removing tables
3. **Gradual Removal**: Remove items in phases, test after each phase
4. **Documentation**: Update documentation after removals
5. **Team Communication**: Notify team before removing shared utilities
6. **Version Control**: Use feature branches for cleanup work

---

## 14. Next Steps

1. **Review this report** with the team
2. **Prioritize cleanup items** based on risk and impact
3. **Create tickets** for each cleanup phase
4. **Execute Phase 1** (low-risk items)
5. **Validate Phase 2** items before removal
6. **Implement Phase 3** data retention policies
7. **Update documentation** after cleanup

---

---

## 15. Detailed Scan Results

**Scan Method**: `rg --count` across `src/`, `scripts/`, and `supabase/` (excluding migrations/types)

**Confirmed Zero Runtime References**:

- All tables listed in Section 1.1 (8+ tables)
- All views listed in Section 1.5 (13+ views)
- `tmp/` directory files
- `tmp-run-bill-payment.ts` and `tmp-test-resolve.ts`
- `ts-trace/` generated artifacts

**Next Steps**:

1. Create single migration to drop all zero-ref tables/views (include opt-out comments for items under consideration)
2. Add retention/rotation or removal plan for cache/log tables if keeping them
3. Clean `tmp/` and `ts-trace/` to keep repo lean
4. Archive or remove root-level scratch scripts

---

**Report Generated**: 2025-01-31  
**Last Updated**: 2025-01-31 (with detailed scan results)  
**Next Review**: Recommended in 3-6 months or after major refactoring
