---
name: Buildium Banking Alignment
overview: Align the banking system with Buildium's model by adding bank register entries with cleared/uncleared/reconciled status, proper reconciliation tracking with locks, and audit logging for all banking operations.
todos:
  - id: phase1-bank-register-state
    content: Create bank_register_state overlay table with grain (org_id, bank_gl_account_id, transaction_id), status enum (uncleared/cleared/reconciled), and auto-creation trigger
    status: done
  - id: phase2-reconciliation-extend
    content: Extend reconciliation_log with lock fields (locked_at, locked_by, book_balance_snapshot), sync tracking (last_synced_at, last_sync_error), and create book balance calculation function
    status: done
    dependencies:
      - phase1-bank-register-state
  - id: phase3-lock-guardrails
    content: Implement database triggers and API validations to prevent bank-side amount/posting_type/GL account edits to reconciled transactions (allow non-bank edits and metadata-only edits)
    status: done
    dependencies:
      - phase2-reconciliation-extend
  - id: phase4-audit-log
    content: Create banking_audit_log table following existing patterns, with triggers to capture status changes and blocked attempts
    status: done
  - id: phase5-buildium-sync
    content: Extend existing reconciliation sync route to fetch transactions for open/updated reconciliations, upsert cleared/reconciled state idempotently, track unmatched transactions, and add parity checks
    status: done
    dependencies:
      - phase1-bank-register-state
      - phase2-reconciliation-extend
  - id: phase6-bank-register-view
    content: Update v_bank_register_transactions view to include status and reconciliation linkage from bank_register_state (derive amount/posting_type from existing view logic)
    status: done
    dependencies:
      - phase1-bank-register-state
  - id: phase7-ui-updates
    content: Update ClearingPanel to use local bank_register_state instead of Buildium API directly, add cleared/uncleared tabs, show reconciliation locks, add audit log viewer and sync staleness indicators
    status: done
    dependencies:
      - phase6-bank-register-view
      - phase4-audit-log
      - phase5-buildium-sync
  - id: backfill-migration
    content: Create backfill script to seed bank_register_state from existing transaction_lines (default uncleared), then sync from Buildium reconciliations to populate cleared/reconciled status
    status: done
    dependencies:
      - phase1-bank-register-state
---

# Buildium Banking Alignment Plan

## Overview

Align the repository's banking functionality with Buildium's banking model by implementing:

1. Bank register entries with status tracking (uncleared/cleared/reconciled)
2. Proper reconciliation object model with statement periods and locks
3. Transaction-to-reconciliation linking
4. Buildium-like guardrails preventing edits to reconciled transactions
5. Comprehensive audit logging for banking operations

## Current State Analysis

### What Exists

- `gl_accounts` table with `is_bank_account=true` (bank accounts migrated from `bank_accounts` table)
- `transactions` and `transaction_lines` for GL entries
- `journal_entries` table linking to transactions via `transaction_id`
- `reconciliation_log` table with Buildium reconciliation metadata:
- Buildium reconciliation IDs (`buildium_reconciliation_id`)
- Statement ending balance (`ending_balance`)
- Finished flag (`is_finished`)
- Statement ending date (`statement_ending_date`)
- `v_bank_register_transactions` view feeding the bank account page UI
- `v_reconciliation_variances` view showing reconciliation discrepancies
- `src/app/api/admin/sync/reconciliations/route.ts` - reconciliation sync route
- `src/components/reconciliations/ClearingPanel.tsx` - clears/unclears via Buildium API directly
- Buildium API endpoints for reconciliation operations (read-only, no local state)

### What's Missing

- **Local cleared/reconciled state**: No local tracking of transaction cleared/reconciled status
- **Transaction-to-reconciliation linkage**: No way to query which transactions are in a reconciliation
- **Guardrails**: No lock mechanism preventing edits to reconciled transactions
- **Audit trail**: No audit log for banking/reconciliation edits
- **Balance snapshots**: No book balance snapshot at reconciliation finalize time
- **Sync tracking**: No `last_synced_at` or sync error tracking
- **Parity monitoring**: No way to detect drift between local and Buildium state

### Framing

This work adds **local cleared/reconciled state tracking, guardrails, and audit trail** to the existing reconciliation infrastructure—not rebuilding reconciliation. The existing `reconciliation_log`, sync route, and views remain; we're adding an overlay table and enforcement layer.

## Implementation Plan

