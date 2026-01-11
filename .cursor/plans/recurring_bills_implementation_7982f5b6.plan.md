---
name: Recurring Bills Implementation
overview: Add recurring bill functionality to the Bill Details page, allowing users to configure recurrence schedules, manage existing recurring settings, and automatically generate future bills based on schedules.
todos:
  - id: backend-types
    content: Create recurring bill types and Zod validation schema in src/types/recurring-bills.ts with split schedule model (monthly/quarterly/yearly vs weekly/every2weeks), canonical frequency values (Every2Weeks, Yearly), date-only fields, display label mapping, and server-owned field protection
    status: pending
  - id: backend-api
    content: Update PATCH endpoint in src/app/api/bills/[id]/route.ts to handle is_recurring and recurring_schedule with server-side validation, date-only handling, approval workflow integration (block like line edits), and blocking of server-owned fields (next_run_date, last_generated_at)
    status: pending
    dependencies:
      - backend-types
  - id: backend-engine
    content: Create recurring bill generation engine in src/lib/recurring-bills-engine.ts with split schedule model, timezone-aware date calculations, catch-up logic, duplicate prevention, and metadata storage (parent_transaction_id, instance_date, sequence)
    status: pending
    dependencies:
      - backend-types
  - id: backend-cron
    content: Create cron job script in scripts/cron/recurring-bills.ts with advisory locks, per-run metrics (generated/skipped/duplicates/errors, org ids), catch-up for missed instances, and idempotent reruns
    status: pending
    dependencies:
      - backend-engine
  - id: frontend-settings
    content: Create RecurringBillSettings component in src/components/bills/RecurringBillSettings.tsx with conditional fields (month/day vs day_of_week), pause/resume/disable actions with confirmations, timezone messaging, and read-only server-owned fields
    status: pending
    dependencies:
      - backend-types
  - id: frontend-badge
    content: Create RecurringBillStatusBadge component in src/components/bills/RecurringBillStatusBadge.tsx
    status: pending
    dependencies:
      - backend-types
  - id: frontend-details
    content: Add recurring section to Bill Details page in src/app/(protected)/bills/[billId]/page.tsx
    status: pending
    dependencies:
      - frontend-settings
      - frontend-badge
  - id: frontend-edit
    content: Integrate recurring settings into BillEditForm in src/components/bills/BillEditForm.tsx
    status: pending
    dependencies:
      - frontend-settings
  - id: validation-edge-cases
    content: Implement validation and edge case handling (approval workflow, timezone-aware date validation, month/day combinations, rollover policies, duplicate prevention with unique constraint, parent void/delete behavior, server-owned field blocking)
    status: pending
    dependencies:
      - backend-api
      - backend-engine
  - id: testing
    content: Create comprehensive unit and integration tests including frozen time, month-end/leap cases, weekly/biweekly anchors, idempotent cron reruns, pause/resume/disable flows, parent void/delete behavior, Buildium sync round-trips with timezone handling
    status: pending
    dependencies:
      - backend-engine
      - backend-api
      - frontend-settings
  - id: database-migration
    content: Create database migration for unique constraint on (parent_transaction_id, instance_date) and performance indexes
    status: pending
  - id: buildium-mapping
    content: Implement Buildium mapping with per-frequency mapping both directions, unsupported cadence handling, timezone preservation, and metadata preservation
    status: pending
    dependencies:
      - backend-types
      - backend-engine
---

# Recurring Bills Implementation Plan

## Overview

Add recurring bill functionality to the Bill Details page, enabling users to:

- Toggle recurrence on/off for bills
- Define frequency (Monthly, Weekly, Every2Weeks, Quarterly, Yearly) - UI shows "Biweekly" and "Annually" as display labels
- Choose billing dates (day of month)
- Set start/end dates for recurrence
- Manage existing recurring settings

## Architecture Decisions

- **Storage**: 
  - **Recommended**: Dedicated `bill_schedules` table (mirroring `charge_schedules` pattern) OR namespaced JSONB
  - **Fallback**: Use existing `transactions.is_recurring` (boolean) and `transactions.recurring_schedule` (jsonb) columns with namespacing
- **Frequency**: Use canonical enum values matching existing codebase: `Monthly | Weekly | Every2Weeks | Quarterly | Yearly`
  - UI displays "Biweekly" and "Annually" as display-only labels, mapped at the edge (same pattern as existing lease frequencies)
  - This prevents bugs where UI labels don't match DB queries or downstream logic
