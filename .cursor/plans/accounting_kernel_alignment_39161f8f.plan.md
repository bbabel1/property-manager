---
name: Accounting Kernel Alignment
overview: Transform the repository's accounting system into a Buildium-aligned Accounting Kernel with double-entry GL, COA with property/unit scoping, enforced balanced journal entries, a unified posting engine for all business events, and immutable posted transactions with systematic reversals.
todos:
  - id: phase1-invariants
    content: Define accounting invariants and semantics - business_amount vs GL net, one accounting entity per transaction. Document conventions.
    status: pending
  - id: phase2-atomic-posting-rpc
    content: Create atomic posting RPC post_transaction(p_header jsonb, p_lines jsonb) using existing replace_transaction_lines() and validate_transaction_balance(). Enforce all-or-nothing correctness.
    status: pending
  - id: phase3-central-posting-engine
    content: Create unified PostingEngine (TS) with posting rules for all event types. Migrate createCharge() to use atomic RPC via rules. Use existing org GL settings.
    status: pending
    dependencies:
      - phase2-atomic-posting-rpc
  - id: phase4-transaction-scoping
    content: Add property_id, unit_id, account_entity_type, account_entity_id to transactions header. Enforce all lines match header scope. Keep gl_accounts org-scoped only.
    status: pending
    dependencies:
      - phase3-central-posting-engine
  - id: phase5-locking-reversals
    content: Add locked_at, locked_reason, locked_by_user_id, reversal_of_transaction_id to transactions. DB-enforced immutability via triggers. Org-level config table for gradual rollout.
    status: pending
    dependencies:
      - phase4-transaction-scoping
  - id: phase6-business-amount
    content: Add business_amount/effective_amount and primary_gl_account_id to transactions. Clarify total_amount as signed sum of lines. Update APIs to use business_amount.
    status: pending
    dependencies:
      - phase4-transaction-scoping
  - id: phase7-reporting-extensions
    content: Extend existing GL reporting functions (gl_account_activity, gl_ledger_balance_as_of). Add unit-level filters, cash-basis variants, reconciliation-aware reporting.
    status: pending
    dependencies:
      - phase4-transaction-scoping
      - phase6-business-amount
---

# Acco

unting Kernel Alignment Plan

## Current State Assessment

The repository has partial accounting infrastructure but lacks a unified Accounting Kernel aligned with Buildium:**Existing:**

- `gl_accounts` table with types (Asset/Liability/Equity/Revenue/Expense), `org_id` scoping, hierarchical parent/child relationships
- `journal_entries` table linked to `transactions`
- `transactions` + `transaction_lines` with double-entry validation via database triggers
- Balance enforcement: `validate_transaction_balance()` function and deferred constraint trigger
- Partial posting: `createCharge()` function for charges, but no unified posting engine
- Transaction types for reversals (ReversePayment, etc.) but no systematic reversal mechanism

**Gaps:**

- No unified posting engine: business events create transactions directly via `createCharge()` (inserts header then lines separately, risking partial failures)
- Transaction scoping only on lines: `property_id`/`unit_id` exist on `transaction_lines` but not consistently on transaction header
- No atomic posting: current `createCharge()` can strand partial records if line insertion fails
- Ambiguity around `total_amount`: repository documents it as signed sum of lines (can drift toward 0), but no dedicated "business amount" field
- No immutability: transactions and lines can be edited after creation (journal entries have PUT endpoint)
- No systematic reversal mechanism: corrections require manual edits rather than creating reversal entries
- GL accounts treated as single source of truth for bank accounts; should remain org-scoped (not property/unit scoped)

## Implementation Plan

