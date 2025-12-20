# Service Management v2 Plan

Complete implementation plan for replacing the existing service management stack with configurable service plans, assignment-level pricing, deterministic scheduling, and strict billing idempotency.

## Plan Overview

- Configurable plan templates with assignment-level honored pricing (property or unit)
- Frequency windows and first-of-month scheduler
- Unit-level posting only, active leases only
- Plan fee and service add-ons post as separate GL lines
- Strict constraints and idempotent billing

## Additional Requirements

- Billing windows: weekly uses explicit week keys (Mon start, Sun end); unique key uses period_start/end. Tests must assert exact weeks per month.
- Plan-fee offering reuse: repurpose LEGACY_MGMT_FEE, rename to Management Fee, and ensure every plan fee uses that offering_id consistently.
- Assignment-mode enforcement: DB trigger plus API validation; all uniqueness/exclusion constraints scoped by org_id to prevent cross-tenant collisions.
- GL mapping: add management_fee_income to settings; org-service GL table must be RLS enforced before posting, with clear errors on missing/duplicate mappings.
- Applied-period hardening: add applied_period_start early (nullable) and backfill from monthly_log linkage to become source of truth for collected rent logic.
- Per-occurrence UX: manual entries still create billing_events + transactions and are excluded from scheduler; tests must assert this.
- Monthly log linkage: billing upserts monthly_logs using the same period key as the billing window (month start) for statement consistency.

## Action Plan

### A. Key Decisions

1) Billing run anchor period: job runs on the 1st and bills the prior period(s).
   - Monthly: prior calendar month
   - Quarterly: prior calendar quarter (Jan 1 bills Oct-Dec, Apr 1 bills Jan-Mar, etc.)
   - Annually: prior calendar year (Jan 1 bills prior Jan-Dec)
   - Weekly: generate all Mon-Sun weeks whose Sunday (week_end) falls in the billed month; deterministic, no double billing
2) Plan fee identity and GL mapping:
   - Require org-level Management Fee Income GL setting before billing
   - Use a dedicated plan-fee offering identity for billing_events and audit consistency
   - Reuse seeded pseudo-offering LEGACY_MGMT_FEE, rename display to Management Fee (migration 20250120120001_expand_service_o…)
3) Applied-to period source of truth for collected rent (accrual):
   - Short-term: collected rent = sum of Payment transaction_lines posted to Rent Income GL and linked to the billed period’s monthly logs
   - Hardening: add applied_period_start (DATE) on transaction_lines (or companion table) and backfill from monthly logs for deterministic scheduler queries

### B. End-User Experience

1) Property creation flow:
   - Replace legacy Management scope/fee assignment step with required Management Services step
   - Service Assignment Level (required): Property Level | Unit Level
   - If Property Level: must pick plan template and configure pricing now
   - If Unit Level: finish property creation then route to Configure Unit Plans wizard; every unit must have an assignment before completion (block completion banner)
   - Fix schema to enforce required selection (current Zod allows optional)
2) Property details -> Management Services (primary UI):
   - Read-only Assignment Mode (property-level or unit-level)
   - Plan Assignment: template (required), plan fee pricing (flat or %; basis Lease Rent Amount or Collected Rent), plan fee frequency (Weekly/Monthly/Quarterly/Annually; per-occurrence not allowed)
   - Included Services and Add-ons with assignment-level honored pricing; table shows service, included toggle, amount, frequency, GL account, status
   - Add/remove services (copy defaults from template on assignment creation); edit amounts anytime (mid-cycle edits apply to current billed window)
   - Preview: eligible units count (active leases), property-level fee split preview with deterministic rounding, next billed window preview
3) Unit details:
   - If property-level mode: show inherited plan/services read-only
   - If unit-level mode: full Plan + Services editor available
4) Per-occurrence manual entry:
   - Add Per-occurrence Charges panel on Unit details (optionally property view with unit selector)
   - Action: Add per-occurrence charge with fields service offering, amount > 0, service period date (or week/month selector)
   - Posts immediately at unit level, enforces GL mapping, creates billing_event + transaction; scheduler never auto-creates per-occurrence
