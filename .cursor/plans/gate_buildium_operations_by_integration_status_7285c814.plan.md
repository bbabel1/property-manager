---
name: Gate Buildium operations by integration status
overview: "Ensure ALL Buildium API calls, webhooks, and syncs are blocked when the integration is disabled. Implement two layers: logical gating at all entry points + hard runtime egress guard to prevent bypass. No data should flow from/to Buildium when disabled."
todos:
  - id: "0.1"
    content: Define canonical meaning of 'enabled' and document rules (enabled = is_enabled=true in DB, disabled = is_enabled=false regardless of credentials)
    status: completed
  - id: "0.2"
    content: Create Node.js guard function (src/lib/buildium-gate.ts) - assertBuildiumEnabled(orgId, context)
    status: completed
  - id: "0.3"
    content: Create Edge function guard (supabase/functions/_shared/buildiumGate.ts) - assertBuildiumEnabledEdge(supabaseAdmin, orgId)
    status: completed
  - id: "1.1"
    content: Strengthen buildiumFetch (src/lib/buildium-http.ts) - require orgId, call assertBuildiumEnabled, return 403 error (not status:0)
    status: completed
    dependencies:
      - "0.2"
  - id: "1.2"
    content: Create buildiumFetchEdge wrapper (supabase/functions/_shared/buildiumFetch.ts) with enabled check
    status: completed
    dependencies:
      - "0.3"
  - id: "2.1"
    content: Implement Node.js egress guard in instrumentation.ts - monkey-patch fetch to block Buildium hostnames unless x-buildium-egress-allowed header present
    status: completed
  - id: "2.2"
    content: Implement Edge function egress guard - patch fetch in shared module to block Buildium hostnames unless header present
    status: completed
  - id: "3.1"
    content: Update webhook handler (src/app/api/webhooks/buildium/route.ts) - return 200 OK when disabled, store as ignored_disabled status (not 403)
    status: completed
    dependencies:
      - "0.2"
  - id: "3.2"
    content: Update edge webhook processors - check enabled status before processing each batch/event
    status: completed
    dependencies:
      - "0.3"
  - id: "4.1"
    content: Create route guard helper (src/lib/buildium-route-guard.ts) - requireBuildiumEnabledOrThrow(req)
    status: completed
    dependencies:
      - "0.2"
  - id: "4.2"
    content: Apply route guard to all Buildium API routes (staff/sync, import-task-work-order, bank-accounts/sync/from-buildium, etc.)
    status: completed
    dependencies:
      - "4.1"
  - id: "4.3"
    content: Gate Buildium scripts (sync-reconciliations.ts, test-buildium-tenant-note-delete.ts, test-tenant-file-upload-buildium.ts, etc.)
    status: completed
    dependencies:
      - "0.2"
  - id: "5.1"
    content: Update toggle route (src/app/api/buildium/integration/toggle/route.ts) - add version bump and cache invalidation on disable
    status: completed
  - id: "5.2"
    content: Add enabled status re-check in long-running syncs (before each batch/page, not just once)
    status: completed
    dependencies:
      - "0.3"
  - id: "6.1"
    content: Add CI check to scan for direct Buildium fetch calls outside approved wrappers
    status: completed
  - id: "6.2"
    content: Add comprehensive tests (unit, integration, edge, webhook) for disabled state
    status: completed
---

# Gate All Buildium Operations by Integration Enabled Status

## Problem Statement

Currently, when the Buildium integration is disabled via the UI toggle, Buildium operations may still execute because:

1. **Missing explicit checks**: Some code paths don't check `isEnabled` before calling Buildium
2. **Bypass vectors**: Code can call Buildium directly via `fetch()` without going through guarded wrappers
3. **Webhook retries**: Returning 403 causes Buildium to retry, generating noise
4. **Long-running operations**: Enabled status only checked once, not during execution
5. **Scripts bypass gates**: Buildium scripts can call API directly
6. **Edge functions don't check DB**: Edge functions use credentials but don't verify `is_enabled` flag

## Solution Overview: Two-Layer Defense

**Layer 1: Logical Gating** - Add explicit `isEnabled` checks at all entry points**Layer 2: Hard Runtime Egress Guard** - Monkey-patch `fetch()` to block Buildium hostnames unless marked approvedThis combination ensures Buildium calls cannot occur when disabled, even if a developer forgets a check.

## Implementation Plan

### Phase 0: Define Source of Truth + Guard Functions

#### 0.1 Define Canonical Meaning of "Enabled"

**Documentation** (in code comments and docs):