### Phase 1: Create Bank Register State Overlay Table

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_create_bank_register_state.sql`
- `src/types/bank-register.ts` (new)
- `src/lib/bank-register.ts` (new)

**Changes:**

1. **Create enum type first** (required before table creation):
   ```sql
                        CREATE TYPE bank_entry_status_enum AS ENUM ('uncleared', 'cleared', 'reconciled');
   ```




2. **Create lightweight overlay table** with grain `(org_id, bank_gl_account_id, transaction_id)`:
   ```sql
                        CREATE TABLE public.bank_register_state (
                          org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
                          bank_gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id) ON DELETE CASCADE,
                          transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
                          
                          -- Optional: Buildium transaction ID for mapping (nullable for local-only transactions)
                          buildium_transaction_id integer,
                          
                          -- Status tracking (Buildium-aligned)
                          status bank_entry_status_enum NOT NULL DEFAULT 'uncleared',
                          
                          -- Current reconciliation (optional; only set when transaction is in active reconciliation)
                          current_reconciliation_log_id uuid REFERENCES public.reconciliation_log(id) ON DELETE SET NULL,
                          
                          -- Audit fields
                          cleared_at timestamptz,
                          cleared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                          reconciled_at timestamptz,
                          reconciled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                          
                          -- Timestamps
                          created_at timestamptz NOT NULL DEFAULT now(),
                          updated_at timestamptz NOT NULL DEFAULT now(),
                          
                          PRIMARY KEY (org_id, bank_gl_account_id, transaction_id)
                        );
   ```


**Key design decisions**:

- **Grain**: One row per `(org_id, bank_gl_account_id, transaction_id)` - supports transfers (same transaction, multiple banks)
- **No denormalization**: Amount, posting type, and date derived from `v_bank_register_transactions` view
- **Lightweight overlay**: Only stores status and reconciliation linkage
- **Buildium ID optional**: `buildium_transaction_id` nullable for local-only transactions

3. **Add indexes** with filtered indexes for cleared/reconciled lookups:
   ```sql
                        CREATE INDEX idx_bank_register_state_bank_gl_account_id 
                          ON public.bank_register_state(bank_gl_account_id);
                        CREATE INDEX idx_bank_register_state_transaction_id 
                          ON public.bank_register_state(transaction_id);
                        CREATE INDEX idx_bank_register_state_status 
                          ON public.bank_register_state(status);
                        CREATE INDEX idx_bank_register_state_reconciliation 
                          ON public.bank_register_state(current_reconciliation_log_id) 
                          WHERE current_reconciliation_log_id IS NOT NULL;
                        CREATE INDEX idx_bank_register_state_buildium_txn 
                          ON public.bank_register_state(buildium_transaction_id) 
                          WHERE buildium_transaction_id IS NOT NULL;
                        -- Filtered index for cleared entries (most common query pattern)
                        CREATE INDEX idx_bank_register_state_cleared 
                          ON public.bank_register_state(bank_gl_account_id, transaction_id) 
                          WHERE status IN ('cleared', 'reconciled');
                        -- Filtered index for reconciled entries
                        CREATE INDEX idx_bank_register_state_reconciled 
                          ON public.bank_register_state(bank_gl_account_id, transaction_id) 
                          WHERE status = 'reconciled';
   ```




4. **Add RLS policies** following existing patterns:
   ```sql
                        ALTER TABLE public.bank_register_state ENABLE ROW LEVEL SECURITY;
                        
                        CREATE POLICY bank_register_state_org_read
                          ON public.bank_register_state FOR SELECT
                          USING (public.is_org_member((SELECT auth.uid()), org_id));
                          
                        CREATE POLICY bank_register_state_org_write
                          ON public.bank_register_state FOR ALL
                          USING (public.is_org_member((SELECT auth.uid()), org_id))
                          WITH CHECK (public.is_org_member((SELECT auth.uid()), org_id));
                        
                        -- Service role full access (for sync routes)
                        CREATE POLICY bank_register_state_service_role_full_access
                          ON public.bank_register_state
                          FOR ALL
                          USING (auth.role() = 'service_role')
                          WITH CHECK (auth.role() = 'service_role');
   ```


**Security**: Follows existing RLS pattern using `public.is_org_member((SELECT auth.uid()), org_id)` to avoid per-row subquery issues. Bank GL account validation enforced via trigger (see below).

5. **Create trigger function** to validate bank GL account and ensure state rows exist (only for bank-side transactions):
   ```sql
                        CREATE OR REPLACE FUNCTION ensure_bank_register_state()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        DECLARE
                          v_org_id uuid;
                          v_is_bank_account boolean;
                          v_bank_gl_account_id uuid;
                        BEGIN
                          -- Only process if this transaction line hits a bank GL account
                          SELECT ga.is_bank_account, t.org_id, NEW.gl_account_id
                          INTO v_is_bank_account, v_org_id, v_bank_gl_account_id
                          FROM public.transactions t
                          JOIN public.gl_accounts ga ON ga.id = NEW.gl_account_id
                          WHERE t.id = NEW.transaction_id;
                          
                          IF v_is_bank_account = true THEN
                            -- Ensure state row exists (if not, create with default 'uncleared' status)
                            INSERT INTO public.bank_register_state (
                              org_id,
                              bank_gl_account_id,
                              transaction_id,
                              status
                            )
                            VALUES (
                              v_org_id,
                              v_bank_gl_account_id,
                              NEW.transaction_id,
                              'uncleared'::bank_entry_status_enum
                            )
                            ON CONFLICT (org_id, bank_gl_account_id, transaction_id) DO NOTHING;
                          END IF;
                          
                          RETURN NEW;
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_ensure_bank_register_state
                          AFTER INSERT OR UPDATE ON public.transaction_lines
                          FOR EACH ROW
                          EXECUTE FUNCTION ensure_bank_register_state();
                        
                        -- Clean up state when transaction is deleted
                        CREATE OR REPLACE FUNCTION cleanup_bank_register_state()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        BEGIN
                          DELETE FROM public.bank_register_state
                          WHERE transaction_id = OLD.id;
                          RETURN OLD;
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_cleanup_bank_register_state
                          AFTER DELETE ON public.transactions
                          FOR EACH ROW
                          EXECUTE FUNCTION cleanup_bank_register_state();
   ```


**Key points**:

- **Validates bank account** via trigger (not CHECK constraint with subquery)
- **Auto-creates state rows** for bank-side transactions with default 'uncleared'
- **Handles multi-bank transactions**: One state row per `(bank_gl_account_id, transaction_id)` pair
- **Cleanup on transaction delete**: Removes all state rows for deleted transaction

### Phase 2: Extend Reconciliation Model

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_extend_reconciliation_log.sql`
- Update `src/app/api/admin/sync/reconciliations/route.ts`