5) Billing run observability:
   - Billing Runs UI (Accounting or Admin): shows last run timestamp, status, created charges count, errors; allows Run Now and safe re-run (idempotent)

### C. Target Architecture and Schema

1) Service Plans v2 tables (org scoped):
   - service_plans: org_id, name, amount_type, percent_basis, is_active, timestamps (templates; no money stored)
   - service_plan_services: plan_id, offering_id, default_amount, default_frequency, default_included
   - service_plan_assignments: org_id, property_id, unit_id nullable, plan_id, effective_start/end nullable, is_active; holds plan pricing fields (plan_fee_amount or plan_fee_percent, plan_fee_frequency)
   - service_assignment_services: assignment_id, offering_id, amount, frequency, is_included, effective_start/end nullable
   - org_service_offering_gl_accounts: (org_id, offering_id, gl_account_id not null) with unique (org_id, gl_account_id) and (org_id, offering_id); RLS enforced
   - Extend settings_gl_accounts to include management_fee_income (required)
2) Hard DB enforcement:
   - Single active assignment: unique(property_id) where unit_id is null and effective_end is null; unique(unit_id) where unit_id is not null and effective_end is null
   - No overlap effective ranges: exclusion constraints scoped by (org_id, property_id, unit_id)
   - Assignment mode enforcement: DB trigger rejects unit-level assignments when properties.service_assignment = 'Property Level' and rejects property-level when mode is 'Unit Level'; also enforce at API validation
   - Atomic edit applies immediately: stored procedure sets previous row’s effective_end = now() and inserts new row within one transaction
3) Billing idempotency:
   - billing_events add charge_type (plan_fee | service_fee | per_occurrence), assignment_id, service_period_start/end (DATE)
   - Unique key: (org_id, unit_id, offering_id, assignment_id, charge_type, service_period_start, service_period_end)
   - Transaction idempotency key: svc:{assignmentId}:{unitId}:{offeringId}:{chargeType}:{periodStart}:{periodEnd}
4) Rounding strategy:
   - Property-level plan fee split: compute unrounded per-unit = total / N; round down to cents for all units; distribute remaining pennies by deterministic ordering (ascending unit_id); assert sum(unit_amounts) == total

### D. Billing Engine Implementation

1) Scheduler behavior:
   - First-of-month job determines billed month = previous calendar month
   - Generates windows: monthly [month_start, month_end]; weekly all Mon-Sun weeks where week_end is inside billed month; quarterly/annual only on boundary months for prior quarter/year
2) Eligibility:
   - Post only to units with active leases: status = active (case-normalized); end_date is null or end_date > window_start
3) Fee calculations:
   - Plan fee flat: assignment.plan_fee_amount
   - Plan fee percent: Lease Rent Amount uses active lease monthly rent (no lease -> $0); Collected Rent sums payment allocations applied to window
   - Services: included or $0 -> no charge; per-occurrence never auto-generated; otherwise generate if due
4) Posting rules:
   - Each line item creates separate transaction
   - DR ar_lease; CR management_fee_income for plan fee, mapped GL for service add-ons
   - Use createCharge() for idempotency
5) Monthly logs integration:
   - On billing run, upsert monthly_logs for billed month for every eligible unit and attach created charges to monthly_log_id

### E. Phase / PR Stack

1) PR 1 — Phase 0: Freeze legacy writes and enforce creation requirements
2) PR 2 — Schema v2 and constraints
3) PR 3 — Service Plans v2 APIs
4) PR 4 — UI cutover: Properties and Units
5) PR 5 — Billing engine, idempotency, monthly logs
6) PR 6 — Monthly Logs Management Fees stage update
7) PR 7 — Migration/backfill and legacy shutdown

### F. Test Plan

- Unit tests: window generation, active lease eligibility, rounding exactness, idempotency, collected rent logic
- Integration tests: assignment mode enforcement, scheduler output correctness, per-occurrence exclusion, GL mapping blockers
