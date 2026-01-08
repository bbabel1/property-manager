---
name: Buildium Vendors and AP Alignment
overview: Complete the AP lifecycle by adding approval workflow, multi-bill/partial payment support via applications join table, void/reversal semantics, and bank reconciliation locks. Builds on existing transaction-based bill system rather than introducing duplicate tables.
todos: []
---

# Buildium Vendors + AP Alignment Plan

## Current State Analysis

### Existing Functionality (AP is Partially Implemented)

- **Vendors**: Table exists (`vendors`) with Buildium sync support, includes 1099 fields (`include_1099`, tax payer fields)
- **Bills**: Working bill workflow built on accounting kernel:
  - Bills stored as `transactions` with `transaction_type = 'Bill'`, `status = 'Due'`
  - Bill creation creates transaction header + debit expense lines + credit A/P line
  - Bill editing uses atomic `replace_transaction_lines()` RPC with balance validation
  - Route: `POST /api/bills` creates bills, `PATCH /api/bills/[id]` edits via `replace_transaction_lines`
- **Bill-Payment Linkage**: `transactions.bill_transaction_id` exists for linking payments/checks to bills
- **Status Computation**: Existing logic sums linked payments and sets `Paid`/`Partially paid`/`Overdue`/`Due` status
- **Vendor Credits**: `transaction_type = 'VendorCredit'` exists in enum
- **Vendor Payment Detection**: System recognizes vendor payments (Payment with no lease/unit) in ingestion logic
- **Buildium Parity**: Reference doc exists for Buildium record bill form structure

### Gaps Identified

1. **No approval workflow**: Missing draft → pending_approval → approved lifecycle separate from payable status
2. **No multi-bill/partial payment support**: `bill_transaction_id` only models 1:1 relationship, but Buildium supports payments applied to multiple bills
3. **No stable AP account config**: Current code uses name-based resolution (`gl_accounts.name ILIKE 'Accounts Payable'`) which is brittle
4. **Bill creation not atomic**: Currently inserts header then lines separately (manual rollback), should use `replace_transaction_lines` like edits
5. **Missing org_id on bill creation**: Bill creation omits `org_id` on header insert, causing RLS issues
6. **No void/reversal workflow**: Only hard delete exists (with safeguards), missing void semantics
7. **No reconciliation locks**: Missing checks to prevent editing/deleting reconciled payments
8. **No application tracking**: Missing join table to track which payments/credits are applied to which bills with amounts
9. **1099 reporting workflows**: Schema exists but missing yearly rollups, export, threshold enforcement

## Implementation Plan

### Phase 1: Foundation - Single Reversible Migration

**Migration**: `supabase/migrations/[timestamp]_foundation_ap_config_org_id_atomic_bills.sql`

**This is a prerequisite migration that must be applied before any overlay tables. It is reversible.**

1. **Stable AP Account Configuration**:
   - Add `ap_gl_account_id` column to `organizations` table (UUID, FK to `gl_accounts`, nullable)
   - Create helper function `resolve_ap_gl_account_id(p_org_id UUID) RETURNS UUID`:
     ```sql
     -- Priority: 1) org config, 2) sub_type match, 3) name fallback
     SELECT COALESCE(
       (SELECT ap_gl_account_id FROM organizations WHERE id = p_org_id),
       (SELECT id FROM gl_accounts WHERE org_id = p_org_id AND sub_type = 'AccountsPayable' LIMIT 1),
       (SELECT id FROM gl_accounts WHERE org_id = p_org_id AND name ILIKE 'Accounts Payable' LIMIT 1)
     );
     ```
   - Backfill `organizations.ap_gl_account_id` from existing name-based lookups
   - Update all A/P resolution code to use this function (see files list below)

2. **Ensure org_id on Bill Transactions**:
   - Add NOT NULL constraint on `transactions.org_id` (with backfill first)
   - Backfill `org_id` for existing bill transactions:
     - Resolve from `vendor_id` → `vendors.contact_id` → `contacts.org_id`
     - Resolve from `transaction_lines.property_id` → `properties.org_id`
     - Fallback: resolve from first non-null property in transaction_lines
   - Add check constraint: `transactions.org_id IS NOT NULL WHERE transaction_type = 'Bill'`

3. **Atomic Bill Creation Pattern**:
   - Update `POST /api/bills` route to:
     - Resolve `org_id` upfront from vendor/property context
     - Insert transaction header with `org_id` populated
     - Use `replace_transaction_lines()` RPC (same as bill edits) instead of separate inserts
     - Remove manual rollback logic (RPC handles atomicity)
   - Files to update:
     - `src/app/api/bills/route.ts` (bill creation)
     - `scripts/backfill-accounts-payable.ts` (use `resolve_ap_gl_account_id()`)
     - Any other places using `gl_accounts.name ILIKE 'Accounts Payable'`

4. **Migration Reversibility**:
   - All changes are additive (new column, new function, constraint after backfill)
   - Rollback script removes function, drops column, removes constraint
   - No data loss on rollback

### Phase 2: Overlay Tables - Applications and Workflow

**Migration**: `supabase/migrations/[timestamp]_create_bill_overlay_tables.sql`

**This creates the overlay tables that extend the transaction-based bill system. Must run after Phase 1.**

