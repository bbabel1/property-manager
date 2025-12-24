# Buildium Webhook Handling Review

<!-- markdownlint-configure-file {"MD013": false} -->

## Current Design and Data Flow

- See `docs/buildium-webhook-pipeline.md` for the current end-to-end pipeline diagram and handler coverage.
- **Edge Functions**: Two Supabase edge functions (`buildium-webhook`, `buildium-lease-transactions`) accept POST payloads containing `Events` and store each event in the `buildium_webhook_events` table before processing. Processing is synchronous within the request lifecycle and events are immediately marked processed regardless of downstream failures. 【F:supabase/functions/buildium-webhook/index.ts†L251-L363】【F:supabase/functions/buildium-lease-transactions/index.ts†L295-L385】
- **Routing by EventType**: The general webhook only handles `PropertyCreated/Updated`, `OwnerCreated/Updated`, and `LeaseCreated/Updated`, delegating other types to a default no-op. Lease events are forwarded to the `buildium-sync` function rather than mapping locally. Lease-transaction webhook filters for EventTypes containing `LeaseTransaction` and processes everything else as skipped. 【F:supabase/functions/buildium-webhook/index.ts†L315-L372】【F:supabase/functions/buildium-webhook/index.ts†L372-L455】【F:supabase/functions/buildium-lease-transactions/index.ts†L332-L378】
- **Persistence Layer**: `buildium_webhook_events` stores raw payloads with flags for processing, retries, and errors. Initial migration defines nullable `event_id`, no unique constraints, and retry metadata but no enforcement of retry logic in code. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1722-L1775】
- **Legacy SQL handlers**: The migration also defines `process_buildium_webhook_event` and stub handlers (e.g., `handle_lease_payment_webhook`) that log placeholders and are not used by edge functions. Unknown event types are flagged in SQL but unreachable in current flow. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L938-L995】【F:supabase/migrations/20240101000001_001_initial_schema.sql†L591-L653】

## Issues and Risks

### High Severity

- **Missing signature verification**: Both edge functions log the signature but perform no verification, leaving the endpoints unauthenticated. 【F:supabase/functions/buildium-webhook/index.ts†L262-L270】【F:supabase/functions/buildium-lease-transactions/index.ts†L315-L322】
- **Idempotency gaps**: `event_id` is nullable and unindexed; inserts are unconditional and events are always marked processed, so repeated deliveries create duplicate rows and processing repeats without safeguards. No hash or unique constraint on payload. 【F:supabase/functions/buildium-webhook/index.ts†L298-L340】【F:supabase/functions/buildium-lease-transactions/index.ts†L341-L375】【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1722-L1734】
- **Lack of validation**: Payloads are accepted as-is with no schema or EventName/type validation; malformed or unexpected `Events` arrays will reach processing with loose typing and minimal checks. 【F:supabase/functions/buildium-webhook/index.ts†L272-L324】【F:supabase/functions/buildium-lease-transactions/index.ts†L323-L378】
- **Partial processing without rollback**: Events are marked processed even when `processWebhookEvent` returns `success: false`, losing failure visibility and preventing retries. Similar in lease-transaction handler. 【F:supabase/functions/buildium-webhook/index.ts†L314-L341】【F:supabase/functions/buildium-lease-transactions/index.ts†L357-L375】

### Medium Severity

- **Limited EventType coverage**: The general handler ignores deletions and many Buildium entities (tasks, vendors, GL accounts, bills) that exist in other sync paths, so data may drift silently. Default case reports “Unhandled” but still returns success. 【F:supabase/functions/buildium-webhook/index.ts†L372-L382】
- **No retry/backoff logic**: Schema tracks `retry_count`/`max_retries` but edge functions never increment or enqueue retries; dead-letter or replay tooling absent. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1727-L1733】【F:supabase/functions/buildium-webhook/index.ts†L298-L340】
- **Weak owner/contact merging**: Owner upsert only fills null contact fields; changed emails/phones or deletions are not reconciled, risking stale data. 【F:supabase/functions/buildium-webhook/index.ts†L86-L152】
- **Forwarding without auth scoping**: Lease sync uses service key in request body and assumes edge endpoint availability; no tenant/org scoping in payload may sync wrong records if IDs collide. 【F:supabase/functions/buildium-webhook/index.ts†L393-L455】

### Low Severity

- **Placeholder SQL handlers**: SQL functions for event processing are stubs, creating maintenance debt and potential confusion about the authoritative pipeline. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L591-L653】【F:supabase/migrations/20240101000001_001_initial_schema.sql†L938-L995】
- **Minimal logging context**: Errors log generic messages without tenant/org identifiers, making correlation with upstream Buildium deliveries difficult. 【F:supabase/functions/buildium-webhook/index.ts†L314-L341】

## Data Mapping and Integrity Gaps

