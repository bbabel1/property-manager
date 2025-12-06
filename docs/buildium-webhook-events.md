# Buildium Webhook Event Support

## Supported EventNames
- `PropertyCreated` / `PropertyUpdated`
- `OwnerCreated` / `OwnerUpdated`
- `LeaseCreated` / `LeaseUpdated`
- `LeaseTransactionCreated` / `LeaseTransactionUpdated` / `LeaseTransactionDeleted` (`LeaseTransaction.Deleted`)

## Required Fields
- Common: `Id` (or `EventId`), `EventDate` or `EventDateTime`
- Property/Owner/Lease events: `EntityId`
- Lease transaction events: `TransactionId` (or `EntityId`/`Data.TransactionId`), `LeaseId`

## Mapping Notes
- `buildium_webhook_id`: normalized from `Id|EventId|TransactionId|LeaseId|EntityId` with timestamp fallback
- `event_name`: `EventType | EventName`
- `event_created_at`: `EventDateTime | EventDate`
- `event_entity_id`: `EntityId | LeaseId | TransactionId | PropertyId | UnitId | BillId`
- Payloads are stored verbatim in `event_data`/`payload`

## Validation
- Requests missing required fields are flagged with `invalid-payload` and skipped.
- Unknown `EventName` values are rejected before processing.

## Tests/Fixtures
- `supabase/functions/_shared/eventValidation.test.ts` covers valid property events, missing fields, unsupported events, and partial payloads.
- `supabase/functions/_shared/webhookEvents.test.ts` covers normalization/duplicates with partial or missing fields.