**Changes:**

1. **Add reconciliation lock fields** to `reconciliation_log` (existing table):
   ```sql
                        ALTER TABLE public.reconciliation_log
                          ADD COLUMN IF NOT EXISTS locked_at timestamptz,
                          ADD COLUMN IF NOT EXISTS locked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                          ADD COLUMN IF NOT EXISTS statement_start_date date,
                          ADD COLUMN IF NOT EXISTS book_balance_snapshot numeric(15,2);
                          -- Note: statement_ending_balance already exists as ending_balance
                          
                        COMMENT ON COLUMN public.reconciliation_log.locked_at IS 'Timestamp when reconciliation was locked (finalized). After this, bank-side transaction amounts cannot be changed.';
                        COMMENT ON COLUMN public.reconciliation_log.book_balance_snapshot IS 'Book balance (calculated from cleared transactions) at time of reconciliation finalize.';
                        -- ending_balance remains as statement ending balance (from bank statement)
   ```


**Balance semantics**:

- `ending_balance`: Statement ending balance from bank (already exists)
- `book_balance_snapshot`: Ledger/book balance (all cleared transactions through statement date) - snapshot at finalize
- Calculated separately: cleared balance vs. reconciled balance tracked via `bank_register_state.status`



2. **Update view** to show transactions in reconciliations (using new state table):
   ```sql
                        CREATE OR REPLACE VIEW public.v_reconciliation_transactions AS
                        SELECT 
                          rl.id as reconciliation_id,
                          rl.statement_start_date,
                          rl.statement_ending_date,
                          rl.locked_at,
                          brs.transaction_id,
                          brs.bank_gl_account_id,
                          brs.status,
                          brs.cleared_at,
                          brs.reconciled_at,
                          -- Derive amount/posting_type from view (no denormalization)
                          vbrt.bank_amount,
                          vbrt.bank_posting_type,
                          vbrt.entry_date
                        FROM public.reconciliation_log rl
                        JOIN public.bank_register_state brs ON brs.current_reconciliation_log_id = rl.id
                        LEFT JOIN public.v_bank_register_transactions vbrt 
                          ON vbrt.id = brs.transaction_id 
                          AND vbrt.bank_gl_account_id = brs.bank_gl_account_id
                        WHERE rl.is_finished = true;
   ```