### Phase 1: Enhance GL Accounts for Property/Unit Scoping

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_gl_account_property_unit_scoping.sql`
- `src/types/database.ts` (update types)
- `docs/database/database-schema.md`

**Changes:**

1. Add optional `property_id` and `unit_id` columns to `gl_accounts` table (nullable, for company-level accounts)
2. Add check constraint: `unit_id` requires `property_id` (unit accounts must be property-scoped)
3. Add validation constraint: property/unit must belong to org (cross-org leakage prevention)
   ```sql
            CHECK (
              (property_id IS NULL OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND org_id = gl_accounts.org_id))
              AND
              (unit_id IS NULL OR EXISTS (SELECT 1 FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = unit_id AND p.org_id = gl_accounts.org_id))
            )
   ```




4. Add unique constraint on `(org_id, account_number, property_id, unit_id)`:

- Partial unique index for company-level accounts: `WHERE property_id IS NULL AND unit_id IS NULL`
- Full unique index for property-level accounts: `WHERE property_id IS NOT NULL AND unit_id IS NULL`
- Full unique index for unit-level accounts: `WHERE unit_id IS NOT NULL`

5. Add indexes: `idx_gl_accounts_property_id`, `idx_gl_accounts_unit_id`, `idx_gl_accounts_org_property_unit`
6. Update RLS policies to explicitly include property/unit scoping in visibility rules:

- Users can view GL accounts if they have org membership AND the account's property/unit (if any) is visible to them
- Add property-level and unit-level checks to existing org-scoped policies

7. Add migration to backfill property/unit context only where deterministic from transaction_lines usage; otherwise keep NULL

**Rationale:** Buildium supports unit-level accounting. This allows GL accounts to be scoped at company, property, or unit level, matching Buildium's model. Uniqueness constraints prevent ambiguous lookups, and validation ensures cross-org data leakage is prevented.

### Phase 2: Create Atomic Posting RPC

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_create_post_transaction_rpc.sql`
- `docs/database/atomic-posting-rpc.md` (new)

**Changes:**

1. Create database RPC function `post_transaction(p_header jsonb, p_lines jsonb, p_idempotency_key text, p_validate_balance boolean DEFAULT true)`:
   ```sql
         CREATE OR REPLACE FUNCTION post_transaction(
           p_header jsonb,
           p_lines jsonb,
           p_idempotency_key text DEFAULT NULL,
           p_validate_balance boolean DEFAULT true
         ) RETURNS uuid
         LANGUAGE plpgsql
         SECURITY DEFINER
         SET search_path = public
         AS $$
         DECLARE
           v_transaction_id uuid;
           v_existing_id uuid;
         BEGIN
           -- Check idempotency if key provided
           IF p_idempotency_key IS NOT NULL THEN
             SELECT id INTO v_existing_id
             FROM transactions
             WHERE idempotency_key = p_idempotency_key;
             
             IF v_existing_id IS NOT NULL THEN
               RETURN v_existing_id;
             END IF;
           END IF;
         
           -- Insert transaction header
           INSERT INTO transactions (...)
           SELECT ... FROM jsonb_populate_record(NULL::transactions, p_header)
           RETURNING id INTO v_transaction_id;
         
           -- Atomically replace lines (locks transaction, validates balance)
           PERFORM replace_transaction_lines(
             v_transaction_id,
             p_lines,
             p_validate_balance
           );
         
           RETURN v_transaction_id;
         EXCEPTION
           WHEN OTHERS THEN
             -- Automatic rollback on any error
             RAISE;
         END;
         $$;
   ```




2. Function behavior:

- Upsert/insert transaction header (with idempotency key check if provided)
- Call `replace_transaction_lines()` which:
- Locks transaction row with `FOR UPDATE`
- Deletes existing lines
- Inserts new lines from JSONB array
- Validates balance via `validate_transaction_balance()` if requested
- All within same transaction (atomic)
- Returns transaction UUID
- Raises exception on any error (automatic rollback)

3. Leverages existing primitives:

- Uses `replace_transaction_lines()` for atomic line replacement with locking
- Uses `validate_transaction_balance()` for double-entry enforcement
- Uses deferred constraint trigger for balance validation

**Rationale:** Solves the partial failure problem in current `createCharge()`. Provides database-guaranteed all-or-nothing correctness. Aligns with repository's "Phase 2 next steps" to migrate endpoints to SQL atomic functions.

### Phase 3: Create Central Posting Engine (TypeScript)

**Files:**

- `src/lib/accounting/posting-engine.ts` (new)
- `src/lib/accounting/posting-events.ts` (new)
- `src/lib/accounting/posting-rules.ts` (new)

**Files:**

- `src/lib/accounting/posting-engine.ts` (new)
- `src/lib/accounting/posting-events.ts` (new)
- `src/lib/accounting/posting-rules.ts` (new)
- Update `src/lib/posting-service.ts` (refactor `createCharge()`)

**Structure:**