- **Enabled** = `buildium_integrations.is_enabled = true` AND credentials exist AND `deleted_at IS NULL`
- **Disabled** = `is_enabled = false` (regardless of whether credentials are present)
- Do NOT let "credentials present" behave like "enabled"

#### 0.2 Create Node.js Guard Function

**New File**: `src/lib/buildium-gate.ts`

```typescript
import { getOrgScopedBuildiumConfig } from './buildium/credentials-manager';
import { logger } from './logger';

export class BuildiumDisabledError extends Error {
  constructor(public orgId?: string) {
    super(orgId 
      ? `Buildium integration is disabled for org ${orgId}`
      : 'Buildium integration is disabled'
    );
    this.name = 'BuildiumDisabledError';
  }
}

export async function assertBuildiumEnabled(
  orgId: string | undefined,
  context?: string
): Promise<void> {
  const config = await getOrgScopedBuildiumConfig(orgId);
  
  if (!config || !config.isEnabled) {
    logger.warn({ orgId, context }, 'Buildium integration disabled');
    throw new BuildiumDisabledError(orgId);
  }
}
```

This becomes the only correct way to check enabled status in server routes.

#### 0.3 Create Edge Function Guard

**New File**: `supabase/functions/_shared/buildiumGate.ts`

```typescript
export async function assertBuildiumEnabledEdge(
  supabase: any,
  orgId: string | undefined
): Promise<void> {
  if (!orgId) {
    throw new Error('orgId required for Buildium integration check');
  }
  
  const { data, error } = await supabase
    .from('buildium_integrations')
    .select('is_enabled')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();
  
  if (error || !data || data.is_enabled !== true) {
    throw new Error(`Buildium integration is disabled for org ${orgId}`);
  }
}
```



### Phase 1: Strengthen Buildium HTTP Wrappers

#### 1.1 Strengthen `buildiumFetch`

**File**: `src/lib/buildium-http.ts`**Changes**:

1. Make `orgId` **required** (no undefined allowed for outbound calls)
2. Call `assertBuildiumEnabled(orgId)` after getting config
3. Return proper HTTP error (status: 403, not status: 0) to avoid retries
```typescript
export async function buildiumFetch(
  method: BuildiumMethod,
  path: string,
  params?: BuildiumParams,
  payload?: unknown,
  orgId: string // Changed from optional to required
): Promise<BuildiumFetchResult> {
  // Assert enabled
  await assertBuildiumEnabled(orgId, `buildiumFetch ${method} ${path}`);
  
  const config = await getOrgScopedBuildiumConfig(orgId);
  if (!config) {
    // This should not happen if assertBuildiumEnabled passed
    const errorMsg = `Buildium credentials not available for org ${orgId}`;
    logger.error({ orgId }, errorMsg);
    return { 
      ok: false, 
      status: 403, // Changed from 0 to 403
      statusText: errorMsg,
      errorText: errorMsg 
    };
  }
  
  // ... rest of implementation with egress-allowed header
  const res = await fetch(url, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Buildium-Client-Id': config.clientId,
      'X-Buildium-Client-Secret': config.clientSecret,
      'x-buildium-egress-allowed': '1', // Required for egress guard
    },
    body: payload && method !== 'GET' ? JSON.stringify(payload) : undefined
  });
  // ...
}
```




#### 1.2 Create Edge Function Fetch Wrapper

**New File**: `supabase/functions/_shared/buildiumFetch.ts`

```typescript
import { assertBuildiumEnabledEdge } from './buildiumGate.ts';

export async function buildiumFetchEdge(
  supabase: any,
  orgId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  await assertBuildiumEnabledEdge(supabase, orgId);
  
  // Get credentials from request body or env
  const baseUrl = /* resolve baseUrl */;
  const clientId = /* resolve clientId */;
  const clientSecret = /* resolve clientSecret */;
  
  const url = `${baseUrl}${path}`;
  return await fetch(url, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Buildium-Client-Id': clientId,
      'X-Buildium-Client-Secret': clientSecret,
      'x-buildium-egress-allowed': '1',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

**Update edge functions** to use `buildiumFetchEdge` exclusively:

- `supabase/functions/buildium-sync/index.ts`
- `supabase/functions/buildium-webhook/index.ts`
- `supabase/functions/buildium-lease-transactions/index.ts` (note: actual name, not buildium-lease-transactions-api)
- Any other edge functions making Buildium calls

**Enforcement**: Ban direct `fetch('https://...buildium...')` usage in edge functions.

### Phase 2: Add Hard Runtime Egress Guard

#### 2.1 Node.js Egress Guard (Instrumentation)

**File**: `src/instrumentation.ts` (or `instrumentation.ts` at root)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? new URL(input) : input instanceof URL ? input : new URL(input.url);
      
      // Check if URL is Buildium hostname
      const buildiumHostnames = ['api.buildium.com', 'apisandbox.buildium.com'];
      const isBuildium = buildiumHostnames.some(host => url.hostname === host);
      
      if (isBuildium) {
        const headers = init?.headers as HeadersInit | undefined;
        const headerMap = headers instanceof Headers 
          ? headers 
          : Array.isArray(headers)
          ? new Headers(headers)
          : new Headers(Object.entries(headers || {}));
        
        const allowed = headerMap.get('x-buildium-egress-allowed') === '1';
        
        if (!allowed) {
          throw new Error(
            `Direct Buildium fetch blocked. Use buildiumFetch() wrapper instead. URL: ${url.href}`
          );
        }
      }
      
      return originalFetch.call(this, input, init);
    };
  }
}
```

