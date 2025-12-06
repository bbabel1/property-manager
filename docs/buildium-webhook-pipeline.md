# Buildium Webhook Pipeline (Edge + Next.js)

This document summarizes the end-to-end webhook flow so new EventNames and handlers stay aligned across Edge functions and the Next.js router.

## 1) Receipt & Signature Verification
- **Edge functions** (`supabase/functions/buildium-webhook`, `buildium-lease-transactions`): use `verifyBuildiumSignature` (HMAC with `BUILDIUM_WEBHOOK_SECRET`) to reject tampered payloads.
- **Next.js route** (`src/app/api/webhooks/buildium/route.ts`): verifies `x-buildium-signature`/`buildium-webhook-signature` headers using the same secret, with base64/hex fallback handling. Missing secrets are allowed in development only.

## 2) Normalization & Validation
- **Shared validator**: `supabase/functions/_shared/eventValidation.ts` enumerates supported EventNames and required IDs/dates per event family; missing IDs/dates => 400/invalid.
- **Normalization**: `normalizeBuildiumWebhookEvent` requires EventName + timestamp + primary ID and derives `{buildiumWebhookId, event_name, event_created_at, event_entity_id}`; invalid events are dead-lettered with status `invalid`.
- **Delete detection**: `src/lib/buildium-delete-map.ts` defines canonical delete EventNames; the router uses `looksLikeDelete` to avoid brittle string includes and dead-letters unknown-delete cases missing IDs.

## 3) Storage in `buildium_webhook_events`
- All ingest paths call `insertBuildiumWebhookEventRecord` to persist the raw payload with the compound unique key `(buildium_webhook_id, event_name, event_created_at)`.
- Duplicate deliveries are detected via the compound key; invalid payloads are stored as `status=invalid`.
- Next.js route also respects per-event toggle gating (`webhook_event_flags`), marking skipped events as `ignored`.

## 4) Processing & Per-Entity Flows
- **Edge: `buildium-webhook`**: handles a limited set (properties, owners, leases) and forwards others; processing is synchronous with retries; marks rows processed/errored.
- **Edge: `buildium-lease-transactions`**: only LeaseTransaction events; fetches transaction details and upserts transactions/lines; deletes remove transaction + lines.
- **Next.js route** (broad coverage):
  - **Properties/units**: `mapPropertyFromBuildiumWithBankAccount`, `mapUnitFromBuildium`; require property/unit IDs.
  - **Leases/tenants/move-outs**: `mapLeaseFromBuildiumLocal`, `upsertLeaseWithPartiesLocal`, `updateLeaseContactStatuses`; deletes prune lease + contacts; move-outs update `lease_contacts` dates.
  - **Lease transactions**: `upsertLeaseTransactionWithLinesLocal`; double-entry integrity enforced; deletes remove transaction + lines.
  - **Bills/payments**: `upsertBillWithLines`, `upsertBillPaymentWithLines`; deletes remove bill/payment transactions + lines.
  - **GL accounts**: `mapGLAccountFromBuildiumWithSubAccounts`; deletes prune parent `sub_accounts`.
  - **Owners**: `upsertOwnerFromBuildium` + ownership creation; requires property links when provided.
  - **Tasks/task categories**: `mapTaskFromBuildiumWithRelations`, `upsertTaskCategory`; deletes remove rows or tombstone if already absent.
  - **Vendors/vendor categories**: `mapVendorFromBuildiumWithCategory`, `upsertVendorCategory`; vendor deletes acknowledged (no DB delete); categories deleted.
  - **Work orders**: `mapWorkOrderFromBuildiumWithRelations`; deletes remove row or tombstone if absent.
  - **Bank accounts**: currently received but not fully handled; add handlers before enabling deletes.

## 5) Idempotency & Error Handling
- Compound unique index on `(buildium_webhook_id, event_name, event_created_at)` prevents duplicates even when IDs are reused.
- Status fields: `processed`, `processed_at`, `status`, `error` updated in-place; tombstones used for already-absent deletes.
- Invalid/unknown-delete payloads are dead-lettered with structured errors; replays of identical events are treated as duplicates.

## 6) Validation/Drift Guardrails
- Tests under `tests/webhooks`:
  - `ingest-coverage.test.ts` ensures fixtures align with supported EventNames, validation, and delete detection.
  - `delete-map.test.ts`, `webhook-status.test.ts` guard helper behavior.
  - Fixtures in `tests/fixtures/buildium-events.ts` include create/update/delete and malformed variants; add new EventNames here when expanding coverage.
- Adding new EventNames: update validation (`SUPPORTED_EVENT_NAMES`), delete map, mapping doc (`docs/buildium-webhook-mappings.md`), and fixtures/tests to prevent silent drift.