```typescript
// Standardized event type enum
export type PostingEventType = 
  | 'rent_charge'
  | 'tenant_payment'
  | 'vendor_bill'
  | 'deposit'
  | 'owner_distribution'
  | 'reversal'
  | 'general_journal_entry'
  | 'recurring_charge'
  | 'late_fee'
  | 'bank_transfer'
  | 'other_transaction';

// Core posting event
export interface PostingEvent {
  eventType: PostingEventType
  eventData: RentChargeEvent | TenantPaymentEvent | ...
  orgId: string
  propertyId?: string
  unitId?: string
  accountEntityType?: 'Company' | 'Rental'
  accountEntityId?: number  // Buildium property ID for Rental
  postingDate: string  // Transaction date (affects GL balances)
  createdAt?: string   // Optional: separate from posting date for audit
  externalId?: string  // For idempotency: external system ID (e.g., Buildium transaction ID)
  idempotencyKey?: string  // Generated: `${externalId}_${eventType}` if externalId provided
  businessAmount?: number  // Absolute business amount (for UI/display)
  primaryGlAccountId?: string  // Primary GL account (for UI selection)
}

export interface PostingLine {
  gl_account_id: string
  amount: number  // Absolute amount (always positive)
  posting_type: 'Debit' | 'Credit'
  memo?: string
  property_id?: string  // Must match transaction header
  unit_id?: string      // Must match transaction header
}

export interface PostingRule {
  eventType: PostingEventType
  generateLines: (event: PostingEvent, glSettings: OrgGlSettings) => Promise<PostingLine[]>
  validate?: (event: PostingEvent) => Promise<void>
}

export class PostingEngine {
  async postEvent(event: PostingEvent): Promise<{ transactionId: string }>
}
```

**Implementation:**

1. Create `PostingEngine` class that:

- Routes events to appropriate posting rules
- Loads org GL settings via `getOrgGlSettingsOrThrow()` (existing pattern)
- Generates idempotency key: `${externalId}_${eventType}` when `externalId` provided
- Calls `post_transaction()` RPC with header and lines as JSONB
- Returns transaction ID

2. Convert existing `createCharge()` logic into posting rules:

- Extract line generation logic into `RentChargePostingRule`
- Use existing org GL settings (`settings_gl_accounts`) as rule inputs
- Rules generate balanced lines matching transaction scope

3. Create posting rules for:

- **Rent charges**: DR: AR Lease (from `glSettings.ar_lease`), CR: Rent Income (from `glSettings.rent_income`)
- **Tenant payments**: DR: Bank Account, CR: AR Lease
- **Vendor bills**: DR: Expense, CR: AP or Bank Account
- **Deposits**: DR: Bank Account, CR: Security Deposit Liability (from `glSettings.tenant_deposit_liability`)
- **Owner distributions**: DR: Owner Equity, CR: Bank Account
- **Reversals**: Invert all lines from original transaction (DR ↔ CR)

4. All rules generate balanced `transaction_lines` with property/unit matching transaction header
5. Engine calls atomic `post_transaction()` RPC (ensures all-or-nothing)
6. Distinguish `postingDate` (transaction date) from `created_at` (audit timestamp)

**Migration:**

- Refactor `src/lib/posting-service.ts` `createCharge()` to use `PostingEngine.postEvent()`
- Update business event handlers to use posting engine:
- `src/app/api/leases/[id]/charges/route.ts` → use posting engine
- `src/app/api/bank-accounts/[id]/record-deposit/route.ts` → use posting engine
- `src/app/api/bank-accounts/[id]/record-other-transaction/route.ts` → use posting engine
- `src/lib/recurring-engine.ts` → use posting engine
- Webhook handlers in `src/app/api/webhooks/buildium/route.ts` → use posting engine

**Rationale:** Centralizes posting logic, uses existing org GL settings pattern, and routes through atomic RPC for guaranteed correctness. Maintains backward compatibility while eliminating partial failure risk.