1. **`bill_applications` table** (many-to-many join for payments/credits applied to bills):
   - `id` (UUID, PK)
   - `org_id` (UUID, FK to organizations, NOT NULL)
   - `bill_transaction_id` (UUID, FK to transactions, NOT NULL - the bill)
   - `source_transaction_id` (UUID, FK to transactions, NOT NULL - payment or credit)
   - `source_type` (VARCHAR(20), NOT NULL: 'payment', 'credit', 'refund')
   - `applied_amount` (NUMERIC(15,2), NOT NULL)
   - `applied_at` (TIMESTAMPTZ, NOT NULL, default now())
   - `created_by_user_id` (UUID, FK to auth.users)
   - `created_at`, `updated_at` (TIMESTAMPTZ)
   
   **Constraints**:
   - `UNIQUE(bill_transaction_id, source_transaction_id)` - prevent duplicate applications
   - `CHECK(applied_amount > 0)` - positive amounts only
   - Check constraint: `source_transaction_id != bill_transaction_id` - cannot apply bill to itself
   
   **Indexes**:
   - `(bill_transaction_id)` for bill status computation
   - `(source_transaction_id)` for payment/credit queries
   - `(org_id)` for RLS
   - `(source_type, source_transaction_id)` for type-specific queries

2. **Validation Functions**:
   ```sql
   -- Validate application amount constraints
   CREATE OR REPLACE FUNCTION validate_bill_application(
     p_bill_id UUID,
     p_source_id UUID,
     p_amount NUMERIC
   ) RETURNS void AS $$
   DECLARE
     v_bill_total NUMERIC;
     v_source_total NUMERIC;
     v_applied_to_bill NUMERIC;
     v_applied_from_source NUMERIC;
   BEGIN
     -- Get bill total
     SELECT ABS(total_amount) INTO v_bill_total
     FROM transactions WHERE id = p_bill_id;
     
     -- Get source total
     SELECT ABS(total_amount) INTO v_source_total
     FROM transactions WHERE id = p_source_id;
     
     -- Sum existing applications to bill
     SELECT COALESCE(SUM(applied_amount), 0) INTO v_applied_to_bill
     FROM bill_applications
     WHERE bill_transaction_id = p_bill_id;
     
     -- Sum existing applications from source
     SELECT COALESCE(SUM(applied_amount), 0) INTO v_applied_from_source
     FROM bill_applications
     WHERE source_transaction_id = p_source_id;
     
     -- Validate: new application + existing <= source total
     IF (v_applied_from_source + p_amount) > v_source_total THEN
       RAISE EXCEPTION 'Application amount exceeds source transaction total. Applied: %, Total: %',
         v_applied_from_source + p_amount, v_source_total;
     END IF;
     
     -- Validate: new application + existing <= bill total (minus credits)
     -- Credits reduce payable, so subtract credit applications
     DECLARE
       v_credit_applications NUMERIC;
     BEGIN
       SELECT COALESCE(SUM(applied_amount), 0) INTO v_credit_applications
       FROM bill_applications
       WHERE bill_transaction_id = p_bill_id AND source_type IN ('credit', 'refund');
       
       IF (v_applied_to_bill + p_amount - v_credit_applications) > v_bill_total THEN
         RAISE EXCEPTION 'Application amount exceeds bill total. Applied: %, Total: %, Credits: %',
           v_applied_to_bill + p_amount, v_bill_total, v_credit_applications;
       END IF;
     END;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   -- Recompute bill status from applications
   CREATE OR REPLACE FUNCTION recompute_bill_status(p_bill_transaction_id UUID)
   RETURNS void AS $$
   DECLARE
     v_bill_total NUMERIC;
     v_payment_total NUMERIC;
     v_credit_total NUMERIC;
     v_net_payable NUMERIC;
     v_new_status transaction_status_enum;
     v_due_date DATE;
   BEGIN
     -- Get bill total and due date
     SELECT ABS(total_amount), due_date INTO v_bill_total, v_due_date
     FROM transactions WHERE id = p_bill_transaction_id;
     
     -- Sum payment applications
     SELECT COALESCE(SUM(applied_amount), 0) INTO v_payment_total
     FROM bill_applications
     WHERE bill_transaction_id = p_bill_transaction_id AND source_type = 'payment';
     
     -- Sum credit applications
     SELECT COALESCE(SUM(applied_amount), 0) INTO v_credit_total
     FROM bill_applications
     WHERE bill_transaction_id = p_bill_transaction_id AND source_type IN ('credit', 'refund');
     
     -- Net payable = bill total - payments - credits
     v_net_payable := v_bill_total - v_payment_total - v_credit_total;
     
     -- Determine status
     IF v_net_payable <= 0 THEN
       v_new_status := 'Paid';
       -- Set paid_date if not already set
       UPDATE transactions
       SET paid_date = COALESCE(paid_date, CURRENT_DATE)
       WHERE id = p_bill_transaction_id AND paid_date IS NULL;
     ELSIF v_payment_total > 0 THEN
       v_new_status := 'Partially paid';
     ELSIF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE THEN
       v_new_status := 'Overdue';
     ELSE
       v_new_status := 'Due';
     END IF;
     
     -- Update transaction status
     UPDATE transactions
     SET status = v_new_status, updated_at = now()
     WHERE id = p_bill_transaction_id;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

3. **Triggers for Status Recompute**:
   ```sql
   -- Trigger to recompute bill status after application changes
   CREATE OR REPLACE FUNCTION trg_recompute_bill_status()
   RETURNS trigger AS $$
   BEGIN
     IF TG_OP = 'DELETE' THEN
       PERFORM recompute_bill_status(OLD.bill_transaction_id);
       RETURN OLD;
     ELSE
       PERFORM recompute_bill_status(NEW.bill_transaction_id);
       RETURN NEW;
     END IF;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER trg_bill_applications_recompute_status
   AFTER INSERT OR UPDATE OR DELETE ON bill_applications
   FOR EACH ROW EXECUTE FUNCTION trg_recompute_bill_status();
   ```

4. **`bill_workflow` table** (1:1 with bill transaction):
   - `bill_transaction_id` (UUID, FK to transactions, PK, UNIQUE)
   - `org_id` (UUID, FK to organizations, NOT NULL)
   - `approval_state` (approval_state_enum: 'draft', 'pending_approval', 'approved', 'rejected')
   - `submitted_by_user_id` (UUID, FK to auth.users, nullable)
   - `submitted_at` (TIMESTAMPTZ, nullable)
   - `approved_by_user_id` (UUID, FK to auth.users, nullable)
   - `approved_at` (TIMESTAMPTZ, nullable)
   - `rejected_by_user_id` (UUID, FK to auth.users, nullable)
   - `rejected_at` (TIMESTAMPTZ, nullable)
   - `rejection_reason` (TEXT, nullable)
   - `voided_by_user_id` (UUID, FK to auth.users, nullable)
   - `voided_at` (TIMESTAMPTZ, nullable)
   - `void_reason` (TEXT, nullable)
   - `reversal_transaction_id` (UUID, FK to transactions, nullable - link to void reversal)
   - `created_at`, `updated_at` (TIMESTAMPTZ)
   
   **Enum**:
   ```sql
   CREATE TYPE approval_state_enum AS ENUM (
     'draft', 'pending_approval', 'approved', 'rejected'
   );
   ```
   
   **Indexes**: `(org_id)`, `(approval_state)`

5. **`bill_approval_audit` table**:
   - `id` (UUID, PK)
   - `bill_transaction_id` (UUID, FK to transactions)
   - `action` (VARCHAR(20): 'created', 'submitted', 'approved', 'rejected', 'voided')
   - `from_state` (approval_state_enum, nullable)
   - `to_state` (approval_state_enum, nullable)
   - `user_id` (UUID, FK to auth.users)
   - `notes` (TEXT, nullable)
   - `created_at` (TIMESTAMPTZ)
   
   **Indexes**: `(bill_transaction_id)`, `(created_at)`

6. **RLS Policies** (see Phase 3 for details):
   - `bill_applications`: Org-scoped read/write
   - `bill_workflow`: Org-scoped read/write
   - `bill_approval_audit`: Org-scoped read-only




### Phase 3: RLS Policies and Permissions

**Migration**: `supabase/migrations/[timestamp]_bill_overlay_rls_policies.sql`

1. **Permissions** (add to `src/lib/permissions.ts`):
   - `bills.read`
   - `bills.write`
   - `bills.approve`
   - `bills.void`
   - Update role matrix:
     - `platform_admin`, `org_admin`, `org_manager`: All permissions
     - `org_staff`: Read/write only (cannot approve or void)
     - Others: Read-only

2. **RLS Policies for `bill_applications`**:
   ```sql
   -- Read: org members
   CREATE POLICY "bill_applications_org_read"
   ON bill_applications FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() AND m.org_id = bill_applications.org_id
     )
   );
   
   -- Write: org admins/managers
   CREATE POLICY "bill_applications_org_write"
   ON bill_applications FOR INSERT
   WITH CHECK (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() 
         AND m.org_id = bill_applications.org_id
         AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
     )
   );
   
   -- Update: org admins/managers, but block if source is reconciled
   CREATE POLICY "bill_applications_org_update"
   ON bill_applications FOR UPDATE
   USING (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() 
         AND m.org_id = bill_applications.org_id
         AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
     )
     AND NOT EXISTS (
       -- Block if source transaction is reconciled
       SELECT 1 FROM bank_register_state brs
       WHERE brs.transaction_id = bill_applications.source_transaction_id
         AND brs.status = 'reconciled'
     )
   );
   
   -- Delete: org admins/managers, but block if source is reconciled
   CREATE POLICY "bill_applications_org_delete"
   ON bill_applications FOR DELETE
   USING (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() 
         AND m.org_id = bill_applications.org_id
         AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
     )
     AND NOT EXISTS (
       SELECT 1 FROM bank_register_state brs
       WHERE brs.transaction_id = bill_applications.source_transaction_id
         AND brs.status = 'reconciled'
     )
   );
   ```

3. **RLS Policies for `bill_workflow`**:
   ```sql
   -- Read: org members
   CREATE POLICY "bill_workflow_org_read"
   ON bill_workflow FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() AND m.org_id = bill_workflow.org_id
     )
   );
   
   -- Write: org admins/managers (for approval/void actions)
   CREATE POLICY "bill_workflow_org_write"
   ON bill_workflow FOR INSERT
   WITH CHECK (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() 
         AND m.org_id = bill_workflow.org_id
         AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
     )
   );
   
   -- Update: org admins/managers for approval/void, org_staff for submit
   CREATE POLICY "bill_workflow_org_update"
   ON bill_workflow FOR UPDATE
   USING (
     EXISTS (
       SELECT 1 FROM org_memberships m
       WHERE m.user_id = auth.uid() 
         AND m.org_id = bill_workflow.org_id
         AND (
           m.role IN ('org_admin', 'org_manager', 'platform_admin')
           OR (m.role = 'org_staff' AND NEW.approval_state = 'pending_approval')
         )
     )
   );
   ```

4. **RLS Policies for `bill_approval_audit`**:
   ```sql
   -- Read-only: org members
   CREATE POLICY "bill_approval_audit_org_read"
   ON bill_approval_audit FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM transactions t
       JOIN org_memberships m ON m.org_id = t.org_id
       WHERE t.id = bill_approval_audit.bill_transaction_id
         AND m.user_id = auth.uid()
     )
   );
   ```

5. **Unit Tests for RLS Policies**:
   - Create test suite in `tests/rls/bill-overlay-policies.test.ts`
   - Test scenarios:
     - Org members can read applications/workflow
     - Staff cannot approve/void
     - Admins can approve/void
     - Reconciled payments block application edits
     - Cross-org access is blocked

### Phase 4: Void/Reversal Workflow

**Migration**: `supabase/migrations/[timestamp]_bill_void_reversal.sql`

1. **Void Function**:
   ```sql
   CREATE OR REPLACE FUNCTION void_bill(
     p_bill_transaction_id UUID,
     p_user_id UUID,
     p_reason TEXT
   ) RETURNS UUID AS $$
   DECLARE
     v_reversal_id UUID;
     v_bill_record RECORD;
     v_ap_account_id UUID;
   BEGIN
     -- Get bill details
     SELECT * INTO v_bill_record
     FROM transactions
     WHERE id = p_bill_transaction_id AND transaction_type = 'Bill';
     
     IF NOT FOUND THEN
       RAISE EXCEPTION 'Bill transaction not found: %', p_bill_transaction_id;
     END IF;
     
     -- Check if bill has reconciled payments
     IF EXISTS (
       SELECT 1 FROM bill_applications ba
       JOIN bank_register_state brs ON brs.transaction_id = ba.source_transaction_id
       WHERE ba.bill_transaction_id = p_bill_transaction_id
         AND brs.status = 'reconciled'
     ) THEN
       RAISE EXCEPTION 'Cannot void bill with reconciled payments';
     END IF;
     
     -- Resolve AP account
     SELECT resolve_ap_gl_account_id(v_bill_record.org_id) INTO v_ap_account_id;
     
     -- Create reversing transaction (dated today)
     INSERT INTO transactions (
       org_id, transaction_type, date, total_amount, vendor_id,
       reference_number, memo, status, reversal_of_transaction_id
     ) VALUES (
       v_bill_record.org_id, 'Bill', CURRENT_DATE, -v_bill_record.total_amount,
       v_bill_record.vendor_id, v_bill_record.reference_number,
       COALESCE('Void: ' || v_bill_record.memo, 'Void'), 'Cancelled',
       p_bill_transaction_id
     ) RETURNING id INTO v_reversal_id;
     
     -- Create reversing transaction lines (opposite postings)
     INSERT INTO transaction_lines (
       transaction_id, gl_account_id, amount, posting_type, memo,
       account_entity_type, account_entity_id, property_id, unit_id, date
     )
     SELECT
       v_reversal_id, tl.gl_account_id, -tl.amount,
       CASE WHEN tl.posting_type = 'Debit' THEN 'Credit' ELSE 'Debit' END,
       COALESCE('Void: ' || tl.memo, 'Void'),
       tl.account_entity_type, tl.account_entity_id,
       tl.property_id, tl.unit_id, CURRENT_DATE
     FROM transaction_lines tl
     WHERE tl.transaction_id = p_bill_transaction_id;
     
     -- Update bill_workflow
     UPDATE bill_workflow
     SET
       approval_state = 'voided',
       voided_by_user_id = p_user_id,
       voided_at = now(),
       void_reason = p_reason,
       reversal_transaction_id = v_reversal_id
     WHERE bill_transaction_id = p_bill_transaction_id;
     
     -- Update original bill status
     UPDATE transactions
     SET status = 'Cancelled', updated_at = now()
     WHERE id = p_bill_transaction_id;
     
     -- Audit log
     INSERT INTO bill_approval_audit (
       bill_transaction_id, action, from_state, to_state, user_id, notes
     ) VALUES (
       p_bill_transaction_id, 'voided',
       (SELECT approval_state FROM bill_workflow WHERE bill_transaction_id = p_bill_transaction_id),
       'voided', p_user_id, p_reason
     );
     
     RETURN v_reversal_id;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Hard Delete Restrictions**:
   - Only allow hard delete for:
     - `approval_state = 'draft'` (from `bill_workflow`)
     - No applications exist (`bill_applications` count = 0)
     - Not synced to Buildium (`buildium_bill_id IS NULL` on transaction)
   - Enforce in application logic (API route)

