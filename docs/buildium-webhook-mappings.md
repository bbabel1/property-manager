# Buildium Webhook Event Mapping Guide

Authoritative mapping of Buildium webhook EventNames to expected payload shape, transformations, and target tables/columns. Use this as the single source of truth when adding new EventNames or handlers.

## Conventions and Required Envelope Fields

- All events require `EventId/Id`, `EventType/EventName`, and a valid `EventDate/EventDateTime`.
- Delete events must include the primary Buildium identifier; missing IDs are dead-lettered (`unknown-delete`).
- Buildium → DB foreign keys always use the `buildium_*` columns noted below.

## Event Mappings

### Rental / Property (`RentalCreated/Updated/Deleted`, `RentalProperty*`)

- **Payload IDs (required):** `PropertyId`; optional `AccountId` (org scope), `OperatingBankAccountId`.
- **Transform:** `mapPropertyFromBuildiumWithBankAccount` (includes bank account resolution).
- **Target:** `properties` (`buildium_property_id`, address fields, bank linkage).
- **FK expectations:** `PropertyId` → `properties.buildium_property_id`; `AccountId` → `organizations.buildium_org_id`.
- **Deletes:** remove property row; downstream units are retained unless separately deleted.

### Rental Unit (`RentalUnitCreated/Updated/Deleted`)

- **Payload IDs (required):** `UnitId`, `PropertyId`.
- **Transform:** `mapUnitFromBuildium`.
- **Target:** `units` (`buildium_unit_id`, `property_id` via `PropertyId` lookup).
- **FK expectations:** `UnitId` → `units.buildium_unit_id`; `PropertyId` → `properties.buildium_property_id`.
- **Deletes:** remove unit row.

### Lease (`LeaseCreated/Updated/Deleted`)

- **Payload IDs (required):** `LeaseId`; optional `PropertyId`, `UnitId`.
- **Transform:** `mapLeaseFromBuildiumLocal` + `upsertLeaseWithPartiesLocal` (contacts/tenants).
- **Target:** `lease`, `lease_contacts`, `tenants`, `contacts`.
- **FK expectations:** `PropertyId` → `properties.buildium_property_id`; `UnitId` → `units.buildium_unit_id`; tenant links via `tenants.buildium_tenant_id`.
- **Deletes:** remove lease row, null monthly_logs, delete lease_contacts.

### Lease Transaction (`LeaseTransactionCreated/Updated/Deleted`)

- **Payload IDs (required):** `TransactionId`, `LeaseId`.
- **Transform:** `upsertLeaseTransactionWithLinesLocal`.
- **Target:** `transactions` (`buildium_transaction_id`, `lease_id`), `transaction_lines` (GL, property/unit linkage).
- **FK expectations:** `LeaseId` → `lease.buildium_lease_id`; GL via `GLAccountId` → `gl_accounts.buildium_gl_account_id`; property/unit via line AccountingEntity IDs.
- **Deletes:** remove `transactions` and `transaction_lines` for the Buildium transaction.

### Lease Tenant / MoveOut (`LeaseTenant*`, `MoveOut*`)

- **Payload IDs (required):** `TenantId`; `LeaseId` required for move-outs.
- **Transform:** `fetchLeaseTenant` + contact/tenant upsert, `updateLeaseContactStatuses`; move-outs update `lease_contacts.move_out_date` and `notice_given_date`.
- **Target:** `contacts`, `tenants`, `lease_contacts`.
- **FK expectations:** `TenantId` → `tenants.buildium_tenant_id`; `LeaseId` → `lease.buildium_lease_id`.
- **Deletes:** remove tenant row and related lease_contacts.

### Bill (`BillCreated/Updated/Deleted`)

- **Payload IDs (required):** `BillId`.
- **Transform:** `fetchBill` + `upsertBillWithLines`.
- **Target:** `transactions` (`buildium_bill_id`), `transaction_lines` (GL/property/unit).
- **FK expectations:** `BillId` → `transactions.buildium_bill_id`; GL via `GLAccountId`; property/unit via line AccountingEntity.
- **Deletes:** remove bill transaction(s) and lines.

### Bill Payment (`Bill.Payment*`, `BillPayment*`)

- **Payload IDs (required):** `PaymentId`, `BillIds[]`.
- **Transform:** `fetchBillPayment` + `upsertBillPaymentWithLines`.
- **Target:** `transactions` (`buildium_transaction_id`, `buildium_bill_id`), `transaction_lines`.
- **FK expectations:** `PaymentId` → `transactions.buildium_transaction_id`; `BillIds` → `transactions.buildium_bill_id`; GL via line `GLAccountId`; bank via `BankAccountId`.
- **Deletes:** remove payment transaction and lines.