3. **Create function to calculate book balance** (cleared transactions only, using existing view):
   ```sql
                        CREATE OR REPLACE FUNCTION public.calculate_book_balance(
                          p_bank_gl_account_id uuid,
                          p_as_of date DEFAULT current_date,
                          p_org_id uuid DEFAULT NULL
                        )
                        RETURNS numeric(15,2)
                        LANGUAGE sql
                        STABLE
                        SECURITY INVOKER
                        AS $$
                          SELECT COALESCE(
                            SUM(
                              CASE 
                                WHEN vbrt.bank_posting_type = 'Debit' THEN vbrt.bank_amount
                                WHEN vbrt.bank_posting_type = 'Credit' THEN -vbrt.bank_amount
                                ELSE 0
                              END
                            ),
                            0
                          )::numeric(15,2)
                          FROM public.v_bank_register_transactions vbrt
                          JOIN public.bank_register_state brs 
                            ON brs.transaction_id = vbrt.id 
                            AND brs.bank_gl_account_id = vbrt.bank_gl_account_id
                          JOIN public.gl_accounts ga ON ga.id = vbrt.bank_gl_account_id
                          WHERE vbrt.bank_gl_account_id = p_bank_gl_account_id
                            AND vbrt.date <= p_as_of::date
                            AND brs.status IN ('cleared', 'reconciled')
                            AND (p_org_id IS NULL OR ga.org_id = p_org_id);
                        $$;
   ```


**Balance functions**:

- `calculate_book_balance()`: Cleared/reconciled transactions only (for reconciliation)
- Ledger balance: All transactions through date (existing calculation)
- Book balance snapshot: Captured at reconciliation finalize