### Phase 5: Reconciliation Locks (DB-Level Enforcement)

**Migration**: `supabase/migrations/[timestamp]_reconciliation_locks_db_enforcement.sql`

1. **Reconciliation Lock Function**:
   ```sql
   CREATE OR REPLACE FUNCTION check_payment_reconciliation_status(
     p_transaction_id UUID
   ) RETURNS boolean AS $$
   DECLARE
     v_is_reconciled boolean;
   BEGIN
     SELECT EXISTS (
       SELECT 1 FROM bank_register_state brs
       WHERE brs.transaction_id = p_transaction_id
         AND brs.status = 'reconciled'
     ) INTO v_is_reconciled;
     
     RETURN v_is_reconciled;
   END;
   $$ LANGUAGE plpgsql STABLE;
   
   -- Add computed column for UI (read-side flag)
   ALTER TABLE transactions
   ADD COLUMN IF NOT EXISTS is_reconciled boolean GENERATED ALWAYS AS (
     EXISTS (
       SELECT 1 FROM bank_register_state brs
       WHERE brs.transaction_id = transactions.id
         AND brs.status = 'reconciled'
     )
   ) STORED;
   ```

2. **Trigger to Block Application Edits on Reconciled Payments**:
   ```sql
   CREATE OR REPLACE FUNCTION trg_prevent_reconciled_application_edit()
   RETURNS trigger AS $$
   BEGIN
     IF check_payment_reconciliation_status(COALESCE(NEW.source_transaction_id, OLD.source_transaction_id)) THEN
       RAISE EXCEPTION 'Cannot modify application: source payment is reconciled'
         USING ERRCODE = '23505';
     END IF;
     RETURN COALESCE(NEW, OLD);
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER trg_bill_applications_reconciled_lock
   BEFORE UPDATE OR DELETE ON bill_applications
   FOR EACH ROW
   EXECUTE FUNCTION trg_prevent_reconciled_application_edit();
   ```