**Result**: Even if someone writes `fetch(buildiumUrl)` directly, it throws before the request.

#### 2.2 Edge Function Egress Guard

**File**: `supabase/functions/_shared/buildiumEgressGuard.ts`

```typescript
const originalFetch = globalThis.fetch;

globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' 
    ? new URL(input) 
    : input instanceof URL 
    ? input 
    : new URL((input as Request).url);
  
  const buildiumHostnames = ['api.buildium.com', 'apisandbox.buildium.com'];
  const isBuildium = buildiumHostnames.some(host => url.hostname === host);
  
  if (isBuildium) {
    const headers = init?.headers as HeadersInit | undefined;
    const headerMap = headers instanceof Headers 
      ? headers 
      : Array.isArray(headers)
      ? new Headers(headers)
      : new Headers(Object.entries(headers || {}));
    
    const allowed = headerMap.get('x-buildium-egress-allowed') === '1';
    
    if (!allowed) {
      throw new Error(
        `Direct Buildium fetch blocked. Use buildiumFetchEdge() wrapper instead. URL: ${url.href}`
      );
    }
  }
  
  return originalFetch.call(this, input, init);
};
```

Import this at the top of each Buildium edge function.

### Phase 3: Webhooks - Accept, Store as Ignored, Don't Process

#### 3.1 Next.js Webhook Route

**File**: `src/app/api/webhooks/buildium/route.ts`**Changes**:

1. Verify webhook signature first (security)
2. Determine `orgId` from events
3. Check `assertBuildiumEnabled(orgId)`
4. If disabled: Insert event with `status: 'ignored_disabled'`, return **200 OK** (not 403)
```typescript
const { orgId } = await resolveOrgContextFromEvents(events);
const config = await getOrgScopedBuildiumConfig(orgId ?? undefined);

if (!config || !config.isEnabled) {
  // Store as ignored_disabled
  for (const event of events) {
    await insertBuildiumWebhookEventRecord(supabase, event, {
      status: 'ignored_disabled',
      // ...
    });
  }
  
  logger.info({ orgId }, 'Buildium integration disabled, webhook ignored');
  return NextResponse.json(
    { ignored: true, reason: 'integration_disabled' },
    { status: 200 } // 200 to prevent retries
  );
}

// ... continue processing
```


**Why 200 instead of 403**: Prevents Buildium retries and keeps system quiet while disabled.

#### 3.2 Edge Webhook Processors

**Files**: `supabase/functions/buildium-webhook/index.ts`, related processors

- Check enabled status **before processing each batch** (not just once at start)
- If disabled: mark batch as `ignored_disabled` and return 200
- Re-check enabled status before processing next webhook event

### Phase 4: Gate Every Buildium API Route and Script

#### 4.1 Create Route Guard Helper

**New File**: `src/lib/buildium-route-guard.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { assertBuildiumEnabled, BuildiumDisabledError } from './buildium-gate';
import { resolveOrgIdFromRequest } from './org/resolve-org-id';
import { requireAuth } from './auth/guards';

export async function requireBuildiumEnabledOrThrow(
  request: NextRequest
): Promise<string> {
  const { user } = await requireAuth();
  const orgId = await resolveOrgIdFromRequest(request, user.id);
  await assertBuildiumEnabled(orgId, request.url);
  return orgId;
}

export async function requireBuildiumEnabledOr403(
  request: NextRequest
): Promise<string | NextResponse> {
  try {
    return await requireBuildiumEnabledOrThrow(request);
  } catch (error) {
    if (error instanceof BuildiumDisabledError) {
      return NextResponse.json(
        { error: { code: 'BUILDIUM_DISABLED', message: error.message } },
        { status: 403 }
      );
    }
    throw error;
  }
}
```



#### 4.2 Apply Route Guard to All Buildium Routes