### Phase 3: Implement Reconciliation Lock Guardrails

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_reconciliation_locks.sql`
- Update transaction update endpoints:
- `src/app/api/journal-entries/[transactionId]/route.ts`
- `src/app/api/bank-accounts/[id]/checks/[transactionId]/route.ts`
- `src/app/api/bank-accounts/[id]/deposits/[transactionId]/route.ts`
- `src/app/api/bank-accounts/[id]/transfers/[transactionId]/route.ts`

**Changes:**

1. **Create function to check if transaction has reconciled bank lines**:
   ```sql
                        CREATE OR REPLACE FUNCTION public.has_reconciled_bank_lines(
                          p_transaction_id uuid,
                          p_bank_gl_account_id uuid DEFAULT NULL
                        )
                        RETURNS boolean
                        LANGUAGE sql
                        STABLE
                        SECURITY INVOKER
                        AS $$
                          SELECT EXISTS (
                            SELECT 1
                            FROM public.bank_register_state brs
                            JOIN public.reconciliation_log rl ON rl.id = brs.current_reconciliation_log_id
                            WHERE brs.transaction_id = p_transaction_id
                              AND rl.locked_at IS NOT NULL
                              AND brs.status = 'reconciled'
                              AND (p_bank_gl_account_id IS NULL OR brs.bank_gl_account_id = p_bank_gl_account_id)
                          );
                        $$;
   ```




2. **Create guardrail trigger** - only guard bank-side changes:
   ```sql
                        CREATE OR REPLACE FUNCTION prevent_reconciled_bank_line_edit()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        DECLARE
                          v_is_bank_account boolean;
                          v_is_reconciled boolean;
                          v_transaction_id uuid;
                        BEGIN
                          v_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
                          
                          -- Only check if this line hits a bank GL account
                          SELECT ga.is_bank_account INTO v_is_bank_account
                          FROM public.gl_accounts ga
                          WHERE ga.id = COALESCE(NEW.gl_account_id, OLD.gl_account_id);
                          
                          IF v_is_bank_account = true THEN
                            -- Check if this bank-side transaction is reconciled
                            SELECT public.has_reconciled_bank_lines(v_transaction_id, COALESCE(NEW.gl_account_id, OLD.gl_account_id))
                            INTO v_is_reconciled;
                            
                            IF v_is_reconciled THEN
                              -- Block INSERT of new bank lines into reconciled transaction
                              IF TG_OP = 'INSERT' THEN
                                RAISE EXCEPTION 'Cannot add new bank-side transaction lines to a transaction that is part of a locked reconciliation.'
                                  USING ERRCODE = 'P0001';
                              END IF;
                              
                              -- Block changes to bank-side amount/posting type/GL account
                              IF TG_OP = 'UPDATE' THEN
                                IF (OLD.gl_account_id IS NOT NULL AND NEW.gl_account_id IS NOT NULL 
                                    AND OLD.gl_account_id != NEW.gl_account_id) OR
                                   (OLD.amount IS NOT NULL AND NEW.amount IS NOT NULL AND OLD.amount != NEW.amount) OR
                                   (OLD.posting_type IS NOT NULL AND NEW.posting_type IS NOT NULL 
                                    AND OLD.posting_type != NEW.posting_type) THEN
                                  RAISE EXCEPTION 'Cannot modify bank-side GL account, amount, or posting type for a transaction that is part of a locked reconciliation. Only metadata (memo, date) can be edited.'
                                    USING ERRCODE = 'P0001';
                                END IF;
                              END IF;
                              
                              -- Block DELETE of reconciled bank lines
                              IF TG_OP = 'DELETE' THEN
                                RAISE EXCEPTION 'Cannot delete bank-side transaction line that is part of a locked reconciliation.'
                                  USING ERRCODE = 'P0001';
                              END IF;
                            END IF;
                          END IF;
                          
                          RETURN COALESCE(NEW, OLD);
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_prevent_reconciled_bank_line_edit
                          BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_lines
                          FOR EACH ROW
                          EXECUTE FUNCTION prevent_reconciled_bank_line_edit();
                        
                        -- Prevent deleting transaction if it has any reconciled bank lines
                        CREATE OR REPLACE FUNCTION prevent_reconciled_transaction_delete()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        DECLARE
                          v_has_reconciled boolean;
                        BEGIN
                          SELECT public.has_reconciled_bank_lines(OLD.id) INTO v_has_reconciled;
                          
                          IF v_has_reconciled THEN
                            RAISE EXCEPTION 'Cannot delete transaction that has bank-side lines part of a locked reconciliation.'
                              USING ERRCODE = 'P0001';
                          END IF;
                          
                          RETURN OLD;
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_prevent_reconciled_transaction_delete
                          BEFORE DELETE ON public.transactions
                          FOR EACH ROW
                          EXECUTE FUNCTION prevent_reconciled_transaction_delete();
   ```


**Guardrail scope**:

- **Only guards bank-side changes**: Non-bank GL account edits allowed (if totals stay balanced)
- **Allows metadata edits**: Memo, date changes allowed even for reconciled transactions
- **Blocks bank-side modifications**: Amount, posting type, GL account changes blocked for reconciled bank lines
- **Blocks bank line deletion**: Cannot delete bank-side lines from reconciled transactions
- **Blocks transaction deletion**: Cannot delete transaction if it has any reconciled bank lines
- **State machine enforcement**: Enforce valid state transitions (uncleared → cleared → reconciled, prevent backward skip after reconcile)

3. **Enforce state transitions** (prevent invalid status changes):
   ```sql
                        CREATE OR REPLACE FUNCTION enforce_bank_register_state_transitions()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        BEGIN
                          -- Allow: uncleared → cleared → reconciled (forward only)
                          -- Block: reconciled → cleared → uncleared (backward after reconcile)
                          IF OLD.status = 'reconciled' AND NEW.status IN ('cleared', 'uncleared') THEN
                            RAISE EXCEPTION 'Cannot change status backward from reconciled. Transaction is locked in reconciliation.'
                              USING ERRCODE = 'P0001';
                          END IF;
                          
                          IF OLD.status = 'cleared' AND NEW.status = 'uncleared' AND 
                             OLD.current_reconciliation_log_id IS NOT NULL THEN
                            RAISE EXCEPTION 'Cannot unclear a transaction that is part of an active reconciliation.'
                              USING ERRCODE = 'P0001';
                          END IF;
                          
                          RETURN NEW;
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_enforce_state_transitions
                          BEFORE UPDATE ON public.bank_register_state
                          FOR EACH ROW
                          WHEN (OLD.status IS DISTINCT FROM NEW.status)
                          EXECUTE FUNCTION enforce_bank_register_state_transitions();
   ```




4. **Update API endpoints** to check reconciliation lock before allowing edits:

- Add validation function `src/lib/bank-register-validation.ts`:
     ```typescript
                                        export async function validateBankTransactionEditable(
                                          transactionId: string,
                                          bankGlAccountId: string,
                                          supabase: SupabaseClient
                                        ): Promise<{ editable: boolean; reason?: string }> {
                                          const { data, error } = await supabase.rpc('has_reconciled_bank_lines', {
                                            p_transaction_id: transactionId,
                                            p_bank_gl_account_id: bankGlAccountId
                                          });
                                          
                                          if (error) throw error;
                                          if (data) {
                                            return { 
                                              editable: false, 
                                              reason: 'Bank-side transaction is part of a locked reconciliation. Only metadata (memo, date) can be edited.' 
                                            };
                                          }
                                          return { editable: true };
                                        }
     ```




### Phase 4: Create Audit Log System

**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_create_banking_audit_log.sql`
- `src/lib/banking-audit.ts` (new)

**Changes:**