3. **Policy to Block Payment Edits When Reconciled**:
   - Already handled by `bank_register_state` policies from banking alignment plan
   - Ensure payment edit routes check `is_reconciled` flag

### Phase 6: Buildium Sync Integration

**Files to modify**:

1. **`src/lib/buildium-mappers.ts`**:
   - **Multi-bill Payment Mapping**: When syncing payment to Buildium:
     - Query `bill_applications` for all bills linked to payment
     - Map to Buildium `BillIds[]` array in payment payload
     - Example: `{ BillIds: [123, 456], Amount: 1000.00, ... }`
   - **Backfill Buildium IDs**: When migrating from `bill_transaction_id` to `bill_applications`:
     - Preserve existing `buildium_bill_id` on transactions
     - When creating `bill_applications`, use existing Buildium IDs if available
     - For new applications, sync to Buildium and store returned IDs
   - **Approval State Sync**:
     - Map `bill_workflow.approval_state` to Buildium bill status
     - Handle conflicts: if Buildium has different status, log conflict and use local state
     - Sync conflict resolution: prefer local state, log for manual review

2. **`supabase/functions/buildium-webhook/index.ts`**:
   - **BillCreated/Updated**: Create/update `bill_workflow` with `approval_state = 'approved'` (Buildium bills are pre-approved)
   - **BillPaid**: Create `bill_applications` entries:
     - Handle `BillIds[]` array (multi-bill payments)
     - Create one `bill_applications` entry per bill ID
     - Allocate payment amount proportionally or use Buildium allocation if provided
   - **Vendor Credit/Refund**: Create credit transaction + `bill_applications` if applied to bills

