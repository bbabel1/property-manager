# Buildium Vendors + Accounts Payable Guide

This guide summarizes how vendor bills, approvals, payments, and credits flow through the system and how Buildium sync aligns with that model.

## Bill creation workflow
- Bills are ledger-native `transactions` with `transaction_type = 'Bill'` and org scoping on `org_id`.
- Creation uses the `post_transaction` RPC for atomic header + lines; A/P credit line must balance debits.
- `org_id` is required; A/P account resolves via `resolve_ap_gl_account_id()` and property/unit context.
- Buildium sync maps the bill header + lines; Buildium bill IDs are stored on `transactions.buildium_bill_id`.

## Approval process
- Approval state lives in `bill_workflow` (not the transaction). States: `draft`, `pending_approval`, `approved`, `rejected`, `voided`.
- Submit/approve/reject/void endpoints: `/api/bills/[id]/submit|approve|reject|void` with permission gates (`bills.write`, `bills.approve`, `bills.void`).
- Audit trail in `bill_approval_audit`; void creates a reversing bill via `void_bill()` and sets workflow to `voided`.
- Approved bills are read-only for amounts/lines; only memo/reference edits are allowed until void/reject.

## Payment processing
- Payments/checks are `transactions` with `transaction_type` of `Payment`/`Check`; org/bank GL context is required.
- Applications are stored in `bill_applications` (many-to-many) allowing multi-bill and partial payments.
- Status recompute is driven by `bill_applications` with DB triggers and `recompute_bill_status()`.
- Reconciled payments are locked via `is_reconciled` flag and triggers/policies; application edits are blocked when reconciled.
- API contract:
  - `POST /api/payments` → `{ bank_account_id, amount, payment_date, bill_allocations[] }` (allocations must sum to amount; bank + bills must share org; bank must be a bank account)
  - `POST /api/bills/{id}/applications` → apply existing payment/credit to bill; 409 on reconciled source; 422 on validation
  - `DELETE /api/bills/{id}/applications/{applicationId}` → remove application unless source is reconciled

## Vendor credits
- Credits/refunds are `transactions` with `transaction_type = 'VendorCredit'` (or refund) and applied via `bill_applications` with `source_type = 'credit'` or `refund`.
- Credit endpoints: `/api/vendor-credits` to create, `/api/vendor-credits/[id]/apply` to apply allocations.
- Credits reduce bill status/payable and are excluded from 1099 totals.
- API contract:
  - `POST /api/vendor-credits` → `{ vendor_id, credit_date, amount, gl_account_id, bill_allocations? }`; credit GL must be non-bank, org-aligned; allocations ≤ amount
  - `POST /api/vendor-credits/{id}/apply` → allocate existing credit to bills; 409 if credit reconciled; org + validation enforced

## Buildium sync
- Bills sync with approval state to Buildium; BillCreated/BillUpdated webhooks create/update workflow as `approved` (Buildium bills are pre-approved).
- Bill payments (outbound) include `BillIds[]` built from `bill_applications`; inbound BillPaid with `BillIds[]` creates applications per bill.
- Vendor transactions (credits/refunds):
  - Inbound: upsert vendor credit transaction and apply `bill_applications` (source_type `credit`/`refund`) from Buildium payload.
  - Outbound: best-effort mirror using Buildium vendor credit endpoint (requires `vendors.buildium_vendor_id`); stores returned `buildium_transaction_id`; failures are non-blocking and logged.
- Reconciliation locks and void workflows are honored locally; Buildium zero-out/void flows use `void_bill()` semantics. Approval conflicts default to local state and log for review.

## Backfill + reporting runbook
- Script: `scripts/backfill-bill-workflow-and-applications.ts`
  - DRY RUN: `DRY_RUN=true npx tsx scripts/backfill-bill-workflow-and-applications.ts`
  - Live: `npx tsx scripts/backfill-bill-workflow-and-applications.ts`
  - Outputs `backfill-report-<timestamp>.json` with org counts, workflows/applications created, AP-account resolution, failures.
- AP account fixes: if report shows missing `ap_gl_account_id`, create/choose an A/P GL (`sub_type = AccountsPayable`, non-bank) and update `organizations.ap_gl_account_id`, then rerun the script.
- Post-run checks:
  - Sample bills have `bill_workflow.approval_state` populated (approved if legacy payments existed).
  - `bill_applications` created for legacy `bill_transaction_id` links; `transactions.status` reflects applications.
  - Any orgs missing `ap_gl_account_id` are listed in report and should be resolved manually or via `resolve_ap_gl_account_id()`.

## Verification checklist (smoke)
- Pick a bill with applications: status shows payable + approval badge; applications list shows reconciliation locks where applicable.
- Create vendor payment via UI/API: allocations must equal amount; succeeds and applications reflect BillIds; reconciled sources blocked.
- Create vendor credit and apply: credit GL is non-bank; allocations reduce bill balance; reconciled credits blocked.
- Buildium webhook BillPayment with `BillIds[]` creates applications; VendorTransaction (credit/refund) ingests credit and applies allocations when provided.