**Routes to update** (use `requireBuildiumEnabledOr403` at start of handler):

- `src/app/api/buildium/staff/sync/route.ts`
- `src/app/api/buildium/import-task-work-order/route.ts`
- `src/app/api/bank-accounts/sync/from-buildium/route.ts`
- `src/app/api/buildium/properties/[id]/images/route.ts`
- `src/app/api/buildium/bills/[id]/sync/route.ts`
- `src/app/api/buildium/owners/[id]/sync/route.ts`
- `src/app/api/buildium/general-ledger/accounts/sync/route.ts`
- `src/app/api/buildium/sync/route.ts`
- Any other `/api/buildium/**` routes

**Exception**: `src/app/api/buildium/integration/toggle/route.ts` should NOT require enabled (it's the switch itself), but should enforce authorization.

#### 4.3 Gate Buildium Scripts

**Scripts to update** (check enabled before making calls):

- `scripts/buildium/sync/sync-reconciliations.ts`
- `scripts/buildium/sync/fetch-buildium-lease.ts`
- `scripts/buildium/create/fetch-and-add-buildium-property.ts`
- `scripts/buildium/sync/fetch-buildium-bank-accounts.ts`
- All other scripts in `scripts/buildium/**/*.ts`

**Pattern**:

```typescript
import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager';

const orgId = process.env.DEFAULT_ORG_ID ?? process.argv[2];
const config = await getOrgScopedBuildiumConfig(orgId);

if (!config || !config.isEnabled) {
  console.error(`Buildium integration is disabled for org ${orgId}`);
  process.exit(1);
}

// Continue with script...
```



### Phase 5: Make Disable Take Effect Immediately

#### 5.1 Update Toggle Route with Version Bump

**File**: `src/app/api/buildium/integration/toggle/route.ts`**Changes**:

1. Add `config_version` increment (or use `updated_at` reliably)
2. Invalidate cache immediately
3. Add `disabled_at` timestamp when disabling
```typescript
await supabaseAdmin
  .from('buildium_integrations')
  .update({
    is_enabled: enabled,
    updated_at: new Date().toISOString(),
    ...(enabled === false ? { disabled_at: new Date().toISOString() } : {}),
  })
  .eq('org_id', orgId)
  .is('deleted_at', null);

// Invalidate cache
configCache.delete(orgId);
```




#### 5.2 Re-check Enabled Status During Long Syncs

**Files**: `supabase/functions/buildium-sync/index.ts`, long-running sync operations**Rule**: Check enabled status **before each outbound Buildium call**, not just once at start.**Pattern**:

```typescript
async function syncPageOfEntities(supabase: any, orgId: string, page: number) {
  // Re-check before each page
  await assertBuildiumEnabledEdge(supabase, orgId);
  
  // Make Buildium API call
  const data = await buildiumFetchEdge(supabase, orgId, 'GET', '/entities', { page });
  // ...
}

// In main loop:
for (let page = 0; page < totalPages; page++) {
  await syncPageOfEntities(supabase, orgId, page); // Checks enabled each iteration
}
```

This ensures:

- Sync started at 10:00 (enabled)
- User disables at 10:03
- No further Buildium calls after 10:03 (except any single request already in-flight)

### Phase 6: CI Guardrails + Tests

#### 6.1 CI "No Direct Buildium Call" Scan

**New File**: `scripts/ci/check-buildium-fetch.ts`

```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const BUILDIUM_HOSTNAMES = ['api.buildium.com', 'apisandbox.buildium.com'];
const APPROVED_WRAPPERS = [
  'src/lib/buildium-http.ts', // buildiumFetch
  'supabase/functions/_shared/buildiumFetch.ts', // buildiumFetchEdge
];

async function scanFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf-8');
  const violations: string[] = [];
  
  // Check for direct fetch calls to Buildium
  for (const hostname of BUILDIUM_HOSTNAMES) {
    if (content.includes(hostname) && !APPROVED_WRAPPERS.some(w => filePath.includes(w))) {
      // Check if it's a fetch call
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes(hostname) && (line.includes('fetch(') || line.includes('fetch (`'))) {
          violations.push(`${filePath}:${index + 1} - Direct Buildium fetch detected`);
        }
      });
    }
  }
  
  return violations;
}