1. **Create audit log table** following existing audit table patterns:
   ```sql
                        CREATE TABLE public.banking_audit_log (
                          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                          org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
                          actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                          action text NOT NULL CHECK (action IN (
                            'transaction_cleared',
                            'transaction_uncleared',
                            'transaction_reconciled',
                            'reconciliation_created',
                            'reconciliation_locked',
                            'reconciliation_unlocked',
                            'reconciliation_finalized',
                            'edit_blocked_reconciled',
                            'status_change_blocked',
                            'system_sync'
                          )),
                          
                          -- Entity references
                          transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
                          bank_gl_account_id uuid REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
                          reconciliation_id uuid REFERENCES public.reconciliation_log(id) ON DELETE SET NULL,
                          
                          -- Change details (append-only)
                          field_changes jsonb,
                          
                          -- Metadata
                          created_at timestamptz NOT NULL DEFAULT now()
                        );
                        
                        CREATE INDEX idx_banking_audit_log_org_id ON public.banking_audit_log(org_id);
                        CREATE INDEX idx_banking_audit_log_transaction_id ON public.banking_audit_log(transaction_id);
                        CREATE INDEX idx_banking_audit_log_reconciliation_id ON public.banking_audit_log(reconciliation_id);
                        CREATE INDEX idx_banking_audit_log_created_at ON public.banking_audit_log(created_at);
                        CREATE INDEX idx_banking_audit_log_action ON public.banking_audit_log(action);
                        CREATE INDEX idx_banking_audit_log_actor_user_id ON public.banking_audit_log(actor_user_id) 
                          WHERE actor_user_id IS NOT NULL;
   ```


**Key fix**: `actor_user_id` is nullable to allow system/sync actions (triggers running under service role) to log without a user. ON DELETE SET NULL remains appropriate.

2. **Add RLS policies** following existing patterns:
   ```sql
                        ALTER TABLE public.banking_audit_log ENABLE ROW LEVEL SECURITY;
                        
                        CREATE POLICY banking_audit_log_org_read
                          ON public.banking_audit_log FOR SELECT
                          USING (public.is_org_member((SELECT auth.uid()), org_id));
                          
                        -- Service role full access (for sync routes)
                        CREATE POLICY banking_audit_log_service_role_full_access
                          ON public.banking_audit_log
                          FOR ALL
                          USING (auth.role() = 'service_role')
                          WITH CHECK (auth.role() = 'service_role');
   ```




3. **Create audit logging function** (`src/lib/banking-audit.ts`):
     ```typescript
                                        export type BankingAuditAction = 
                                          | 'transaction_cleared'
                                          | 'transaction_uncleared'
                                          | 'transaction_reconciled'
                                          | 'reconciliation_created'
                                          | 'reconciliation_locked'
                                          | 'reconciliation_unlocked'
                                          | 'reconciliation_finalized'
                                          | 'edit_blocked_reconciled'
                                          | 'status_change_blocked'
                                          | 'system_sync';
                                        
                                        export async function logBankingAuditEvent(
                                          supabase: SupabaseClient,
                                          params: {
                                            orgId: string;
                                            actorUserId: string | null; // null for system/sync actions
                                            action: BankingAuditAction;
                                            transactionId?: string;
                                            bankGlAccountId?: string;
                                            reconciliationId?: string;
                                            fieldChanges?: Record<string, { old: unknown; new: unknown }>;
                                          }
                                        ) {
                                          const { error } = await supabase
                                            .from('banking_audit_log')
                                            .insert({
                                              org_id: params.orgId,
                                              actor_user_id: params.actorUserId,
                                              action: params.action,
                                              transaction_id: params.transactionId,
                                              bank_gl_account_id: params.bankGlAccountId,
                                              reconciliation_id: params.reconciliationId,
                                              field_changes: params.fieldChanges || {},
                                            });
                                          
                                          if (error) {
                                            // Log but don't throw - audit failures shouldn't block operations
                                            console.error('Failed to log banking audit event:', error);
                                          }
                                        }
     ```




4. **Add audit triggers** to log status changes and blocked attempts:
   ```sql
                        CREATE OR REPLACE FUNCTION audit_bank_register_state_changes()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public, pg_temp
                        AS $$
                        DECLARE
                          v_action text;
                        BEGIN
                          IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
                            -- Map status changes to audit actions
                            v_action := CASE 
                              WHEN NEW.status = 'cleared' THEN 'transaction_cleared'
                              WHEN NEW.status = 'uncleared' THEN 'transaction_uncleared'
                              WHEN NEW.status = 'reconciled' THEN 'transaction_reconciled'
                              ELSE 'system_sync'
                            END;
                            
                            INSERT INTO public.banking_audit_log (
                              org_id,
                              actor_user_id,
                              action,
                              transaction_id,
                              bank_gl_account_id,
                              reconciliation_id,
                              field_changes
                            ) VALUES (
                              NEW.org_id,
                              (SELECT auth.uid()), -- NULL if trigger runs under service role
                              v_action,
                              NEW.transaction_id,
                              NEW.bank_gl_account_id,
                              NEW.current_reconciliation_log_id,
                              jsonb_build_object(
                                'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
                                'reconciliation_id', jsonb_build_object('old', OLD.current_reconciliation_log_id, 'new', NEW.current_reconciliation_log_id)
                              )
                            );
                          END IF;
                          RETURN NEW;
                        END;
                        $$;
                        
                        CREATE TRIGGER trg_audit_bank_register_state_changes
                          AFTER UPDATE ON public.bank_register_state
                          FOR EACH ROW
                          WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_reconciliation_log_id IS DISTINCT FROM NEW.current_reconciliation_log_id)
                          EXECUTE FUNCTION audit_bank_register_state_changes();
   ```