### Phase 4: Add Transaction Scoping to Header

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_transaction_header_scoping.sql`
- `src/lib/accounting/posting-engine.ts` (update)
- Update all transaction creation endpoints

**Changes:**

1. Add scoping columns to `transactions` table:

- `property_id` (uuid, FK → properties.id, nullable)
- `unit_id` (uuid, FK → units.id, nullable)
- `account_entity_type` (text, 'Company' | 'Rental', nullable)
- `account_entity_id` (integer, nullable) - Buildium property ID for Rental

2. Add check constraint: `unit_id` requires `property_id`
3. Use existing org guard trigger pattern (`enforce_same_org`) for cross-org validation:
   ```sql
         -- Use existing pattern from 20250911143000_065_org_integrity.sql
         CREATE TRIGGER transactions_property_org_guard
         BEFORE INSERT OR UPDATE ON transactions
         FOR EACH ROW
         WHEN (NEW.property_id IS NOT NULL)
         EXECUTE FUNCTION enforce_same_org('property_id', 'properties');
         
         CREATE TRIGGER transactions_unit_org_guard
         BEFORE INSERT OR UPDATE ON transactions
         FOR EACH ROW
         WHEN (NEW.unit_id IS NOT NULL)
         EXECUTE FUNCTION enforce_same_org('unit_id', 'units');
   ```




4. Add validation: all `transaction_lines` must match transaction header scope:
   ```sql
         CREATE OR REPLACE FUNCTION validate_transaction_scope()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $$
         BEGIN
           IF (SELECT property_id FROM transactions WHERE id = NEW.transaction_id) != NEW.property_id
              OR (SELECT unit_id FROM transactions WHERE id = NEW.transaction_id) != NEW.unit_id THEN
             RAISE EXCEPTION 'Transaction line scope must match transaction header scope';
           END IF;
           RETURN NEW;
         END;
         $$;
         
         CREATE TRIGGER trg_validate_transaction_scope
         BEFORE INSERT OR UPDATE ON transaction_lines
         FOR EACH ROW
         EXECUTE FUNCTION validate_transaction_scope();
   ```




5. Keep `gl_accounts` org-scoped only (no property/unit columns):

- GL accounts remain master data at org level
- Property/unit scoping lives on transactions (Buildium behavior)
- Prevents fragmenting canonical chart of accounts

6. Update `post_transaction()` RPC to populate scoping from header JSONB
7. Update `PostingEngine` to set transaction header scoping when creating transactions

**Rationale:** Matches Buildium's "one accounting entity per transaction" model. Scoping on transaction header (not gl_accounts) prevents fragmenting the chart of accounts while enabling property/unit-level reporting.

### Phase 5: Implement Locking and Reversals

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_transaction_locking.sql`
- `src/lib/accounting/reversals.ts` (new)
- `src/app/api/transactions/[id]/lock/route.ts` (new)
- `src/app/api/transactions/[id]/reverse/route.ts` (new)
- Update all transaction update endpoints

**Changes:**

1. Add locking columns to `transactions` table:

- `locked_at` (timestamptz, nullable)
- `locked_reason` (text, nullable) - e.g., 'posted', 'reconciled', 'closed_period'
- `locked_by_user_id` (uuid, FK → auth.users.id, nullable)
- `reversal_of_transaction_id` (uuid, FK → transactions.id, nullable) - original transaction being reversed

2. Add unique constraint to prevent double-reversal:
   ```sql
         CREATE UNIQUE INDEX idx_transactions_reversal_unique 
           ON transactions(reversal_of_transaction_id) 
           WHERE reversal_of_transaction_id IS NOT NULL;
   ```




3. Create database trigger function `prevent_locked_transaction_modification()`:
   ```sql
         CREATE OR REPLACE FUNCTION prevent_locked_transaction_modification()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $$
         DECLARE
           v_enforce boolean;
         BEGIN
           -- Check org config for gradual rollout
           SELECT enforce_immutability INTO v_enforce
           FROM org_accounting_config
           WHERE org_id = (SELECT org_id FROM transactions WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id));
           
           -- If config doesn't exist or is false, allow (with warning)
           IF v_enforce IS NOT TRUE THEN
             RETURN COALESCE(NEW, OLD);
           END IF;
           
           -- Check if parent transaction is locked
           IF EXISTS (
             SELECT 1 FROM transactions 
             WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id)
             AND locked_at IS NOT NULL
           ) THEN
             RAISE EXCEPTION 'Cannot modify locked transaction. Create a reversal instead.'
               USING ERRCODE = '23505';
           END IF;
           RETURN COALESCE(NEW, OLD);
         END;
         $$;
   ```