3. **`src/lib/buildium-sync.ts`**:
   - Update `syncBillToBuildium()`: Include `approval_state` in sync
   - Update payment sync: Include `bill_applications` → `BillIds[]` mapping
   - Add conflict resolution logging for approval state mismatches

### Phase 7: API Endpoints Updates

**Files to modify**:

1. **`src/app/api/bills/route.ts`** (enhance existing):
   - `POST /api/bills` - Use `replace_transaction_lines()` for atomic creation, resolve `org_id` upfront
   - `GET /api/bills` - Add filter by `approval_state` from `bill_workflow`
   - Add `POST /api/bills/[id]/submit` - Submit for approval (creates/updates `bill_workflow`)
   - Add `POST /api/bills/[id]/approve` - Approve bill (requires `bills.approve` permission)
   - Add `POST /api/bills/[id]/reject` - Reject bill (requires `bills.approve` permission)
   - Add `POST /api/bills/[id]/void` - Void bill with reversal (requires `bills.void` permission)
   - Update `DELETE /api/bills/[id]` - Enforce restrictions (draft only, no applications, not synced)

2. **`src/app/api/bills/[id]/route.ts`** (enhance existing):
   - `PATCH /api/bills/[id]` - Check approval state:
     - If `approval_state = 'approved'`: only allow metadata edits (memo/reference), block amount/line changes
     - Return 409 if trying to edit amounts when approved
     - Return 422 if validation fails
   - `GET /api/bills/[id]` - Include `bill_workflow` and `bill_applications` data
   - `POST /api/bills/[id]/submit` - Submit for approval:
     - Creates/updates `bill_workflow` with `approval_state = 'pending_approval'`
     - Creates audit record
     - Returns 409 if already submitted/approved
   - `POST /api/bills/[id]/approve` - Approve bill:
     - Requires `bills.approve` permission
     - Updates `bill_workflow.approval_state = 'approved'`
     - Creates audit record
     - Returns 409 if not in `pending_approval` state
     - Returns 403 if user lacks permission
   - `POST /api/bills/[id]/reject` - Reject bill:
     - Requires `bills.approve` permission
     - Updates `bill_workflow.approval_state = 'rejected'`
     - Creates audit record
     - Returns 409 if not in `pending_approval` state
   - `POST /api/bills/[id]/void` - Void bill:
     - Requires `bills.void` permission
     - Calls `void_bill()` function
     - Returns 409 if bill has reconciled payments
     - Returns 403 if user lacks permission
   - `DELETE /api/bills/[id]` - Hard delete:
     - Only if `approval_state = 'draft'`, no applications, `buildium_bill_id IS NULL`
     - Returns 409 if conditions not met