**Audit coverage**:

- Logs successful status changes (cleared/uncleared/reconciled)
- Logs blocked edit attempts (via application layer, not trigger)
- Includes both user actions and system sync actions (actor_user_id nullable)

**Security**: Sets explicit `search_path` for SECURITY DEFINER function. `actor_user_id` will be NULL for system/sync actions (when `auth.uid()` is NULL).

### Phase 5: Buildium Reconciliation Sync Enhancement

**Files:**

- Update `src/app/api/admin/sync/reconciliations/route.ts`
- `src/lib/buildium-reconciliation-sync.ts` (new)

**Changes:**

1. **Add sync tracking fields** to `reconciliation_log`:
   ```sql
                        ALTER TABLE public.reconciliation_log
                          ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
                          ADD COLUMN IF NOT EXISTS last_sync_error text,
                          ADD COLUMN IF NOT EXISTS unmatched_buildium_transaction_ids integer[];
                          
                        COMMENT ON COLUMN public.reconciliation_log.last_synced_at IS 'Last successful sync timestamp';
                        COMMENT ON COLUMN public.reconciliation_log.last_sync_error IS 'Last sync error message (if any)';
                        COMMENT ON COLUMN public.reconciliation_log.unmatched_buildium_transaction_ids IS 'Buildium transaction IDs that could not be matched to local transactions';
   ```




2. **Extend existing sync route** (`src/app/api/admin/sync/reconciliations/route.ts`):

- **Fetch transactions only for open/updated reconciliations**: Skip finished reconciliations unless explicitly requested
- **Idempotent sync**: Only update on status change (compare existing state before updating)
- **Upsert cleared/reconciled state**: Update `bank_register_state` based on Buildium transaction status
- **After finalize**: Run single sync pass to mark all transactions as reconciled
- **Log unmatched transactions**: Track Buildium transaction IDs without local matches

3. **Create sync function** (`src/lib/buildium-reconciliation-sync.ts`):
     ```typescript
                                        export async function syncBuildiumReconciliationTransactions(
                                          reconciliationLogId: string,
                                          buildiumReconciliationId: number,
                                          bankGlAccountId: string,
                                          supabase: SupabaseClient,
                                          options?: {
                                            forceResync?: boolean; // Force resync even if already synced
                                            markReconciled?: boolean; // Mark as reconciled (for finalized reconciliations)
                                          }
                                        ): Promise<{
                                          synced: number;
                                          unmatched: number[];
                                          errors: Array<{ transactionId: number; error: string }>;
                                        }> {
                                          // 1. Fetch transactions from Buildium API: GET /bankaccounts/reconciliations/{id}/transactions
                                          // 2. For each Buildium transaction:
                                          //    a. Map Buildium transaction ID to local transaction_id (via buildium_transaction_id or other mapping)
                                          //    b. If matched: Update bank_register_state (status, current_reconciliation_log_id)
                                          //    c. If unmatched: Add to unmatched_buildium_transaction_ids array
                                          // 3. Update reconciliation_log.last_synced_at
                                          // 4. Log unmatched transactions for UI to surface "needs mapping"
                                          // 5. Return sync results
                                        }
     ```




4. **Add periodic parity checks**:

- Compare local ledger balance vs Buildium balance
- Compare local cleared/reconciled counts vs Buildium counts
- Alert on drift (surface in UI)

5. **Surface staleness in UI**:

- Show `last_synced_at` timestamp on reconciliation page
- Highlight reconciliations with `last_sync_error`
- Show unmatched transaction count



### Phase 6: Update Bank Register View

**Files:**

- Update `supabase/migrations/YYYYMMDDHHMMSS_update_v_bank_register_transactions.sql`

**Changes:**