4. Create BEFORE UPDATE/DELETE triggers:

- On `transaction_lines`: prevent modifications when parent transaction is locked
- On `transactions`: prevent updates when locked (except for reversal linkage fields)

5. Create database function `lock_transaction(p_transaction_id uuid, p_reason text, p_user_id uuid)`:
   ```sql
         CREATE OR REPLACE FUNCTION lock_transaction(
           p_transaction_id uuid,
           p_reason text,
           p_user_id uuid DEFAULT auth.uid()
         ) RETURNS void
         LANGUAGE plpgsql
         SECURITY DEFINER
         AS $$
         BEGIN
           UPDATE transactions
           SET locked_at = now(),
               locked_reason = p_reason,
               locked_by_user_id = p_user_id
           WHERE id = p_transaction_id
             AND locked_at IS NULL;  -- Prevent double-locking
           
           IF NOT FOUND THEN
             RAISE EXCEPTION 'Transaction % not found or already locked', p_transaction_id;
           END IF;
         END;
         $$;
   ```




6. Create org-level config table for gradual rollout (not environment variable):
   ```sql
         CREATE TABLE IF NOT EXISTS org_accounting_config (
           org_id uuid PRIMARY KEY REFERENCES organizations(id),
           enforce_immutability boolean DEFAULT false,
           auto_lock_on_post boolean DEFAULT false,
           updated_at timestamptz DEFAULT now()
         );
   ```




7. Create `createReversal()` function in TypeScript:
   ```typescript
         export async function createReversal(params: {
           originalTransactionId: string
           reversalDate: string  // Can differ from original
           memo?: string
           orgId: string
         }): Promise<{ reversalTransactionId: string }>
   ```




- Fetches original transaction with lines
- Validates original is locked (raise exception if not locked)
- Checks for existing reversal (unique constraint prevents double-reversal)
- Validates `reversalDate` can differ from original (required for backdating)
- Inverts all lines (DR ↔ CR, keep amounts positive)
- Creates new transaction via `PostingEngine.postEvent()` with `eventType: 'reversal'`
- Links via `reversal_of_transaction_id`
- Auto-locks reversal transaction immediately via `lock_transaction()`

8. Create view `v_transaction_with_reversal` for reversal linkage:
   ```sql
         CREATE OR REPLACE VIEW v_transaction_with_reversal AS
         SELECT 
           t.*,
           r.id AS reversal_id,
           r.date AS reversal_date,
           r.memo AS reversal_memo,
           r.locked_at AS reversal_locked_at
         FROM transactions t
         LEFT JOIN transactions r ON r.reversal_of_transaction_id = t.id;
   ```


**API Changes:**

1. Add `POST /api/transactions/:id/lock` endpoint to lock transaction
2. Add `POST /api/transactions/:id/reverse` endpoint to create reversal
3. Update all transaction update endpoints to check `locked_at` flag
4. Update journal entry PUT endpoint to reject updates if transaction is locked

**Rationale:** DB-enforced immutability via triggers (not env vars) aligns with repository patterns. Org-level config allows gradual rollout. Locking provides audit trail and prevents accidental modifications. Reversals maintain Buildium-like correction workflow.