### GL Account (`GLAccountCreated/Updated/Deleted`)

- **Payload IDs (required):** `GLAccountId`; optional `AccountId` (org scope).
- **Transform:** `mapGLAccountFromBuildiumWithSubAccounts`.
- **Target:** `gl_accounts` (`buildium_gl_account_id`, `buildium_parent_gl_account_id`, `sub_accounts`).
- **FK expectations:** `GLAccountId` → `gl_accounts.buildium_gl_account_id`; `ParentGLAccountId` → same column; `AccountId` → `organizations.buildium_org_id`.
- **Deletes:** remove GL account and prune it from parents’ `sub_accounts`.

### Rental Owner (`RentalOwnerCreated/Updated/Deleted`)

- **Payload IDs (required):** `RentalOwnerId`; optional `PropertyIds[]`, `AccountId`.
- **Transform:** `upsertOwnerFromBuildium` + ownership creation.
- **Target:** `owners` (`buildium_owner_id`), `ownerships` (`property_id` via `PropertyId` lookup).
- **FK expectations:** `PropertyIds` → `properties.buildium_property_id`; `AccountId` → `organizations.buildium_org_id`.
- **Deletes:** remove owner; ownerships removed implicitly with FK if cascades exist (verify before enabling).

### Task Category (`TaskCategoryCreated/Updated/Deleted`)

- **Payload IDs (required):** `TaskCategoryId`; optional `AccountId`.
- **Transform:** `upsertTaskCategory`.
- **Target:** `task_categories` (`buildium_category_id`).
- **FK expectations:** none beyond Buildium ID; org inferred from property/task when used.
- **Deletes:** remove task category row.

### Task (`TaskCreated/Updated/Deleted`)

- **Payload IDs (required):** `TaskId`; optional `TaskType`, `Property.Id`, `UnitId`, `OwnerId`, `TenantId`.
- **Transform:** `mapTaskFromBuildiumWithRelations`.
- **Target:** `tasks` (`buildium_task_id`, property/unit/owner/tenant links).
- **FK expectations:** `Property.Id` → `properties.buildium_property_id`; `UnitId` → `units.buildium_unit_id`; owner/tenant via respective `buildium_*` columns.
- **Deletes:** remove task row (tombstone if already absent).

### Vendor Category (`VendorCategoryCreated/Updated/Deleted`)

- **Payload IDs (required):** `VendorCategoryId`.
- **Transform:** `upsertVendorCategory`.
- **Target:** `vendor_categories` (`buildium_category_id`).
- **Deletes:** remove vendor category row.

### Vendor (`VendorCreated/Updated/Deleted`)

- **Payload IDs (required):** `VendorId`.
- **Transform:** `mapVendorFromBuildiumWithCategory` + contact resolution.
- **Target:** `vendors` (`buildium_vendor_id`, `vendor_category_id`), `contacts`.
- **Deletes:** currently acknowledged only (no deletion); tombstones if already absent.

### Work Order (`WorkOrderCreated/Updated/Deleted`)

- **Payload IDs (required):** `WorkOrderId`; optional `PropertyId`, `UnitId`, `VendorId`.
- **Transform:** `mapWorkOrderFromBuildiumWithRelations` (auto-creates vendor from Buildium if missing locally).
- **Target:** `work_orders` (`buildium_work_order_id`, property/unit/vendor links, cost/dates: `estimated_cost`, `actual_cost`, `scheduled_date`, `completed_date`, `notes`/`VendorNotes`).
- **FK expectations:** `PropertyId` → `properties.buildium_property_id`; `UnitId` → `units.buildium_unit_id`; `VendorId` → `vendors.buildium_vendor_id`.
- **Deletes:** remove work order row (tombstone if already absent).

### Bank Account (`BankAccountCreated/Updated/Deleted`)

- **Payload IDs (required):** `BankAccountId`.
- **Transform:** handled via sync functions (bank account sync) when invoked by webhook; not fully mapped in router yet.
- **Target:** `bank_accounts` (`buildium_bank_id`, GL linkage).
- **Deletes:** not currently executed; add before enabling delete toggle.

## Adding or Updating EventNames

1. Add the EventName to `SUPPORTED_EVENT_NAMES` and validation requirements (`supabase/functions/_shared/eventValidation.ts`).
2. Add delete variants to `src/lib/buildium-delete-map.ts` and update this doc.
3. Implement handler logic in `src/app/api/webhooks/buildium/route.ts` with explicit FK checks and error/tombstone paths.
4. Update tests where applicable (validation, delete-map, handler coverage).