1. **Update `v_bank_register_transactions`** to include status from `bank_register_state`:
     ```sql
                                        CREATE OR REPLACE VIEW public.v_bank_register_transactions AS
                                        SELECT 
                                          t.id,
                                          t.date,
                                          COALESCE(t.reference_number, t.check_number)::varchar(255) as reference_number,
                                          t.memo,
                                          t.total_amount,
                                          t.transaction_type,
                                          t.vendor_id,
                                          bank_line.bank_gl_account_id,
                                          bank_line.bank_amount,
                                          bank_line.bank_posting_type,
                                          COALESCE(brs.status, 'uncleared'::bank_entry_status_enum) as bank_entry_status,
                                          brs.current_reconciliation_log_id,
                                          brs.cleared_at,
                                          brs.reconciled_at,
                                          t.paid_by_label,
                                          t.paid_to_name
                                        FROM public.transactions t
                                        CROSS JOIN LATERAL (
                                          SELECT 
                                            tl.gl_account_id as bank_gl_account_id,
                                            tl.amount as bank_amount,
                                            tl.posting_type as bank_posting_type
                                          FROM public.transaction_lines tl
                                          JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
                                          WHERE tl.transaction_id = t.id
                                            AND ga.is_bank_account = true
                                          ORDER BY abs(coalesce(tl.amount, 0)) desc, case when tl.posting_type = 'Credit' then 0 else 1 end, tl.id asc
                                          LIMIT 1
                                        ) bank_line
                                        LEFT JOIN public.bank_register_state brs 
                                          ON brs.transaction_id = t.id 
                                          AND brs.bank_gl_account_id = bank_line.bank_gl_account_id
                                        WHERE bank_line.bank_gl_account_id IS NOT NULL;
     ```


**Key changes**:

- Joins with `bank_register_state` to get status
- Uses existing bank line resolution logic from current view
- Defaults to 'uncleared' if no state row exists (backward compatible)



### Phase 7: Update UI Components

**Files:**

- Update `src/components/reconciliations/ClearingPanel.tsx`
- Create `src/app/(protected)/bank-accounts/[id]/reconciliation/page.tsx` (new)
- Update `src/app/(protected)/bank-accounts/[id]/page.tsx`

**Changes:**

1. Update ClearingPanel to use local bank_register_entries instead of Buildium API directly
2. Add "Cleared" and "Uncleared" tabs/filters to bank register view
3. Show reconciliation status and lock indicators
4. Add audit log viewer for banking operations

## Migration Strategy

1. **Migration sequencing**:

- Create enum type first (before table)
- Create table and indexes
- Add RLS policies
- Create trigger functions (with explicit search_path)
- Create triggers
- Backfill existing data (see below)

2. **Backfill existing data** from Buildium reconciliations:
     ```sql
                                        -- Step 1: Create state rows for all bank-side transactions (default 'uncleared')
                                        INSERT INTO public.bank_register_state (
                                          org_id,
                                          bank_gl_account_id,
                                          transaction_id,
                                          status
                                        )
                                        SELECT DISTINCT
                                          t.org_id,
                                          tl.gl_account_id,
                                          tl.transaction_id,
                                          'uncleared'::bank_entry_status_enum
                                        FROM public.transaction_lines tl
                                        JOIN public.transactions t ON t.id = tl.transaction_id
                                        JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
                                        WHERE ga.is_bank_account = true
                                        ON CONFLICT (org_id, bank_gl_account_id, transaction_id) DO NOTHING;
                                        
                                        -- Step 2: Sync from Buildium reconciliations (via API/script, not SQL)
                                        -- For each finished reconciliation:
                                        --   - Fetch Buildium transactions
                                        --   - Match to local transactions (via buildium_transaction_id or other mapping)
                                        --   - Update status to 'reconciled' and set current_reconciliation_log_id
                                        --   - Mark cleared_at/reconciled_at timestamps
     ```


**Backfill strategy**:

- Create state rows for all bank-side transactions (default 'uncleared')
- Run Buildium reconciliation sync to populate cleared/reconciled status
- Match Buildium transaction IDs to local transactions
- Mark as 'reconciled' for finished reconciliations



3. **Gradual rollout**: Add feature flags to enable reconciliation locks per org
4. **Dual-write period**: Continue syncing from Buildium while also maintaining local state
5. **Validation**: Compare local book balance with Buildium book balance during transition
6. **Down-migration considerations**:

- Drop triggers before dropping functions (in reverse order of creation)
- Drop audit log table before dropping bank_register_state (if cascade doesn't handle it)
- Drop bank_register_state table before enum type (or use `DROP TYPE CASCADE`)
- Remove added columns from reconciliation_log (optional - safe to leave)
- Document rollback procedure for reconciliation lock feature flag

## Testing Requirements

1. Unit tests for bank register entry creation triggers
2. Integration tests for reconciliation lock enforcement
3. Tests for audit log capture
4. Tests for book balance calculation
5. E2E tests for reconciliation workflow

## Documentation Updates

1. Update `docs/database/DATABASE_SCHEMA.md` with new tables
2. Create `docs/banking-reconciliation-guide.md`
3. Update API documentation with new endpoints
4. Document audit log querying patterns

## Dependencies

- Existing `gl_accounts` table with `is_bank_account` flag
- Existing `transactions` and `transaction_lines` tables
- Existing `reconciliation_log` table
- Buildium API integration for reconciliation data