### Phase 6: Clarify Business Amount vs Total Amount

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_enhance_journal_entries.sql`
- `src/app/api/journal-entries/route.ts` (update)
- `src/app/api/journal-entries/[transactionId]/route.ts` (update)

**Changes:**

1. Add `org_id`, `property_id`, `unit_id` columns directly to `journal_entries` table (denormalize from transactions/transaction_lines for easier querying)
2. Add check constraint: `unit_id` requires `property_id`
3. Add validation constraint: property/unit must belong to org (cross-org leakage prevention)
4. Update journal entry creation/update to populate these fields from transaction context
5. Add indexes for org/property/unit scoping: `idx_journal_entries_org_id`, `idx_journal_entries_property_id`, `idx_journal_entries_unit_id`, `idx_journal_entries_org_property_unit`
6. Explicitly update RLS policies on `journal_entries` to include property/unit scope:

- Users can view journal entries if they have org membership AND the entry's property/unit (if any) is visible to them
- Property-level and unit-level visibility checks must be included

7. Add validation: all `transaction_lines` must match journal entry's property/unit scope (enforce at application level or via trigger)

**Rationale:** Makes journal entries easier to query and report on, matching Buildium's model where journal entries are directly scoped.

### Phase 7: Extend Existing Reporting Functions

- `src/app/api/general-ledger/route.ts` (enhance)
- Update existing reporting functions

**Changes:**

1. **Extend existing `gl_account_activity()` function** (from `20250912000002_070_gl_account_activity.sql`):

- Add `p_unit_id` parameter for unit-level filtering
- Filter by `transactions.unit_id` when provided (uses transaction header scoping)
- Ensure index-friendly: uses `transaction_lines.date`, `transactions.property_id`, `transactions.unit_id`

2. **Extend existing `gl_ledger_balance_as_of()` function** (from `20250912000005_073_reconciliation_variance.sql`):

- Add unit-level filtering via transaction header
- Add reconciliation-aware option: exclude unreconciled transactions if requested

3. **Extend existing `gl_trial_balance_as_of()` view/function** (from `20250829013000_031_gl_reporting_views.sql`):

- Add property/unit grouping options
- Support filtering by transaction header scope

4. **Add cash-basis variant** using `transaction_lines.is_cash_posting`:
   ```sql
         CREATE OR REPLACE FUNCTION gl_account_activity_cash_basis(
           p_property_id uuid,
           p_unit_id uuid DEFAULT NULL,
           p_start_date date,
           p_end_date date
         ) RETURNS TABLE (...)
         AS $$
         SELECT ...
         FROM transaction_lines tl
         JOIN transactions t ON tl.transaction_id = t.id
         WHERE t.property_id = p_property_id
           AND (p_unit_id IS NULL OR t.unit_id = p_unit_id)
           AND tl.date BETWEEN p_start_date AND p_end_date
           AND tl.is_cash_posting = true  -- Cash basis filter
         ...
         $$;
   ```




5. **Create view `v_transaction_with_reversal`** for reversal linkage:
   ```sql
         CREATE OR REPLACE VIEW v_transaction_with_reversal AS
         SELECT 
           t.*,
           r.id AS reversal_id,
           r.date AS reversal_date,
           r.memo AS reversal_memo,
           r.locked_at AS reversal_locked_at
         FROM transactions t
         LEFT JOIN transactions r ON r.reversal_of_transaction_id = t.id;
   ```




6. **Document sign conventions** (already defined in Phase 1):

- Balance = Debits - Credits for all accounts
- Debit-normal accounts (Assets/Expenses): positive = asset/expense increase
- Credit-normal accounts (Liabilities/Equity/Revenue): positive = liability/equity/revenue increase

7. **Update existing `get_property_financials`** to use transaction header scoping:

- Filter by `transactions.property_id` and `transactions.unit_id`
- Use new posting engine data for consistency

8. **Ensure index-friendly filters** (verify existing indexes):

- `transaction_lines.date` with index
- `transaction_lines.gl_account_id` with index
- `transactions.property_id` with index (added in Phase 4)
- `transactions.unit_id` with index (added in Phase 4)

**Rationale:** Extends existing reporting infrastructure rather than duplicating. Builds on proven patterns (`gl_account_activity`, `gl_ledger_balance_as_of`, `gl_trial_balance_as_of`). Adds unit-level filtering, cash-basis variants, and reconciliation-aware options as needed.

## Migration Strategy

1. **Backward Compatibility**: All changes must support existing data

- Existing transactions remain editable until explicitly posted
- Add migration to mark all existing transactions as `is_posted = false`
- Gradually migrate existing code to use posting engine

2. **Data Backfill Strategy**:

- **Transaction header scoping** (Phase 4): Derive from existing `transaction_lines`:
- If all lines for a transaction have same `property_id`, set `transactions.property_id`
- If all lines have same `unit_id`, set `transactions.unit_id`
- If transaction has `lease_id`, derive from lease → property → unit
- If mixed or unclear, keep NULL (company-level transaction)
- Run data audit query first to assess backfill feasibility
- Document backfill rationale in migration comments
- **Business amount backfill** (Phase 6): 
- For existing transactions, set `business_amount = ABS(total_amount)` if not set
- For balanced entries (total_amount ≈ 0), set from primary transaction line amount

3. **Constraint Validation**:

- Run constraint validations **after** data audit and backfill
- Validate property/unit belong to org: check for cross-org references (org guard triggers will catch this)
- Validate unit requires property: check for units without properties
- Validate transaction scope consistency: all lines must match header scope
- Fix violations before applying constraints (add migration step to clean data)

4. **Gradual Rollout for Immutability**:

- Use `org_accounting_config` table (not environment variable) for per-org rollout
- Create default config: `enforce_immutability = false` for all orgs
- Enable for test orgs first via UPDATE statement
- Monitor trigger warnings/exceptions in logs
- Gradually enable for production orgs after validation

5. **Testing Strategy**:

- Unit tests for posting engine rules
- Integration tests for posting/reversal workflows
- Migration tests to verify existing data integrity
- Data audit queries before migration to identify issues
- Constraint validation tests after migration

6. **Rollout Plan**:

- Phase 1: Define invariants (documentation only, no code changes)
- Phase 2: Atomic posting RPC (DB function, no breaking changes to existing code)
- Phase 3: Central posting engine (migrate createCharge() incrementally, maintain backward compatibility)
- Phase 4: Transaction header scoping (add columns, backfill data, enforce consistency)
- Phase 4.5: Run data audit, backfill transaction scoping, constraint validation
- Phase 5: Locking + reversals (create config table with `enforce_immutability = false` for all orgs)
- Phase 5.5: Enable immutability for test orgs only via config table
- Phase 6: Business amount clarification (add columns, backfill, update APIs)
- Phase 7: Extend reporting (build on existing functions, no breaking changes)
- Final: Enable immutability globally for all orgs via config table

## Database Schema Changes Summary

```sql
-- Phase 2: Atomic posting RPC (function only, no schema changes)