- **Event-to-model mapping**: Property mapping includes bank account resolution but silently skips missing accounts; owner mapping does not handle ownership relationships when property IDs are absent. Lease events rely entirely on the `buildium-sync` function without validating response shape. 【F:supabase/functions/buildium-webhook/index.ts†L34-L115】【F:supabase/functions/buildium-webhook/index.ts†L420-L455】
- **Database constraints**: `event_id` and `event_type` allow NULL, and there is no uniqueness or foreign-key link to domain tables, so orphaned events can accumulate. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1722-L1734】
- **Null handling**: Mapping functions frequently default to `null` without downstream checks (e.g., bank account, contact fields), which could violate NOT NULL constraints if schema tightens later. 【F:supabase/functions/buildium-webhook/index.ts†L34-L115】

## Recommendations and Action Plan

- **Implement webhook verification (High)**: Validate `x-buildium-signature` using the shared secret and reject on mismatch; log signature failures and avoid processing. Add tests covering valid/invalid signatures. 【F:supabase/functions/buildium-webhook/index.ts†L262-L270】【F:supabase/functions/buildium-lease-transactions/index.ts†L315-L322】
- **Enforce idempotency (High)**: Make `event_id` NOT NULL with a unique index; handle duplicate insert conflicts; guard processing by checking prior success/processing status before work. Add checksum of payload for dedupe when Buildium IDs are absent. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1722-L1734】
- **Robust validation and routing (High)**: Validate payload shape and EventType enumeration, returning 400 for malformed bodies. Expand routing to cover delete and additional entity events or explicitly dead-letter unknown types with alerting. 【F:supabase/functions/buildium-webhook/index.ts†L314-L382】
- **Retry and dead-letter (Medium)**: Use `retry_count`/`max_retries` with exponential backoff and a dead-letter queue/view for manual replay; avoid marking failed events processed. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L1727-L1734】【F:supabase/functions/buildium-webhook/index.ts†L314-L340】
- **Safer data mapping (Medium)**: Harden owner/property mapping to update changed values, reconcile ownership relations, and surface missing bank accounts/IDs as warnings with metrics. 【F:supabase/functions/buildium-webhook/index.ts†L34-L115】【F:supabase/functions/buildium-webhook/index.ts†L420-L455】
- **Secure internal calls (Medium)**: Replace raw service-key usage with signed JWT or Supabase function call using proper auth headers and org scoping; ensure payload includes tenant context. 【F:supabase/functions/buildium-webhook/index.ts†L393-L455】
- **Improve observability (Low)**: Include event IDs, EventType, org identifiers, and entity IDs in logs; add metrics for success/failure counts and processing latency. 【F:supabase/functions/buildium-webhook/index.ts†L314-L341】
- **Retire or implement SQL stubs (Low)**: Remove unused SQL webhook functions or implement them to match edge-function behavior to reduce confusion. 【F:supabase/migrations/20240101000001_001_initial_schema.sql†L591-L653】【F:supabase/migrations/20240101000001_001_initial_schema.sql†L938-L995】

## Open Questions / Clarifications

1. Should webhook handling be centralized in SQL functions or edge functions, and which pipeline is authoritative for idempotency and retries?
2. What Buildium EventNames are expected for deletes and other entities (GL accounts, vendors, bills, tasks), and should they be supported now or dead-lettered?
3. How should we scope events to organizations/tenants when Buildium IDs are not globally unique across orgs?
4. What is the required SLA for webhook processing latency and acceptable retry strategy (count, backoff, alerting)?
5. Are ownership updates (owner ↔ property) expected in webhook payloads, and how should missing bank account mappings be resolved automatically versus deferred to full sync?

## Delete Event Mapping

- Lease transactions: `LeaseTransactionDeleted`, `LeaseTransaction.Deleted`
- Leases/tenants: `LeaseDeleted`, `Lease.Deleted`, `LeaseTenantDeleted`, `LeaseTenant.Deleted`, `LeaseTenantMoveOut`, `MoveOutDeleted`, `MoveOut.Deleted`
- Bills/payments: `BillDeleted`, `Bill.Deleted`, `Bill.PaymentDeleted`, `BillPaymentDeleted`, `Bill.Payment.Deleted`
- GL accounts: `GLAccountDeleted`, `GLAccount.Deleted`
- Rentals/units: `RentalDeleted`, `Rental.Deleted`, `RentalPropertyDeleted`, `RentalProperty.Deleted`, `RentalUnitDeleted`, `RentalUnit.Deleted`
- Tasks/categories: `TaskDeleted`, `Task.Deleted`, `TaskCategoryDeleted`, `TaskCategory.Deleted`
- Vendors/categories: `VendorDeleted`, `Vendor.Deleted`, `VendorCategoryDeleted`, `VendorCategory.Deleted`
- Work orders: `WorkOrderDeleted`, `WorkOrder.Deleted`
- Bank accounts: `BankAccountDeleted`, `BankAccount.Deleted`

See `docs/buildium-webhook-mappings.md` for full EventName → payload/schema → table mapping and FK expectations.