3. **`src/app/api/bills/[id]/applications/route.ts`** (new):
   - `GET /api/bills/[id]/applications` - List all applications (payments + credits) for bill
   - `POST /api/bills/[id]/applications` - Create application:
     ```typescript
     {
       source_transaction_id: string,
       applied_amount: number
     }
     ```
     - Validates via `validate_bill_application()` function
     - Returns 422 if validation fails (exceeds amounts)
     - Returns 409 if source is reconciled
   - `DELETE /api/bills/[id]/applications/[applicationId]` - Remove application:
     - Returns 409 if source is reconciled
     - Triggers `recompute_bill_status()` via trigger

4. **`src/app/api/payments/route.ts`** (new) or **`src/app/api/bills/[id]/payments/route.ts`** (enhance):
   - `POST /api/payments` - Create payment with multi-bill support:
     ```typescript
     {
       bank_account_id: string,
       amount: number,
       payment_date: string,
       bill_allocations: [
         { bill_id: string, amount: number },
         { bill_id: string, amount: number }
       ]
     }
     ```
   - Creates payment transaction + `bill_applications` entries in one transaction
   - Validates allocations sum <= payment amount
   - Returns 422 if validation fails

5. **`src/app/api/vendor-credits/route.ts`** (new):
   - `POST /api/vendor-credits` - Create vendor credit transaction
   - `POST /api/vendor-credits/[id]/apply` - Apply credit to bill(s):
     ```typescript
     {
       bill_allocations: [
         { bill_id: string, amount: number }
       ]
     }
     ```
   - Creates `bill_applications` entries with `source_type = 'credit'`

6. **`src/app/api/bank-accounts/[id]/checks/[transactionId]/route.ts`** (enhance existing):
   - Add reconciliation status check before allowing edits
   - Block edits if payment is reconciled
   - Update bill status after payment deletion (via `recompute_bill_status()`)

### Phase 8: Buildium Sync Integration

**Files to modify**:

1. **`src/lib/buildium-mappers.ts`**:
   - Update `mapTransactionBillToBuildium()` to work with transaction-based bills
   - Add mapping for bill applications (Buildium supports `BillIds[]` in payments)
   - Handle vendor credits/refunds from Buildium

2. **`supabase/functions/buildium-webhook/index.ts`**:
   - Enhance `BillCreated`, `BillUpdated`, `BillPaid` handlers:
     - Create/update `bill_workflow` entries
     - Create `bill_applications` for multi-bill payments
   - Add handlers for vendor credit/refund webhooks

3. **`src/lib/buildium-sync.ts`**:
   - Update bill sync to include approval state
   - Sync bill applications when syncing payments

### Phase 9: UI Components

**Files to create/modify**:

1. **`src/app/(protected)/bills/page.tsx`** (enhance existing):
   - Add `approval_state` column from `bill_workflow`
   - Add filter by approval state
   - Add bulk actions: submit for approval, approve, reject (with permission checks)

2. **`src/app/(protected)/bills/[id]/page.tsx`** (enhance existing):
   - **Status Display**: 
     - Derived status (call `recompute_bill_status()` or use computed value, not cached)
     - Show both `transactions.status` (payable state) and `bill_workflow.approval_state` (approval lifecycle)
   - **Approval Workflow UI**:
     - Approval state badge
     - Submit/Approve/Reject buttons (permission-gated, disabled if wrong state)
     - Approval history timeline from `bill_approval_audit`
     - Guard actions: disable submit if not draft, disable approve/reject if not pending
   - **Applications Section**:
     - List payments and credits applied to bill
     - Show partial payment amounts
     - Show reconciliation lock state on payments (use `is_reconciled` computed column)
     - Link to payment/credit details
     - Disable edit/delete actions if payment is reconciled
   - **Void Functionality**:
     - Void button (permission-gated)
     - Void reason input
     - Show reversal transaction if voided
     - Disable void if bill has reconciled payments
   - **Edit Guards**:
     - If approved: disable amount/line edits, allow only memo/reference
     - Show warning message explaining restrictions

3. **`src/components/bills/BillApprovalWorkflow.tsx`** (new):
   - Approval state badge component
   - Submit/Approve/Reject action buttons with permission checks
   - Approval history timeline component

4. **`src/components/bills/BillApplicationsList.tsx`** (new):
   - Display all applications (payments + credits) for a bill
   - Show applied amounts, dates, sources
   - Link to payment/credit transaction details