- **Schedule Model**: Split into two patterns:
  - **Monthly/Quarterly/Yearly**: Use `day_of_month` (1-31) + `month` (for quarterly/yearly) with explicit rollover policy
  - **Weekly/Every2Weeks**: Use `day_of_week` (0-6, Sunday=0) anchored to `start_date`, Every2Weeks = 14-day cadence
- **Date Storage**: Use date-only fields (YYYY-MM-DD strings or DATE columns) for schedule dates, consistent with how bills are rendered (timeZone: 'UTC')
  - `start_date`, `end_date`, `instance_date`, `next_run_date` are date-only
  - Keep `last_generated_at` as timestamptz for audit purposes
- **Timezone**: Use org timezone (default US/Eastern) for date calculations, but store dates as date-only
- **Status Tracking**: Store `status`, `next_run_date` (date-only), `last_generated_at` (timestamptz) in schedule
- **Recurrence Metadata**: Store `parent_transaction_id`, `instance_date` (date-only), `sequence` on generated bills
- **Idempotency**: Use `idempotency_key` pattern: `bill_recur:${parentId}:${instance_date}` for duplicate prevention

## Data Schema

### Storage Options

#### Option A: Dedicated `bill_schedules` Table (Recommended)

Mirror the `charge_schedules` pattern for consistency:

```sql
CREATE TABLE bill_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  parent_bill_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  frequency rent_cycle_enum NOT NULL, -- Monthly | Weekly | Every2Weeks | Quarterly | Yearly
  day_of_month INTEGER, -- 1-31, for Monthly/Quarterly/Yearly
  month INTEGER, -- 1-12, for Quarterly/Yearly
  rollover_policy TEXT, -- 'last_day' | 'next_month' | 'skip'
  day_of_week INTEGER, -- 0-6 (Sunday=0), for Weekly/Every2Weeks
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'ended'
  next_run_date DATE, -- server-owned, computed
  last_generated_at TIMESTAMPTZ, -- server-owned, audit
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_bill_transaction_id) -- one schedule per parent
);

CREATE INDEX idx_bill_schedules_org_active ON bill_schedules(org_id, status) WHERE status = 'active';
CREATE INDEX idx_bill_schedules_next_run ON bill_schedules(next_run_date) WHERE status = 'active' AND next_run_date IS NOT NULL;
```

Child bills store metadata in explicit columns:

```sql
ALTER TABLE transactions ADD COLUMN recurring_parent_transaction_id UUID REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN recurring_instance_date DATE;
ALTER TABLE transactions ADD COLUMN recurring_sequence INTEGER;
ALTER TABLE transactions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_transactions_recurring_instance 
  ON transactions(recurring_parent_transaction_id, recurring_instance_date) 
  WHERE recurring_parent_transaction_id IS NOT NULL;
CREATE INDEX idx_transactions_idempotency_key ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

#### Option B: Namespaced JSONB (Minimal Change)

If staying JSON-only, namespace the fields:

```typescript
type RecurringBillSchedule = {
  // Parent schedule config (for is_recurring = true bills)
  schedule?: {
    frequency: 'Monthly' | 'Weekly' | 'Every2Weeks' | 'Quarterly' | 'Yearly'
    
    // For Monthly/Quarterly/Yearly frequencies
    day_of_month?: number // 1-31, required for Monthly/Quarterly/Yearly
    month?: number // 1-12, required for Quarterly/Yearly (which month to bill)
    rollover_policy?: 'last_day' | 'next_month' | 'skip' // What to do if day doesn't exist in month
    
    // For Weekly/Every2Weeks frequencies
    day_of_week?: number // 0-6 (Sunday=0), required for Weekly/Every2Weeks, anchored to start_date
    
    // Common fields
    start_date: string // YYYY-MM-DD date string, required
    end_date?: string | null // YYYY-MM-DD date string, optional
    status: 'active' | 'paused' | 'ended' // Schedule status
    next_run_date?: string | null // YYYY-MM-DD date string, server-owned, computed
    last_generated_at?: string | null // ISO timestamp, server-owned, tracks last generation
    ended_at?: string | null // ISO timestamp, when status changed to 'ended'
  }
  
  // Child metadata (for is_recurring = false bills that are instances)
  instance?: {
    parent_transaction_id: string // UUID of parent bill
    instance_date: string // YYYY-MM-DD date string, timezone-normalized
    sequence: number // Sequential number (1, 2, 3, ...)
  }
  
  // Server-owned fields (client cannot set)
  // schedule.next_run_date, schedule.last_generated_at are computed and managed by server
}
```

### Generated Bill Metadata and Idempotency

**Storage approach** (if using dedicated table):

- Generated bills have `is_recurring = false` (they are instances, not templates)
- Store metadata in explicit columns: `recurring_parent_transaction_id`, `recurring_instance_date`, `recurring_sequence`
- Set `idempotency_key = bill_recur:${parentId}:${instance_date}` for natural idempotency
- This allows querying children by parent and prevents duplicates

**Storage approach** (if using JSONB):

- Generated bills have `is_recurring = false` (they are instances, not templates)
- Store metadata in `recurring_schedule.instance` jsonb namespace
- Set `idempotency_key = bill_recur:${parentId}:${instance_date}` for natural idempotency

**Idempotency Key Pattern**:

```typescript
const idempotencyKey = `bill_recur:${parentTransactionId}:${instanceDate}`
```

- Matches existing pattern from `recurring-engine.ts`
- Makes generation naturally idempotent
- Can still add unique constraint `(parent_transaction_id, instance_date)` for defense-in-depth

**Database Constraint**: Enforce unique `(parent_transaction_id, instance_date)` to prevent duplicates.

- If using dedicated columns: Use unique index on explicit columns
- If using JSONB: Use partial unique index on `recurring_schedule` jsonb fields
- `instance_date` is date-only (YYYY-MM-DD), no timezone normalization needed for comparison

## Implementation Steps

### Phase 1: Backend Foundation

#### 1.1 Create Recurring Schedule Types and Validation

- **File**: `src/types/recurring-bills.ts`
- Define `RecurringBillSchedule` type with split model (monthly/quarterly/yearly vs weekly/every2weeks)
- **Use canonical frequency values**: `'Monthly' | 'Weekly' | 'Every2Weeks' | 'Quarterly' | 'Yearly'`
- Create display label mapping: `{ Biweekly: 'Every2Weeks', Annually: 'Yearly' }` for UI
- Create Zod schema for validation with:
  - Conditional validation based on frequency type
  - Validate `day_of_month` (1-31) for Monthly/Quarterly/Yearly
  - Validate `day_of_week` (0-6) for Weekly/Every2Weeks
  - Validate `month` (1-12) for Quarterly/Yearly
  - Validate month/day combinations (e.g., Feb 30 invalid)
  - Validate `start_date >= bill.date` (date-only comparison)
  - Validate `end_date > start_date` if provided (date-only comparison)
  - Validate `end_date` not in past on create (date-only comparison)
  - **Block client from setting `next_run_date` or `last_generated_at`** (server-owned fields)
- Add helper functions for date calculations:
  - `computeNextRunDate(schedule, orgTimezone)`: Compute next billing date (returns YYYY-MM-DD)
  - `validateMonthDay(month, day)`: Validate month/day combinations
  - `applyRolloverPolicy(date, policy)`: Handle month-end edge cases
  - `generateIdempotencyKey(parentId, instanceDate)`: Generate `bill_recur:${parentId}:${instanceDate}`

#### 1.2 Update Bill API Endpoints

- **File**: `src/app/api/bills/[id]/route.ts`
- Extend PATCH endpoint to accept `is_recurring` and `recurring_schedule`
- **Approval Workflow Integration**:
  - **Treat recurrence settings as "structural"** like lines/amounts
  - Block recurring changes when `approval_state === 'approved'` (return 409, same as line edits)
  - If children exist, allow changing template lines/vendor going forward, but do NOT retroactively mutate children
- **Server-side validation**:
  - Block recurring changes on approved bills (409 error)
  - Validate schedule using Zod schema from `recurring-bills.ts`
  - **Strip `next_run_date` and `last_generated_at` from client payload** (server-owned)
  - Compute and set `next_run_date` based on schedule and org timezone (returns date-only YYYY-MM-DD)
  - Validate `start_date >= bill.date` (date-only comparison)
  - Validate `end_date > start_date` if provided (date-only comparison)
  - Validate `end_date` not in past on create (date-only comparison)
  - Validate month/day combinations (e.g., Feb 30 invalid, use rollover policy)
  - Validate `day_of_week` (0-6) for Weekly/Every2Weeks
  - Get org timezone (default US/Eastern) for date calculations, but store dates as date-only
- Store schedule in `recurring_schedule` jsonb column (or `bill_schedules` table if using Option A)
- Handle pause/resume/disable actions:
  - **Pause**: Set `status = 'paused'`, keep schedule intact
  - **Resume**: Set `status = 'active'`, recompute `next_run_date`
  - **Disable**: Set `status = 'ended'`, set `ended_at = now()`, keep history

#### 1.3 Create Recurring Bill Generation Engine

- **File**: `src/lib/recurring-bills-engine.ts`
- Create `generateRecurringBills(daysHorizon: number, options?: { orgId?: string })` function
- **Generation Rules**:
  - Query bills with `is_recurring = true` and `status = 'active'` in schedule (or query `bill_schedules` table)
  - Process per org (scope by `org_id`)
  - **Skip generation if**:
    - Parent bill is voided or deleted
    - Schedule `status = 'ended'` or `status = 'paused'`
    - `end_date` has passed (date-only comparison)
    - Parent bill approval state blocks generation
  - **Compute dates using org timezone** (default US/Eastern), but store as date-only (YYYY-MM-DD):
    - For Monthly/Quarterly/Yearly: Use `day_of_month` + `month` (if applicable)
    - Apply rollover policy for invalid month/day combos
    - For Weekly/Every2Weeks: Use `day_of_week` anchored to `start_date`, Every2Weeks = 14-day cadence
  - **Catch up missed instances**:
    - Use `last_generated_at` and `next_run_date` to identify missed dates
    - Generate bills for missed dates up to horizon
    - Update `last_generated_at` (timestamptz) after successful generation
  - **Generate child bills**:
    - **Status**: All children start as `draft` (not approved)
    - **Always set `org_id = parent.org_id`** (required for rendering)
    - **Copy from parent**:
      - `vendor_id`
      - `transaction_lines` (all line items with amounts, accounts, properties, units)
      - `memo`
      - `reference_number` (with sequence suffix if needed)
      - Tags/attachments (if applicable)
      - Allocations (property/unit allocations)
    - **Set dates** (date-only, YYYY-MM-DD):
      - `date`: Computed billing date (date-only)
      - `due_date`: Based on parent's due date offset or schedule (date-only)
    - **Store metadata**:
      - `recurring_parent_transaction_id`: Link to parent bill (or in JSONB namespace)
      - `recurring_instance_date`: Billing date (date-only, YYYY-MM-DD)
      - `recurring_sequence`: Sequential number (1, 2, 3, ...)
    - **Set idempotency key**: `idempotency_key = bill_recur:${parentId}:${instanceDate}`
    - **Enforce uniqueness**: Check `idempotency_key` first, then `(parent_transaction_id, instance_date)` before insert
  - **Idempotent reruns**: Check for existing bills with same `idempotency_key` before generating
  - **Update parent schedule**: Set `last_generated_at` (timestamptz) and recompute `next_run_date` (date-only) after generation

#### 1.4 Add Recurring Bill Generation Cron Job

- **File**: `scripts/cron/recurring-bills.ts`
- Similar pattern to `scripts/cron/recurring.ts`
- **Cron Safety Features**:
- **Advisory lock**: Use PostgreSQL advisory lock to prevent concurrent runs
    ```sql
        SELECT pg_advisory_lock(hashtext('recurring-bills-generation'))
    ```

- **Per-run metrics**: Track and log:
    - `generated`: Count of bills created
    - `skipped`: Count of bills skipped (duplicates, ended schedules, etc.)
    - `duplicates`: Count of duplicate attempts prevented
    - `errors`: Count of errors encountered
    - `org_ids`: List of orgs processed
- **Catch up missed instances**: 
    - Use `last_generated_at` and `next_run_at` from schedule
    - Generate bills for missed dates up to horizon
    - Handle timezone-aware date comparisons
- **Idempotent reruns**: Safe to rerun if interrupted
- **Error handling**: 
    - Continue processing other bills if one fails
    - Log errors with context (org_id, bill_id, error details)
    - Don't fail entire run on individual bill errors
- Call `generateRecurringBills(60)` for 60-day horizon
- Use org timezone (default US/Eastern) for all date calculations

### Phase 2: Frontend Components

#### 2.1 Create RecurringBillSettings Component

- **File**: `src/components/bills/RecurringBillSettings.tsx`
- Toggle switch for enabling/disabling recurrence
- Frequency dropdown (Monthly, Weekly, Biweekly, Quarterly, Annually) - map to canonical values (Every2Weeks, Yearly) at the edge
- **Conditional fields based on frequency**:
- **Monthly/Quarterly/Annual**: 
    - Day of month input (1-31, with validation)
    - Month selector (for Quarterly/Annual)
    - Rollover policy selector (last_day, next_month, skip)
    - Clear messaging about month/day validation and timezone
- **Weekly/Every2Weeks**:
    - Day of week selector (Sunday-Saturday)
    - Show message: "Billing day anchored to start date"
    - Show warning: "Weekly/Every2Weeks recurrence is local-only (not synced to Buildium)"
- Start date picker
- End date picker (optional)
- Display next billing date (computed, date-only, no timezone display needed)
- Show existing schedule if bill is already recurring
- **Action buttons**:
- **Pause**: Pause recurrence (sets `status = 'paused'`), with confirmation
- **Resume**: Resume paused recurrence (sets `status = 'active'`), with confirmation
- **Disable**: End recurrence (sets `status = 'ended'`), with confirmation dialog
- Validation feedback for invalid inputs
- **Date-only messaging**: Explain that all dates are date-only (YYYY-MM-DD), consistent with how bills are rendered
- **Server-owned field protection**: Never allow editing `next_run_date` or `last_generated_at` (read-only display)

#### 2.2 Integrate into Bill Details Page

- **File**: `src/app/(protected)/bills/[billId]/page.tsx`
- Fetch `is_recurring` and `recurring_schedule` from transaction
- Add new Card section after "Bill details" card
- Display recurring status badge if active
- Show schedule summary (frequency, next date, end date)
- Add "Edit Recurring Settings" button (if bill is draft/pending)
- Link to edit page with recurring section

#### 2.3 Add Recurring Section to BillEditForm

- **File**: `src/components/bills/BillEditForm.tsx`
- Add `RecurringBillSettings` component
- Include `is_recurring` and `recurring_schedule` in form state
- Submit recurring settings in PATCH payload
- Disable recurring section if bill is approved
- Show warning if disabling recurrence on active recurring bill

#### 2.4 Create RecurringBillStatusBadge Component

- **File**: `src/components/bills/RecurringBillStatusBadge.tsx`
- Display badge showing recurring status
- Show frequency and next billing date
- Different styles for active/paused/ended

### Phase 3: Edge Cases and Validation

#### 3.1 Approval Workflow Integration

- **Constraint**: Approved bills cannot modify recurring settings
- **Location**: `src/app/api/bills/[id]/route.ts`
- Check `approval_state` before allowing recurring changes
- Return 409 error with clear message

#### 3.2 Bill Deletion Protection

- **Constraint**: Recurring bills with generated children should warn before deletion
- **Location**: Bill deletion handlers
- Check for generated bills linked to parent
- Show warning in UI before deletion

#### 3.3 Date Validation

- **Validation Rules** (enforced server-side):
- **Month/Day combinations**: 
    - Validate `day_of_month` exists in target month (e.g., Feb 30 invalid)
    - Apply rollover policy for invalid combinations
    - Use org timezone for all validations
- **Day of week**: 
    - Validate `day_of_week` is 0-6 (Sunday=0) for Weekly/Biweekly
    - Must be anchored to `start_date`
- **Start date**: 
    - Must be >= bill date
    - Must be valid date in org timezone
- **End date**: 
    - Must be > start_date if provided
    - Cannot be in the past when creating
    - Must be valid date in org timezone
- **Server-owned fields**: 
    - **Block client from setting `next_run_at` or `last_generated_at`**
    - These are computed and managed by server only
    - Return 400 error if client attempts to set these fields

#### 3.4 Duplicate Prevention

- **Logic**: In `recurring-bills-engine.ts`
- **Primary**: Use `idempotency_key = bill_recur:${parentId}:${instanceDate}` pattern (matches existing recurring engine)
- Check for existing bills with same `idempotency_key` before generating
- **Defense-in-depth**: Also check unique constraint `(parent_transaction_id, instance_date)` if using explicit columns
- Skip generation if bill already exists (idempotency_key check is sufficient)

#### 3.5 Buildium Sync Considerations

- **Note**: Buildium has `IsRecurring` and `RecurringSchedule` fields, but only supports `Monthly | Quarterly | Yearly`
- **Location**: `src/lib/buildium-mappers.ts` and sync routes
- **Explicit frequency support**:
  - **Weekly/Every2Weeks are local-only**: Don't push recurring schedule to Buildium (would cause drift)
  - Mark as "Local-only recurrence" in UI when Weekly/Every2Weeks is selected
  - For Monthly/Quarterly/Yearly: map cleanly to Buildium format
  - Document rollover behavior difference (Buildium may not match your `rollover_policy`)
- **Define per-frequency mapping both directions**:
  - Map local frequencies (Monthly, Quarterly, Yearly) to Buildium format
  - Map Buildium frequencies to local format
  - Handle unsupported cadences gracefully (log warning, skip or use closest match)
- **Preserve local metadata**:
  - Preserve `parent_transaction_id`, `instance_date`, `sequence` on inbound sync
  - Don't overwrite local recurrence metadata unless explicit
- **Handle Buildium schedule states**:
  - Map Buildium paused/ended states to local `status`
  - Preserve `ended_at` timestamp if available
  - Avoid overwriting `ended` or `paused` schedules unless explicit user action
- **Round-trip sync**:
  - Ensure local → Buildium → local preserves all recurrence data (for supported frequencies)
  - Test date-only handling (Buildium uses dates, not timestamps)
  - Preserve history (generated bills, sequence numbers)

### Phase 4: UI/UX Enhancements

#### 4.1 Recurring Bills List View

- **File**: `src/app/(protected)/bills/page.tsx`
- Add filter for recurring bills
- Add column/badge to show recurring status
- Group recurring bills by parent (optional enhancement)

#### 4.2 Recurring Schedule Management

- **File**: `src/components/bills/RecurringBillSettings.tsx`
- **Action buttons with confirmations**:
- **Pause Recurrence**: Sets `status = 'paused'`, shows confirmation dialog
- **Resume Recurrence**: Sets `status = 'active'`, recomputes `next_run_at`, shows confirmation
- **Disable Recurrence**: Sets `status = 'ended'`, sets `ended_at = now()`, shows confirmation dialog with warning about keeping history
- Show history of generated bills (link to parent bills)
- Display count of generated bills
- Show schedule status badge (active/paused/ended)
- Display `next_run_at` and `last_generated_at` (read-only, server-owned fields)

#### 4.3 Visual Indicators

- Add recurring icon/badge to bill cards
- Show next billing date in tooltip
- Highlight bills that are part of recurring series

### Phase 5: Testing

#### 5.1 Unit Tests

- **File**: `tests/recurring-bills.test.ts`
- **Frozen time tests**: Use time mocking to test date calculations consistently
- **Schedule date calculations**:
- Test Monthly frequency with various `day_of_month` values
- Test Quarterly/Annual with month selection
- Test Weekly/Every2Weeks with `day_of_week` anchored to `start_date`
- Test Every2Weeks = 14-day cadence verification
- **Month-end and leap year cases**:
- Test Feb 28/29 in leap years
- Test months with 30 vs 31 days
- Test rollover policies (last_day, next_month, skip)
- Test invalid month/day combinations
- **Timezone handling**:
- Test date calculations with different org timezones
- Test timezone normalization for `instance_date`
- Test US/Eastern default timezone
- **Validation logic**:
- Test Zod schema validation
- Test server-side field blocking (`next_run_date`, `last_generated_at`)
- Test month/day validation
- Test date range validation

#### 5.2 Integration Tests

- **File**: `tests/bills.recurring.test.ts`
- **API endpoint tests**:
- Test creating recurring bills with various frequencies
- Test updating recurring settings (pause/resume/disable)
- Test server blocks `next_run_date` and `last_generated_at` from client
- Test validation errors (invalid month/day, past end_date, etc.)
- Test approval workflow blocks recurring changes
- **Bill generation engine tests**:
- Test generation for Monthly/Quarterly/Annual frequencies
- Test generation for Weekly/Every2Weeks frequencies
- Test local-only frequencies (Weekly/Every2Weeks) don't sync to Buildium
- Test duplicate prevention with unique constraint
- Test skip logic (voided parent, ended schedule, past end_date)
- Test catch-up for missed instances using `last_generated_at`
- Test timezone-aware date calculations
- **Cron job tests**:
- Test idempotent reruns using `idempotency_key` (safe to run multiple times)
- Test advisory lock prevents concurrent runs
- Test metrics collection (generated/skipped/duplicates/errors)
- Test error handling (continue on individual failures)
- **Parent void/delete behavior**:
- Test generation skips when parent is voided
- Test generation skips when parent is deleted
- Test existing children remain when parent voided/deleted
- Test history preservation

#### 5.3 E2E Tests

- **Full flow tests**:
- Create bill → enable recurrence → verify generation
- Test pause/resume/disable flows with confirmations
- Test editing recurring settings (frequency, dates, etc.)
- Test approval workflow with recurring bills
- **Buildium sync round-trips**:
- Test local → Buildium → local preserves recurrence data
- Test date-only handling in both directions (no timezone issues)
- Test unsupported cadence handling (Weekly/Every2Weeks marked as local-only)
- Test metadata preservation (parent_transaction_id, instance_date, sequence)
- Test ended/paused schedule preservation
- **UI/UX tests**:
- Test conditional field display (month/day vs day_of_week)
- Test validation feedback
- Test date-only messaging (no timezone display needed)
- Test pause/resume/disable confirmations
- Test read-only display of server-owned fields

## File Changes Summary

### New Files

- `src/types/recurring-bills.ts` - Type definitions and Zod schemas
- `src/lib/recurring-bills-engine.ts` - Bill generation logic
- `src/components/bills/RecurringBillSettings.tsx` - Recurring settings UI
- `src/components/bills/RecurringBillStatusBadge.tsx` - Status badge component
- `scripts/cron/recurring-bills.ts` - Cron job for bill generation
- `tests/recurring-bills.test.ts` - Unit tests
- `tests/bills.recurring.test.ts` - Integration tests

### Modified Files

- `src/app/(protected)/bills/[billId]/page.tsx` - Add recurring section
- `src/app/(protected)/bills/[billId]/edit/page.tsx` - Pass recurring data to form
- `src/components/bills/BillEditForm.tsx` - Add recurring settings section
- `src/app/api/bills/[id]/route.ts` - Handle recurring schedule updates
- `src/app/(protected)/bills/page.tsx` - Add recurring filter/badge (optional)

## Migration Considerations

### Database Migration

- **File**: `supabase/migrations/[timestamp]_add_recurring_bills_constraints.sql`
- **Add unique constraint** for generated bills:
  ```sql
    -- Add unique constraint on (parent_transaction_id, instance_date)
    -- This prevents duplicate bill generation
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_instance 
      ON transactions(
        (recurring_schedule->>'parent_transaction_id'), 
        (recurring_schedule->>'instance_date')
      ) 
      WHERE recurring_schedule->>'parent_transaction_id' IS NOT NULL;
  ```

- **Add indexes for performance**:
  ```sql
    -- Index for querying recurring bills
    CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring 
      ON transactions(is_recurring) 
      WHERE is_recurring = true;
    
    -- Index for finding children of a parent bill
    CREATE INDEX IF NOT EXISTS idx_transactions_parent_recurring 
      ON transactions((recurring_schedule->>'parent_transaction_id')) 
      WHERE is_recurring = false 
        AND recurring_schedule->>'parent_transaction_id' IS NOT NULL;
  ```

- **Backward compatibility**: Existing bills with `is_recurring = false` or `recurring_schedule = null` work as before
- **Data migration**: If needed, migrate any existing Buildium recurring bills to new format

## Security and Permissions

- Recurring settings require `bills.write` permission
- Approval workflow restrictions apply (approved bills cannot change recurring settings)
- RLS policies on `transactions` table already protect bill data

## Performance Considerations

- Bill generation engine should batch process bills
- Add database indexes (see migration section above for full SQL)
- Use `idempotency_key` index for primary duplicate prevention
- Use unique constraint `(parent_transaction_id, instance_date)` for defense-in-depth
- Consider pagination for large recurring bill lists
- Use advisory locks to prevent concurrent cron runs

## Future Enhancements (Out of Scope)

- Recurring bill templates