# Buildium Credentials Migration Checklist

This document tracks the migration of Buildium API routes to use org-scoped credentials.

## Migration Status

### ✅ Completed Infrastructure

- [x] Database migrations (`buildium_integrations` and `buildium_integration_audit_log` tables)
- [x] Credentials manager (`src/lib/buildium/credentials-manager.ts`)
- [x] API routes for credential management (`/api/buildium/integration/*`)
- [x] Updated `buildium-http.ts` to require `orgId` parameter
- [x] Updated `buildium-client.ts` with `getOrgScopedBuildiumClient()`
- [x] Updated `buildium-sync.ts` to accept `orgId` in all methods
- [x] Updated `buildium-mappers.ts` `fetchBuildiumResource()` to accept `orgId`
- [x] UI components for credential management
- [x] Documentation updates

### 🔄 Remaining Migration Tasks

#### API Routes to Update

The following API routes need to be updated to:
1. Resolve `orgId` from request context (using existing `resolveOrgId` patterns)
2. Pass `orgId` to Buildium operations (`buildiumFetch`, `getOrgScopedBuildiumClient`, `buildiumSync.*`, etc.)

**Pattern for each route:**

```typescript
// 1. Resolve orgId
const orgId = await resolveOrgId(request, userId)

// 2. Use org-scoped client/fetch
const client = await getOrgScopedBuildiumClient(orgId)
// OR
const result = await buildiumFetch('GET', '/rentals', {}, undefined, orgId)
// OR
await buildiumSync.syncPropertyToBuildium(property, orgId)
```

**Files to update:**

- [ ] `src/app/api/buildium/**/*.ts` - All Buildium API routes (~100+ files)
- [ ] `src/app/api/properties/**/*.ts` - Property routes that use Buildium sync
- [ ] `src/app/api/units/**/*.ts` - Unit routes that use Buildium sync
- [ ] `src/app/api/leases/**/*.ts` - Lease routes that use Buildium sync
- [ ] `src/app/api/owners/**/*.ts` - Owner routes that use Buildium sync
- [ ] `src/app/api/vendors/**/*.ts` - Vendor routes that use Buildium sync
- [ ] `src/app/api/tasks/**/*.ts` - Task routes that use Buildium sync
- [ ] `src/app/api/bills/**/*.ts` - Bill routes that use Buildium sync
- [ ] `src/app/api/bank-accounts/**/*.ts` - Bank account routes that use Buildium sync
- [ ] `src/app/api/work-orders/**/*.ts` - Work order routes that use Buildium sync
- [ ] `src/app/api/journal-entries/**/*.ts` - Journal entry routes that use Buildium sync

#### Edge Functions to Update

- [ ] `supabase/functions/buildium-*/index.ts` - All Buildium edge functions

#### Mapper Functions

- [ ] Update calls to `fetchBuildiumResource()` in `buildium-mappers.ts` to pass `orgId` when available

#### Scripts

- [ ] `scripts/buildium/**/*.ts` - Update Buildium scripts to accept and use `orgId`

## Migration Verification

### Pre-Deploy Checks

Run these checks before deploying:

```bash
# Check for direct process.env.BUILDIUM usage (should only be in credentials-manager.ts)
rg "process\.env\.BUILDIUM" --type ts --type tsx | grep -v credentials-manager.ts

# Check for buildiumFetch calls without orgId parameter
rg "buildiumFetch\(" --type ts --type tsx | grep -v "orgId"

# Check for createBuildiumClient calls (should use getOrgScopedBuildiumClient instead)
rg "createBuildiumClient\(" --type ts --type tsx | grep -v "getOrgScopedBuildiumClient"
```

### Testing Checklist

- [ ] Test credential storage via UI
- [ ] Test credential update via UI
- [ ] Test enable/disable toggle
- [ ] Test connection status check
- [ ] Test webhook secret rotation
- [ ] Test property sync with org-scoped credentials
- [ ] Test fallback to env vars when no DB credentials exist
- [ ] Test RLS policies (users can only access their org's credentials)
- [ ] Test audit logging (all changes are logged with masked secrets)

## Rollout Strategy

1. **Phase 1**: Deploy infrastructure (migrations, credentials manager, API routes, UI)
2. **Phase 2**: Update critical sync operations (`buildium-sync.ts`, `buildium-mappers.ts`)
3. **Phase 3**: Gradually update API routes (start with most-used endpoints)
4. **Phase 4**: Update edge functions
5. **Phase 5**: Update scripts
6. **Phase 6**: Remove deprecated shims and legacy code

## Notes

- Environment variables (`BUILDIUM_*`) will continue to work as fallback for backward compatibility
- System jobs without org context can pass `undefined` for `orgId` (will use env fallback)
- All credential access flows through `getOrgScopedBuildiumConfig()` (central choke point)
- Credentials are encrypted before storage using the same encryption as Gmail tokens
- Cache invalidation happens automatically on credential updates

