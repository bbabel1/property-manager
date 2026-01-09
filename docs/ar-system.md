# Accounts Receivable System Overview

This codebase now models tenant A/R using explicit charges, payment allocations, and control-account–aware posting rules.

## Core tables
- `charges`: authoritative receivables; `amount_open` is the live balance; supports `charge_schedule_id`, `parent_charge_id`, proration fields (`is_prorated`, `proration_days`, `base_amount`), and metadata (external_id, source, created_by).
- `payment_allocations`: links payment transactions to charges with deterministic `allocation_order`; unique on `(payment_transaction_id, charge_id)`.
- `org_control_accounts`: org-level control accounts (AR, undeposited funds, rent/late-fee income) validated before posting.
- `v_ar_receivables`: view that aggregates `charges.amount_open` for reporting.

## Charge creation
- `createChargeWithReceivable` (src/lib/ar-service.ts) creates the charge + receivable, posts the transaction, and stamps `metadata.charge_id`. Idempotent via `external_id`.
- Prorated recurring charges: recurring engine sets `is_prorated`, `proration_days`, and `base_amount`; monthly proration is day-based within the period.

## Payment allocation
- `AllocationEngine.allocatePayment` locks open charges (`SELECT … FOR UPDATE`), applies deterministic ordering, enforces uniqueness and idempotency, updates `amount_open`/`status`, and writes `payment_allocations`.
- Payment APIs use the allocation engine and return allocations + updated charges.

## Posting rules & metadata
- Posting rules require control accounts; tenant payments support undeposited funds vs. direct bank; NSF fee rule stamps `{reversal_of_payment_id, nsf_fee, payment_id}`.
- Transactions carry JSONB metadata with GIN indexes for `charge_id`, `payment_id`, `reversal_of_payment_id`.

## Reversals and NSF
- `reversePaymentWithNSF` unwinds allocations, posts a reversal with metadata, and optionally creates an NSF fee charge via the A/R service using org late-fee income.

## Monthly logs
- Calculations use `charges.amount_open` for balances; payment creation uses the allocation engine; responses include allocations and updated charge status.

## Recurring schedules
- `charge_schedules` drives recurring charges (org-scoped, GL-linked, timezone-safe dates, end conditions). Idempotency is schedule + occurrence date; proration handled for first/last partial months.