5. **`src/components/bills/BillPaymentForm.tsx`** (new or enhance existing):
   - Payment form with bank account selection
   - Payment method selection
   - Multi-bill payment support (select multiple bills)
   - Partial payment amounts per bill
   - Creates payment transaction + `bill_applications` entries

6. **`src/components/bills/VendorCreditForm.tsx`** (new):
   - Credit creation form
   - Apply credit to bill(s) option
   - Creates credit transaction + `bill_applications` entries

### Phase 10: Data Migration and Backfill

**Script**: `scripts/backfill-bill-workflow-and-applications.ts`

**Requirements**: Idempotent, dry-run support, per-org batches, metrics reporting

1. **Script Structure**:
   ```typescript
   // Dry-run mode
   const DRY_RUN = process.env.DRY_RUN === 'true';
   
   // Per-org batching
   const BATCH_SIZE = 100;
   
   // Metrics tracking
   interface MigrationMetrics {
     orgsProcessed: number;
     workflowsCreated: number;
     applicationsCreated: number;
     failures: Array<{ orgId: string; error: string }>;
     apAccountResolved: number;
     apAccountMissing: number;
   }
   ```

2. **Backfill bill_workflow** (idempotent):
   - For each org:
     - Find bill transactions without `bill_workflow` entry
     - Create `bill_workflow` entries:
       - `approval_state = 'approved'` if bill has payments (via `bill_transaction_id`), else `'draft'`
       - `submitted_at`/`approved_at` = transaction `created_at` if approved
     - Skip if entry already exists (idempotent)
   - Metrics: count created, count skipped (already exists)

3. **Backfill bill_applications** (idempotent):
   - For each org:
     - Find payments/checks with `bill_transaction_id IS NOT NULL`
     - Create `bill_applications` entries:
       - `bill_transaction_id` = payment's `bill_transaction_id`
       - `source_transaction_id` = payment transaction id
       - `source_type = 'payment'`
       - `applied_amount = ABS(payment.total_amount)`
     - Skip if application already exists (check unique constraint)
   - Metrics: count created, count skipped

4. **Backfill AP account config**:
   - For each org:
     - If `organizations.ap_gl_account_id IS NULL`:
       - Try `resolve_ap_gl_account_id(org_id)`
       - If resolved, set `organizations.ap_gl_account_id`
       - If not resolved, log warning and continue
   - Metrics: count resolved, count missing (warnings)

5. **Error Handling**:
   - Per-org error isolation: if one org fails, continue with others
   - Log all failures with org_id and error message
   - Return non-zero exit code if any failures occurred
   - Generate report: `backfill-report-{timestamp}.json`

6. **Dry-Run Mode**:
   - When `DRY_RUN=true`, show what would be created without actually creating
   - Output: counts, sample records, warnings
   - Useful for validation before production run

7. **Post-Migration Validation**:
   - Verify all bills have `bill_workflow` entries
   - Verify all `bill_transaction_id` relationships have `bill_applications` entries
   - Verify status computation works (run `recompute_bill_status()` on sample bills)
   - Report any discrepancies

### Phase 11: 1099 Reporting Workflows (Future Phase)

**Note**: 1099 schema already exists in `vendors` table (`include_1099`, tax payer fields). This phase adds reporting workflows.

1. **Deterministic 1099 Definition**:
   - **What counts**: Gross payments to vendor (sum of payment applications where `source_type = 'payment'`)
   - **Exclusions**: 
     - Credits/refunds (`source_type IN ('credit', 'refund')`) reduce 1099 total
     - Voided bills (where `bill_workflow.approval_state = 'voided'`) excluded entirely
     - Reversal transactions excluded
   - **Date basis**: Payment date (from `transactions.date` of payment transaction)
   - **Calculation function**:
     ```sql
     CREATE OR REPLACE FUNCTION calculate_vendor_1099_total(
       p_vendor_id UUID,
       p_tax_year INTEGER
     ) RETURNS NUMERIC AS $$
     DECLARE
       v_payment_total NUMERIC;
       v_credit_total NUMERIC;
     BEGIN
       -- Sum payments (exclude voids)
       SELECT COALESCE(SUM(ba.applied_amount), 0) INTO v_payment_total
       FROM bill_applications ba
       JOIN transactions t ON t.id = ba.source_transaction_id
       JOIN transactions b ON b.id = ba.bill_transaction_id
       LEFT JOIN bill_workflow bw ON bw.bill_transaction_id = b.id
       WHERE ba.source_type = 'payment'
         AND b.vendor_id = p_vendor_id
         AND EXTRACT(YEAR FROM t.date) = p_tax_year
         AND (bw.approval_state IS NULL OR bw.approval_state != 'voided');
       
       -- Sum credits (reduce total)
       SELECT COALESCE(SUM(ba.applied_amount), 0) INTO v_credit_total
       FROM bill_applications ba
       JOIN transactions t ON t.id = ba.source_transaction_id
       JOIN transactions b ON b.id = ba.bill_transaction_id
       LEFT JOIN bill_workflow bw ON bw.bill_transaction_id = b.id
       WHERE ba.source_type IN ('credit', 'refund')
         AND b.vendor_id = p_vendor_id
         AND EXTRACT(YEAR FROM t.date) = p_tax_year
         AND (bw.approval_state IS NULL OR bw.approval_state != 'voided');
       
       RETURN GREATEST(0, v_payment_total - v_credit_total);
     END;
     $$ LANGUAGE plpgsql STABLE;
     ```

