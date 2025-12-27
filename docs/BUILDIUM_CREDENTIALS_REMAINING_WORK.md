# Buildium Credentials Management - Remaining Work

<!-- markdownlint-configure-file {"MD013": false} -->

## Summary

The core infrastructure for Buildium credentials management is **complete and deployed**. The following items remain to fully complete the plan:

## ✅ Completed (Infrastructure)

1. ✅ Database migrations (pushed and applied)
2. ✅ Credentials manager (`src/lib/buildium/credentials-manager.ts`)
3. ✅ API routes for credential management
4. ✅ Updated core libraries (`buildium-http.ts`, `buildium-client.ts`, `buildium-sync.ts`, `buildium-mappers.ts`)
5. ✅ UI components for credential management
6. ✅ Documentation updates

## 🔄 Critical Remaining Work

### 1. **CI/Lint Enforcement** (High Priority)

**Status**: Not implemented

**What's needed**:

- Create a CI script/lint rule to fail on `process.env.BUILDIUM` usage outside `credentials-manager.ts`
- Add to pre-commit hook or CI pipeline
- Currently: **138 files** still use `process.env.BUILDIUM` directly

**Action items**:

- [ ] Create `scripts/lint-buildium-credentials.ts` to check for violations
- [ ] Add to `package.json` scripts (e.g., `lint:buildium-credentials`)
- [ ] Add to CI pipeline (GitHub Actions or similar)
- [ ] Optionally add ESLint rule to catch at development time

**Example script**:

```typescript
// scripts/lint-buildium-credentials.ts
// Scans codebase for process.env.BUILDIUM usage outside credentials-manager.ts
// Exits with error code if violations found
```

### 2. **API Route Migration** (High Priority)

**Status**: ~138 files need updating

**What's needed**:

- Update all API routes to resolve `orgId` and pass it to Buildium operations
- Files in `src/app/api/buildium/**/*.ts` (~100+ files)
- Files in other API routes that use Buildium sync

**Pattern to apply**:

```typescript
// Before:
const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/rentals`, {
  headers: {
    'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
    'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
  },
});

// After:
const orgId = await resolveOrgId(request, userId);
const result = await buildiumFetch('GET', '/rentals', {}, undefined, orgId);
// OR
const client = await getOrgScopedBuildiumClient(orgId);
const response = await client.getProperties();
```

**Priority order**:

1. Most-used endpoints (properties, leases, units)
2. Less-frequently used endpoints
3. Edge cases and admin routes

### 3. **Update Cursor Rules** (Medium Priority)

**Status**: Rules still reference old pattern

**What's needed**:

- Update `.cursor/rules/buildium-integration-rules.mdc` to reference new credential manager
- Remove references to direct `process.env.BUILDIUM` usage
- Update script templates to use org-scoped credentials

### 4. **Edge Functions** (Medium Priority)

**Status**: Not updated

**What's needed**:

- Update `supabase/functions/buildium-*/index.ts` to use org-scoped credentials
- Edge functions need to resolve orgId from request context
- May need to pass orgId as parameter or extract from request

### 5. **Scripts** (Low Priority)

**Status**: Not updated

**What's needed**:

- Update `scripts/buildium/**/*.ts` to accept and use `orgId`
- Scripts may need orgId as command-line argument
- For system-level scripts, `orgId` can be `undefined` (uses env fallback)

### 6. **Testing & Verification** (High Priority)

**Status**: Not verified

**What's needed**:

- [ ] Test credential storage via UI
- [ ] Test credential update via UI
- [ ] Test enable/disable toggle
- [ ] Test connection status check
- [ ] Test webhook secret rotation
- [ ] Test property sync with org-scoped credentials
- [ ] Test fallback to env vars when no DB credentials exist
- [ ] Test RLS policies (users can only access their org's credentials)
- [ ] Test audit logging (all changes are logged with masked secrets)
- [ ] Integration tests for status check throttling
- [ ] E2E tests for UI form submission

### 7. **Observability/Metrics** (Medium Priority)

**Status**: Logging in place, metrics may need setup

**What's needed**:

- Verify logging for "Buildium call without orgId" (already implemented)
- Verify logging for "missing/disabled creds" (already implemented)
- Consider adding metrics/alerting for:
  - Buildium calls without orgId (should be rare)
  - Missing credentials errors
  - Disabled integration attempts
  - Failed connection tests

### 8. **Documentation Updates** (Low Priority)

**Status**: Mostly complete

**What's needed**:

- [ ] Update `.cursor/rules/buildium-integration-rules.mdc` with new patterns
- [ ] Update any developer onboarding docs
- [ ] Add migration guide for updating existing API routes

## Migration Strategy

### Phase 1: Enforcement (Do First)

1. Create CI/lint script to prevent new violations
2. Update Cursor rules to guide developers

### Phase 2: Critical Routes (Do Next)

1. Update most-used Buildium API routes
2. Update routes that trigger sync operations
3. Test thoroughly

### Phase 3: Remaining Routes (Gradual)

1. Update remaining API routes in batches
2. Test each batch before moving to next

### Phase 4: Edge Cases

1. Update edge functions
2. Update scripts
3. Remove deprecated shims

## Quick Wins

1. **Create lint script** - Prevents new violations immediately
2. **Update 5-10 most-used routes** - Gets majority of traffic using new system
3. **Add to CI** - Catches violations before merge

## Verification Commands

```bash
# Check for direct process.env.BUILDIUM usage (should only be in credentials-manager.ts)
rg "process\.env\.BUILDIUM" --type ts --type tsx | grep -v credentials-manager.ts

# Check for buildiumFetch calls without orgId parameter
rg "buildiumFetch\(" --type ts --type tsx | grep -v "orgId"

# Check for createBuildiumClient calls (should use getOrgScopedBuildiumClient instead)
rg "createBuildiumClient\(" --type ts --type tsx | grep -v "getOrgScopedBuildiumClient"
```

## Current Status

- **Infrastructure**: ✅ 100% Complete
- **Core Libraries**: ✅ 100% Complete
- **UI Components**: ✅ 100% Complete
- **API Routes**: ⚠️ ~0% Complete (138 files need updating)
- **Edge Functions**: ⚠️ 0% Complete
- **Scripts**: ⚠️ 0% Complete
- **CI/Enforcement**: ⚠️ 0% Complete
- **Testing**: ⚠️ 0% Complete

**Overall Progress**: ~60% Complete (infrastructure done, migration work remains)