-- Phase 4: Transaction header scoping
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_entity_type text; -- 'Company' | 'Rental'
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_entity_id integer; -- Buildium property ID for Rental
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_unit_requires_property
  CHECK (unit_id IS NULL OR property_id IS NOT NULL);

-- Use existing org guard trigger pattern
CREATE TRIGGER transactions_property_org_guard
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.property_id IS NOT NULL)
EXECUTE FUNCTION enforce_same_org('property_id', 'properties');

CREATE TRIGGER transactions_unit_org_guard
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.unit_id IS NOT NULL)
EXECUTE FUNCTION enforce_same_org('unit_id', 'units');

-- Phase 5: Locking and reversals
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS locked_reason text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS locked_by_user_id uuid REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reversal_of_transaction_id uuid REFERENCES transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reversal_unique 
  ON transactions(reversal_of_transaction_id) 
  WHERE reversal_of_transaction_id IS NOT NULL;

-- Org-level config for gradual rollout
CREATE TABLE IF NOT EXISTS org_accounting_config (
  org_id uuid PRIMARY KEY REFERENCES organizations(id),
  enforce_immutability boolean DEFAULT false,
  auto_lock_on_post boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Phase 6: Business amount clarification
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_amount numeric;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS primary_gl_account_id uuid REFERENCES gl_accounts(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_unit_id ON transactions(unit_id);
CREATE INDEX IF NOT EXISTS idx_transactions_locked_at ON transactions(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of ON transactions(reversal_of_transaction_id) WHERE reversal_of_transaction_id IS NOT NULL;
```



## Success Criteria

1. **Invariants defined**: Business amount vs GL net clarified, one accounting entity per transaction documented
2. **Atomic posting**: All transactions created via `post_transaction()` RPC guarantee all-or-nothing correctness
3. **Central posting engine**: All business events (rent charges, payments, bills, deposits) use unified `PostingEngine` with standardized event types and idempotency keys
4. **Transaction scoping**: Property/unit scoping lives on transaction header (not gl_accounts), enforced via triggers. GL accounts remain org-scoped.
5. **Locked transactions immutable**: DB-enforced immutability via triggers prevents edits to locked transactions
6. **Systematic reversals**: Reversals can be created for any locked transaction with prevention of double-reversals via unique constraint
7. **Reversal dates flexible**: Reversal dates can differ from original transaction dates (backdating support)
8. **Business amount separation**: `business_amount` used for UI/display, `total_amount` used for GL calculations
9. **Extended reporting**: Existing GL functions extended with unit-level filtering, cash-basis variants, reconciliation-aware options
10. **Gradual rollout**: Org-level config table allows per-org immutability enforcement (not environment variable)