// Run scan and fail CI if violations found
```

**Add to CI**: Run this script and fail if violations found.

#### 6.2 Comprehensive Tests

**Unit Tests**:

- `buildiumFetch`: Given `isEnabled=false`, returns 403 error and fetch is never called
- Route guard: Returns 403 without invoking Buildium client creation
- Guard functions: Throw `BuildiumDisabledError` when disabled

**Integration Tests** (Next.js):

- Disable integration in test DB
- Hit `/api/buildium/staff/sync`, `/api/bank-accounts/sync/from-buildium`
- Assert: HTTP 403 response, outbound fetch mock call count = 0

**Edge Tests** (Deno):

- Call `buildium-sync` with disabled org
- Assert: Returns 403, does not call Buildium fetch wrapper

**Webhook Tests**:

- With disabled integration: webhook returns 200, event row stored as `ignored_disabled`, no downstream processing

**Egress Guard Tests**:

- Direct `fetch('https://api.buildium.com/...')` throws error
- `buildiumFetch` with egress-allowed header succeeds

## Files to Modify

### Node.js / Next.js

1. `src/lib/buildium-http.ts` - Strengthen buildiumFetch, require orgId, add enabled check, add egress-allowed header
2. `src/lib/buildium-edge-client.ts` - Improve disabled vs missing credentials error
3. `src/app/api/webhooks/buildium/route.ts` - Return 200 when disabled, store as ignored_disabled
4. `src/app/api/buildium/staff/sync/route.ts` - Add route guard
5. `src/app/api/buildium/import-task-work-order/route.ts` - Add route guard
6. `src/app/api/bank-accounts/sync/from-buildium/route.ts` - Add route guard
7. `src/app/api/buildium/properties/[id]/images/route.ts` - Add route guard
8. `src/app/api/buildium/bills/[id]/sync/route.ts` - Add route guard
9. `src/app/api/buildium/owners/[id]/sync/route.ts` - Add route guard
10. `src/app/api/buildium/general-ledger/accounts/sync/route.ts` - Add route guard
11. `src/app/api/buildium/sync/route.ts` - Add route guard
12. `src/app/api/buildium/integration/toggle/route.ts` - Add version bump + cache invalidation
13. Review all other `/api/buildium/**` routes

**New Files**:

- `src/lib/buildium-gate.ts` - Node.js guard function
- `src/lib/buildium-route-guard.ts` - Route guard helper
- `src/instrumentation.ts` - Egress guard (or add to existing)
- `scripts/ci/check-buildium-fetch.ts` - CI scan script

### Supabase Edge Functions

1. `supabase/functions/buildium-sync/index.ts` - Use buildiumFetchEdge, re-check enabled per batch
2. `supabase/functions/buildium-webhook/index.ts` - Use buildiumFetchEdge, check enabled per event
3. `supabase/functions/buildium-lease-transactions/index.ts` - Use buildiumFetchEdge
4. Review other edge functions for Buildium calls

**New Files**:

- `supabase/functions/_shared/buildiumGate.ts` - Edge guard function
- `supabase/functions/_shared/buildiumFetch.ts` - Edge fetch wrapper
- `supabase/functions/_shared/buildiumEgressGuard.ts` - Edge egress guard

### Scripts

- `scripts/buildium/sync/sync-reconciliations.ts` - Add enabled check
- `scripts/buildium/sync/fetch-buildium-lease.ts` - Add enabled check
- `scripts/buildium/create/fetch-and-add-buildium-property.ts` - Add enabled check
- Review and update all other `scripts/buildium/**/*.ts` scripts

## Testing Strategy

1. **Unit Tests**: Mock guards/config to return disabled state, verify operations fail
2. **Integration Tests**: Disable integration in test DB, verify:

- API calls return 403
- Webhooks return 200 with ignored status
- Edge functions return 403
- No data persisted from Buildium
- Egress guard blocks direct fetch

3. **Manual Testing**: Toggle integration off in UI, verify no Buildium operations succeed
4. **CI Tests**: Scan prevents new direct Buildium fetch usage

## Edge Cases to Handle

1. **Webhook events received during disabled state**: Store as `ignored_disabled`, return 200 (not 403) to prevent retries
2. **Long-running syncs**: Check enabled status before each batch/page/outbound call, not just once
3. **Cache invalidation**: Clear cache immediately when integration is toggled off
4. **Error messages**: Provide clear, actionable error messages indicating integration is disabled
5. **In-flight requests**: Allow single request already in-flight to complete, but block new requests immediately

## Success Criteria

- ✅ When `is_enabled=false`, zero outbound HTTP requests to Buildium occur (enforced by wrapper + egress guard)
- ✅ Webhooks are acknowledged (200 OK) but not processed, persisted as `ignored_disabled`
- ✅ Edge functions and API routes short-circuit immediately when disabled (403)
- ✅ Disabling takes effect mid-sync: no additional Buildium requests after toggle time (except single in-flight request)
- ✅ CI prevents regressions by blocking any new direct Buildium fetch usage