2. **1099 Threshold Tracking**:
   - Function to calculate vendor 1099 totals per tax year (using definition above)
   - Track which vendors exceed threshold (typically $600)
   - Flag vendors with `include_1099 = true` that exceed threshold

3. **1099 Export/Reporting**:
   - Generate 1099 reports per vendor per year
   - Export formats (CSV, PDF)
   - Include vendor tax payer information from `vendors` table
   - Integration with 1099 filing services (future)

4. **UI Components**:
   - 1099 reporting page
   - Vendor 1099 summary view (shows calculated total, threshold status)
   - Export functionality

### Phase 12: Documentation

**Files to create/update**:

1. **`docs/buildium-vendors-ap-guide.md`** (new):

- Bill creation workflow
- Approval process
- Payment processing
- Vendor credits
- Buildium sync

2. **`docs/api/api-documentation.md`** (update):

- Add bill endpoints
- Add vendor payment endpoints
- Add vendor credit endpoints

3. **`docs/database/database-schema.md`** (update):

- Document new tables
- Document relationships
- Document approval workflow

## Implementation Order

**Critical Path**: Foundation → Overlays → Backfill → API/UI

1. **Phase 1** - Foundation: Single reversible migration for AP config + org_id + atomic bill creation (prerequisite)
2. **Phase 2** - Overlay Tables: `bill_applications` + `bill_workflow` with constraints, triggers, validation functions
3. **Phase 3** - RLS Policies: Org-scoped policies with permission checks, unit tests
4. **Phase 4** - Void/Reversal: Void function with reversal transaction, hard delete restrictions
5. **Phase 5** - Reconciliation Locks: DB-level enforcement via triggers/policies, `is_reconciled` computed column
6. **Phase 6** - Buildium Sync: Multi-bill payment mapping, backfill strategy, conflict resolution
7. **Phase 10** - Data Migration: Idempotent backfill script with dry-run, per-org batches, metrics
8. **Phase 7** - API Endpoints: Update existing routes, add approval/application endpoints with proper error codes (409/422)
9. **Phase 8** - Buildium Sync Implementation: Update mappers and webhooks
10. **Phase 9** - UI Components: Derived status display, reconciliation lock indicators, action guards
11. **Phase 12** - Documentation: Update API docs, database schema docs
12. **Phase 11** - 1099 Reporting Workflows (future enhancement)

## Key Design Decisions

1. **No Separate Bills Table**: Keep `transactions` (Bill) as canonical ledger artifact. Add thin overlay tables (`bill_workflow`, `bill_applications`) for lifecycle and applications without duplicating data.

2. **Status Separation**: 
   - `transactions.status` = payable state ('Due', 'Paid', 'Partially paid', 'Overdue', 'Cancelled')
   - `bill_workflow.approval_state` = approval lifecycle ('draft', 'pending_approval', 'approved', 'rejected')
   - Avoids conflicting status fields

3. **Applications Join Table**: `bill_applications` supports:
   - Multi-bill payments (one payment → multiple bills)
   - Partial payments (one payment → partial amount to bill)
   - Credits applied to bills
   - Replaces 1:1 `bill_transaction_id` limitation

4. **Atomic Bill Creation**: Use `replace_transaction_lines()` RPC (same as edits) for consistency and atomicity. Resolve `org_id` upfront.

5. **Stable AP Account Config**: Use `organizations.ap_gl_account_id` or `gl_accounts.sub_type = 'AccountsPayable'` instead of brittle name-based lookups.

6. **Void vs Delete**: Prefer void/reversal semantics for auditability. Only allow hard delete for true drafts with no applications and not synced.

7. **Reconciliation Locks**: Enforce at payment/check transaction level via `bank_register_state`. Block edits/deletes if reconciled.

8. **Vendor Credits as Transactions**: Represent credits/refunds as transactions (like everything else), apply via `bill_applications` with `source_type = 'credit'`.

9. **Backward Compatibility**: Keep `bill_transaction_id` column during transition, but status computation moves to `bill_applications`.

## Testing Considerations

1. **Unit Tests**: 
   - Approval state transitions
   - `bill_applications` validation (sum <= payment amount, sum <= bill amount)
   - `recompute_bill_status()` logic
   - AP account resolution function

2. **Integration Tests**: 
   - Bill creation (atomic via `replace_transaction_lines`)
   - Bill approval workflow (draft → pending → approved)
   - Multi-bill payment application
   - Partial payment application
   - Credit application to bill
   - Void with reversal
   - Reconciliation lock enforcement

3. **Buildium Sync Tests**: 
   - Verify bidirectional sync with new structure
   - Multi-bill payment sync (Buildium `BillIds[]`)
   - Approval state sync

4. **Permission Tests**: 
   - Verify role-based access controls for approval/void
   - Staff can write but not approve

5. **Migration Tests**: 
   - Verify existing bills get `bill_workflow` entries
   - Verify existing `bill_transaction_id` relationships migrate to `bill_applications`
   - Verify status computation works with applications

## Future Enhancements (Out of Scope)

- Recurring bill automation
- Multi-level approval routing
- Early payment discount tracking
- Vendor payment terms enforcement