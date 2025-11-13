# Monthly Log Audit & Enhancement Plan (Final)

## November 2025 UI Refresh

- Kanban columns have been replaced by a tabbed list (Incomplete / Complete).
- Stage-specific screens are represented as inline sections on the detail page.
- Statements, tasks, and transaction assignment remain within the detail view, retaining all API contracts.

## Key Refinements from Feedback

1. **Reduced API Duplication**: Shared generic stage transaction handler replaces 8 separate assign/unassign endpoints
2. **Denormalized Balance Reconciliation**: Clear triggers and reconciliation checks to prevent drift
3. **Escrow GL Account Validation**: Fail-fast checks with configuration validation
4. **Phased PDF Delivery**: Phase 4a (HTML preview + simple PDF), Phase 4b (attachment merging)
5. **Email Sender Verification**: Added SPF/DKIM setup checklist
6. **Distributed Testing**: Integration tests baked into each phase, not deferred to Phase 6
7. **Permission Propagation**: Explicit UI update checklist when permissions change
8. **Journal Entry Amount Normalization**: `monthly_log_transaction_bundle` now derives display amounts and escrow totals from `transaction_lines`, keeping unit-level journal entries (e.g. Tax Escrow) in sync between the grid and financial summary.

---

## 1. Codebase Inventory & Current Behavior

### Database Schema

- **monthly_logs** table (`supabase/migrations/20251012100000_127_create_monthly_logs.sql`):
  - Tracks workflow per unit/month with 7 stages: charges, payments, bills, escrow, management_fees, owner_statements, owner_distributions
  - Stores denormalized amounts per stage (charges_amount, payments_amount, bills_amount, escrow_amount, management_fees_amount)
  - Links: org_id, property_id, unit_id, tenant_id, period_start (unique per unit/month)
  - Status: pending, in_progress, complete

- **transactions** table: stores all financial events (Charge, Payment, Bill, Credit, etc.)
- **transaction_lines** table: double-entry GL postings; now has monthly_log_id FK for association
- **units** table: has balance, prepayments_balance, deposits_held_balance fields
- **lease** table: tracks lease_from_date, lease_to_date, rent_amount, status
- **properties** table: has service_plan, active_services[], fee_dollar_amount, billing_frequency

### API Endpoints

- `POST /api/monthly-logs` (`src/app/api/monthly-logs/route.ts`): creates new monthly log
- `GET /api/monthly-logs/[logId]/transactions` (`src/app/api/monthly-logs/[logId]/transactions/route.ts`): fetches assigned transactions
- `POST /api/monthly-logs/[logId]/transactions/assign` (`src/app/api/monthly-logs/[logId]/transactions/assign/route.ts`): assigns transactions to log
- `DELETE /api/monthly-logs/[logId]/transactions/[transactionId]/unassign`: unassigns transaction
- `GET /api/monthly-logs/[logId]/financial-summary` (`src/app/api/monthly-logs/[logId]/financial-summary/route.ts`): calculates totals from assigned transactions
- `PATCH /api/monthly-logs/[logId]/update`: updates stage/status
- **Missing**: endpoints for CRUD per stage, statement generation, email sending, escrow operations

### UI Components

- `src/components/monthly-logs/MonthlyLogDetailPageContent.tsx`: main orchestration, recently optimized with `useMonthlyLogData` hook
- `src/components/monthly-logs/EnhancedChargesStage.tsx`: **IMPLEMENTED** - assigns/unassigns charge transactions, optimistic UI
- `src/components/monthly-logs/PaymentsStage.tsx`: **STUB** - "Coming soon"
- `src/components/monthly-logs/BillsStage.tsx`: **STUB** - "Coming soon"
- `src/components/monthly-logs/EscrowStage.tsx`: **STUB** - "Coming soon"
- `src/components/monthly-logs/ManagementFeesStage.tsx`: **STUB** - needs implementation
- `src/components/monthly-logs/OwnerDrawStage.tsx`: **STUB** - needs implementation
- `src/components/monthly-logs/StatementsStage.tsx`: **STUB** - needs PDF generation and email flow
- `src/components/monthly-logs/EnhancedFinancialSummaryCard.tsx`: displays totals, uses `useMonthlyLogData`
- `src/hooks/useMonthlyLogData.ts`: centralized state for assigned/unassigned transactions, financial summary, optimistic updates

### Current Stage Implementations

- **Charges**: functional - assigns/unassigns transactions, shows assigned/unassigned lists, bulk actions
- **Payments, Bills, Escrow, Management Fees, Owner Distributions, Statements**: all stubs

---

## 2. Gaps vs. Required Behavior

| Requirement                                                | Status        | Gap Details                                                                                                |
| ---------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| Record all monthly financial activity                      | Partially Met | Only Charges stage implemented; Payments/Bills/Escrow/Mgmt Fees are stubs                                  |
| Auto-calculate Owner Draw                                  | Missing       | Formula present in financial-summary API but not displayed; needs dedicated Owner Distributions stage      |
| Owner Draw = Payments – Bills – Escrow                     | Partially Met | Calculation exists but uses incorrect formula (Charges + Payments – Bills – Mgmt Fees); escrow not tracked |
| Generate Monthly Statement PDF                             | Missing       | No PDF generation pipeline, no statement layout component                                                  |
| Email statement with bill/payment PDFs                     | Missing       | No email service integration, no recipient management, no attachment logic                                 |
| Stages: Charges, Payments, Bills, Escrow, Mgmt Fees        | Partially Met | Only Charges functional; others are stubs                                                                  |
| Unassociated transactions review                           | Met           | Charges stage shows unassigned transactions and allows assignment                                          |
| Add/remove/delete transactions per stage                   | Partially Met | Only Charges has assign/unassign; no add/delete, no other stages                                           |
| Lease snapshot (dates, rent, days remaining, tenant names) | Met           | Page.tsx fetches activeLease with all required fields                                                      |
| Management summary (plan, services, fee, notes, frequency) | Partially Met | Data fetched from units table but not prominently displayed in UI                                          |
| **Payments stage**: Total Rent Owed                        | Missing       | Formula not implemented: Prev Month Balance + Lease Charges – Lease Credits                                |
| **Payments stage**: Remaining Rent Balance                 | Missing       | Not calculated                                                                                             |
| **Payments stage**: Total Fee Charges                      | Missing       | Payment processing fees not tracked separately                                                             |
| **Escrow stage**: deposits/withdrawals + running balance   | Missing       | No escrow ledger; escrow_amount on monthly_logs is a simple aggregate                                      |

---

## 3. Proposed Enhancements

### 3.1 Data Model Changes

#### A. Add previous_balance to monthly_logs (with reconciliation)

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_previous_balance_to_monthly_logs.sql
ALTER TABLE monthly_logs
  ADD COLUMN previous_lease_balance NUMERIC(14,2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN monthly_logs.previous_lease_balance IS
  'Lease balance from prior month. Recalculated on log creation and stage completion. See reconcile_monthly_log_balance() function.';

-- Reconciliation function
CREATE OR REPLACE FUNCTION reconcile_monthly_log_balance(p_monthly_log_id UUID)
RETURNS VOID AS $$
DECLARE
  v_unit_id UUID;
  v_period_start DATE;
  v_prior_month DATE;
  v_prior_balance NUMERIC(14,2);
BEGIN
  SELECT unit_id, period_start INTO v_unit_id, v_period_start
  FROM monthly_logs WHERE id = p_monthly_log_id;

  v_prior_month := v_period_start - INTERVAL '1 month';

  SELECT COALESCE(charges_amount - payments_amount, 0) INTO v_prior_balance
  FROM monthly_logs
  WHERE unit_id = v_unit_id
    AND period_start = DATE_TRUNC('month', v_prior_month)
  LIMIT 1;

  UPDATE monthly_logs
  SET previous_lease_balance = v_prior_balance
  WHERE id = p_monthly_log_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: recalculate on log creation
CREATE OR REPLACE FUNCTION trg_set_previous_balance()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM reconcile_monthly_log_balance(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_log_set_previous_balance
AFTER INSERT ON monthly_logs
FOR EACH ROW
EXECUTE FUNCTION trg_set_previous_balance();

-- Also recalculate when stage changes to 'payments' or 'complete'
CREATE OR REPLACE FUNCTION trg_recalc_balance_on_stage_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.stage IN ('payments', 'complete') AND OLD.stage <> NEW.stage) THEN
    PERFORM reconcile_monthly_log_balance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_log_recalc_balance_on_stage
AFTER UPDATE OF stage ON monthly_logs
FOR EACH ROW
EXECUTE FUNCTION trg_recalc_balance_on_stage_update();
```

**Reconciliation Check Endpoint**:

```typescript
// src/app/api/monthly-logs/[logId]/reconcile/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  await supabase.rpc('reconcile_monthly_log_balance', { p_monthly_log_id: logId });
  return NextResponse.json({ success: true });
}
```

**TypeScript Helper Function**:

```typescript
// src/lib/monthly-log-calculations.ts
export async function getPreviousLeaseBalance(
  unitId: string,
  periodStart: string,
): Promise<number> {
  const priorMonth = subMonths(parseISO(periodStart), 1);
  const priorLog = await supabase
    .from('monthly_logs')
    .select('charges_amount, payments_amount')
    .eq('unit_id', unitId)
    .eq('period_start', format(priorMonth, 'yyyy-MM-01'))
    .maybeSingle();

  if (!priorLog) return 0;

  // Previous balance = charges - payments from prior month
  return priorLog.charges_amount - priorLog.payments_amount;
}
```

#### B. Escrow tracking via GL accounts (with validation)

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_seed_escrow_gl_account.sql
-- Ensure at least one escrow GL account exists and is properly categorized

DO $$
DECLARE
  v_escrow_account_id UUID;
BEGIN
  -- Check if escrow GL account exists
  SELECT id INTO v_escrow_account_id
  FROM gl_accounts
  WHERE name ILIKE '%escrow%' OR name ILIKE '%security deposit%'
  LIMIT 1;

  IF v_escrow_account_id IS NULL THEN
    -- Create default escrow GL account
    INSERT INTO gl_accounts (name, account_type, gl_number)
    VALUES ('Tenant Security Deposits Held', 'Liability', '2100')
    RETURNING id INTO v_escrow_account_id;
  END IF;

  -- Ensure it's categorized as 'deposit'
  INSERT INTO gl_account_category (gl_account_id, category)
  VALUES (v_escrow_account_id, 'deposit'::gl_category)
  ON CONFLICT (gl_account_id) DO UPDATE SET category = 'deposit'::gl_category;

  RAISE NOTICE 'Escrow GL account configured: %', v_escrow_account_id;
END $$;
```

```typescript
// src/lib/escrow-calculations.ts
export async function getEscrowBalance(
  unitId: string,
  upToDate: string,
): Promise<{
  deposits: number;
  withdrawals: number;
  balance: number;
  hasValidGLAccounts: boolean;
}> {
  // Validate escrow GL accounts exist
  const { data: escrowAccounts } = await supabase
    .from('gl_accounts')
    .select('id, gl_account_category!inner(category)')
    .eq('gl_account_category.category', 'deposit');

  if (!escrowAccounts || escrowAccounts.length === 0) {
    console.error('No escrow GL accounts configured');
    return { deposits: 0, withdrawals: 0, balance: 0, hasValidGLAccounts: false };
  }

  const escrowGLAccountIds = escrowAccounts.map((a) => a.id);

  const { data: lines } = await supabase
    .from('transaction_lines')
    .select('amount, posting_type')
    .eq('unit_id', unitId)
    .lte('date', upToDate)
    .in('gl_account_id', escrowGLAccountIds);

  let deposits = 0,
    withdrawals = 0;
  lines?.forEach((line) => {
    const amt = Math.abs(line.amount);
    if (line.posting_type === 'Credit') deposits += amt;
    else withdrawals += amt;
  });

  return { deposits, withdrawals, balance: deposits - withdrawals, hasValidGLAccounts: true };
}
```

#### C. Payment processing fees

```typescript
// Example in payment creation endpoint
await supabase.from('transaction_lines').insert({
  transaction_id: paymentTxId,
  gl_account_id: processingFeeGLAccountId,
  amount: feeAmount,
  posting_type: 'Debit',
  unit_id,
  date,
  memo: 'Payment processing fee',
});
```

#### D. Statement recipients on properties table

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_statement_recipients_to_properties.sql
ALTER TABLE properties
  ADD COLUMN statement_recipients JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN properties.statement_recipients IS
  'Array of {email, name, role} objects for monthly statement delivery';

-- Example: [{"email":"owner@example.com","name":"John Doe","role":"owner"}]
```

#### E. Statement generation audit log

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_create_statement_emails_table.sql
CREATE TABLE IF NOT EXISTS statement_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_log_id UUID NOT NULL REFERENCES monthly_logs(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by_user_id UUID REFERENCES auth.users(id),
  recipients JSONB NOT NULL, -- [{email, name, status: "sent"|"failed"}]
  pdf_url TEXT,
  email_provider_id TEXT, -- Resend message ID
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_statement_emails_monthly_log_id ON statement_emails(monthly_log_id);
CREATE INDEX idx_statement_emails_sent_at ON statement_emails(sent_at DESC);
```

#### F. Add pdf_url to monthly_logs

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_pdf_url_to_monthly_logs.sql
ALTER TABLE monthly_logs
  ADD COLUMN pdf_url TEXT;

COMMENT ON COLUMN monthly_logs.pdf_url IS
  'Public URL of generated monthly statement PDF in storage';
```

---

### 3.2 Calculations (Explicit Formulas)

**Owner Draw**:

```typescript
// src/lib/monthly-log-calculations.ts
export function calculateOwnerDraw(summary: {
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
}): number {
  return summary.totalPayments - summary.totalBills - summary.escrowAmount;
}
```

**Payments Stage - Total Rent Owed**:

```typescript
export function calculateTotalRentOwed(params: {
  previousLeaseBalance: number;
  leaseCharges: number; // sum of Charge transactions for this lease in this month
  leaseCredits: number; // sum of Credit transactions for this lease in this month
}): number {
  return params.previousLeaseBalance + params.leaseCharges - params.leaseCredits;
}
```

**Payments Stage - Remaining Rent Balance**:

```typescript
export function calculateRemainingRentBalance(params: {
  totalRentOwed: number;
  paymentsApplied: number; // sum of Payment transactions for this lease in this month
}): number {
  return params.totalRentOwed - params.paymentsApplied;
}
```

**Payments Stage - Total Fee Charges**:

```typescript
export async function getTotalFeeCharges(monthlyLogId: string): Promise<number> {
  // Query transaction_lines linked to payments in this log, filtered by processing fee GL account
  const { data } = await supabase
    .from('transaction_lines')
    .select(
      'amount, transactions!inner(monthly_log_id), gl_accounts!inner(gl_account_category!inner(category))',
    )
    .eq('transactions.monthly_log_id', monthlyLogId)
    .eq('gl_accounts.gl_account_category.category', 'expense') // or specific fee category
    .ilike('memo', '%processing fee%');

  return data?.reduce((sum, line) => sum + Math.abs(line.amount), 0) ?? 0;
}
```

---

### 3.3 UI/UX Enhancements

#### Payments Stage (`src/components/monthly-logs/PaymentsStage.tsx`)

**New Implementation**:

- Display summary card:
  - Previous Month Lease Balance: `${previous_lease_balance}`
  - Current Month Charges: sum of assigned Charge transactions
  - Current Month Credits: sum of assigned Credit transactions
  - **Total Rent Owed**: calculated formula
  - Payments Applied: sum of assigned Payment transactions
  - **Remaining Rent Balance**: calculated formula
  - **Total Fee Charges**: queried from transaction_lines
- Table of assigned Payment transactions (similar to Charges stage)
- Unassigned Payments list with assign action
- Bulk unassign action

#### Bills Stage (`src/components/monthly-logs/BillsStage.tsx`)

- List assigned Bill transactions
- Show unassigned Bills
- Assign/unassign actions
- Display total bills amount

#### Escrow Stage (`src/components/monthly-logs/EscrowStage.tsx`)

- Current month escrow movements table:
  - Date, Description (from memo), Type (Deposit/Withdrawal), Amount
- Running balance display at top
- Option to add new escrow transaction (opens modal to create transaction_line)
- Query `getEscrowBalance` for unit up to period end
- **Validation Alert**: If `hasValidGLAccounts === false`, show warning banner:
  - "Escrow GL accounts not configured. Contact administrator to set up Security Deposit liability accounts."
  - Disable "Add Escrow Transaction" button

#### Management Fees Stage (`src/components/monthly-logs/ManagementFeesStage.tsx`)

- Display management summary from units table:
  - Service Plan
  - Active Services (array display)
  - Management Fee amount
  - Billing Frequency
- List assigned management fee transactions
- Button to auto-generate management fee transaction based on units.fee_dollar_amount
- Assign/unassign actions

#### Owner Distributions Stage (`src/components/monthly-logs/OwnerDrawStage.tsx`)

- Display Owner Draw calculation prominently
- Formula breakdown: Payments – Bills – Escrow = $X
- Historical comparison (if prior months available)
- Notes field for manual adjustments or commentary

#### Statements Stage (`src/components/monthly-logs/StatementsStage.tsx`)

- Preview section: HTML version of statement (reuses same component PDF will render)
- "Generate PDF" button → triggers server action
- Once generated, "Download PDF" link
- Email section:
  - Shows recipients from properties.statement_recipients
  - "Edit Recipients" button (opens modal to update property.statement_recipients)
  - "Send Statement" button → triggers email via Resend
  - Audit log table showing past sends (from statement_emails table)

---

### 3.4 PDF Generation Pipeline (Phased Delivery)

**Phase 4a: HTML Preview + Simple PDF**

**Files**:

- `src/components/statements/StatementTemplate.tsx`: React component for statement layout
- `src/lib/pdf/statement-generator.ts`: Puppeteer HTML→PDF (single statement only, no attachments yet)
- `src/app/api/monthly-logs/[logId]/statement/preview/route.ts`: returns HTML preview
- `src/app/api/monthly-logs/[logId]/statement/generate/route.ts`: generates PDF, uploads to storage

**Flow**:

1. User navigates to Statements stage
2. Component renders StatementTemplate with monthly log data (HTML preview)
3. User clicks "Generate PDF"
4. POST `/api/monthly-logs/[logId]/statement/generate`
5. Server renders StatementTemplate to HTML, launches Puppeteer, generates PDF
6. Uploads to Supabase storage, returns URL
7. UI shows "Download PDF" link

**Statement Layout** (in `StatementTemplate.tsx`):

- Header: Property name, Unit, Period
- Lease Snapshot: tenant names, lease dates, rent amount, days remaining
- Management Summary: service plan, active services, fee, frequency
- Income Section:
  - Charges: itemized list with dates and amounts
  - Payments: itemized list
  - Subtotal Income
- Deductions Section:
  - Bills: itemized list
  - Escrow: deposits/withdrawals table with running balance
  - Management Fees: itemized list
  - Subtotal Deductions
- **Owner Draw** = Income – Deductions (prominently displayed)
- Footer: generated date, contact info

**Implementation Details**:

- Pure presentational component
- Accepts all data as props
- Styled with inline CSS (or Tailwind classes compiled to inline via PostCSS)
- Printable layout (A4 size, proper margins)

**Phase 4b: PDF Attachment Merging** (separate phase after 4a ships)

**Files**:

- `src/lib/pdf/merge-pdfs.ts`: pdf-lib logic to append bill/payment PDFs
- Update `statement-generator.ts` to call merge-pdfs after main statement generated

**Flow**:

1. After main statement PDF generated, query files table for bill/payment attachments
2. Download attachment PDFs
3. Use pdf-lib to merge: statement first, then bills (by date), then payments (by date)
4. Upload merged PDF, replace URL

**Why Phased**: PDF merging adds complexity (fetching attachments, handling missing files, memory limits). Shipping HTML preview + simple PDF first provides immediate value and de-risks the critical path.

---

### 3.5 Email Flow (with sender verification)

**Service**: Resend

**Pre-Deployment Checklist**:

1. [ ] Domain verified in Resend dashboard
2. [ ] SPF record added to DNS: `v=spf1 include:_spf.resend.com ~all`
3. [ ] DKIM record added to DNS (provided by Resend after domain verification)
4. [ ] Test send to personal email to verify deliverability
5. [ ] Monitor Resend dashboard for bounce/spam rates first week

**Environment**:

```
RESEND_API_KEY=re_...
FROM_EMAIL=statements@yourdomain.com  # Must match verified domain
```

**Files**:

- `src/lib/email/resend-client.ts`
- `src/lib/email/send-statement.ts`
- `src/lib/email/templates/statement-email.html` (or .tsx if using React Email)
- `src/app/api/monthly-logs/[logId]/statement/send/route.ts`

**Flow**:

1. User clicks "Send Statement" in Statements stage
2. POST `/api/monthly-logs/[logId]/statement/send` with idempotency key
3. Server:
   - Checks if statement already sent (query statement_emails for this log)
   - If idempotency key matches existing send, return success (idempotent)
   - Fetches recipients from properties.statement_recipients
   - Downloads PDF from storage
   - Calls Resend API:
     ```typescript
     await resend.emails.send({
       from: 'statements@yourdomain.com',
       to: recipients.map((r) => r.email),
       subject: `Monthly Statement - ${propertyName} ${unitNumber} - ${periodMonth}`,
       attachments: [{ filename: 'statement.pdf', content: pdfBuffer }],
       html: emailTemplate, // simple HTML wrapper with link to portal
     });
     ```
   - Logs to statement_emails table with Resend message ID, recipients, status
4. Returns success/error
5. UI shows toast notification, updates audit log table

**Email Template** (simple HTML):

```html
<h2>Monthly Statement Attached</h2>
<p>Dear Owner,</p>
<p>Your monthly statement for {property} - {unit} for {period} is attached.</p>
<p>Total Owner Draw: ${ownerDraw}</p>
<p><a href="{portal_link}">View in Portal</a></p>
```

**Idempotency**: Use monthly_log_id + timestamp hash as idempotency key; store in statement_emails.email_provider_id or separate field

**Retry Policy**: If Resend fails, log error in statement_emails; UI shows "Retry" button

---

### 3.6 Permissions & Authorization (with UI propagation)

**Add Monthly Logs permissions** to `src/lib/permissions.ts`:

```typescript
export type Permission =
  | 'monthly_logs.read'
  | 'monthly_logs.write'
  | 'monthly_logs.approve'
  | 'monthly_logs.send_statement'
  // ... existing permissions

const Matrix: Record<AppRole, Permission[]> = {
  platform_admin: ['monthly_logs.read', 'monthly_logs.write', 'monthly_logs.approve', 'monthly_logs.send_statement', ...],
  org_admin: ['monthly_logs.read', 'monthly_logs.write', 'monthly_logs.approve', 'monthly_logs.send_statement', ...],
  org_manager: ['monthly_logs.read', 'monthly_logs.write', 'monthly_logs.approve', 'monthly_logs.send_statement', ...],
  org_staff: ['monthly_logs.read', 'monthly_logs.write'],
  owner_portal: ['monthly_logs.read'],
  tenant_portal: [],
}
```

**Enforce in API endpoints**:

```typescript
// src/app/api/monthly-logs/[logId]/statement/send/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  const auth = await requireAuth();
  if (!hasPermission(auth.roles, 'monthly_logs.send_statement')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ...
}
```

**UI guards**:

```tsx
// src/components/monthly-logs/StatementsStage.tsx
const canSendStatement = hasPermission(userRoles, 'monthly_logs.send_statement');

<Button disabled={!canSendStatement} onClick={handleSend}>
  Send Statement
</Button>;
```

**UI Permission Propagation Checklist**:

1. [ ] Update all stage components to check `monthly_logs.write` before showing assign/unassign buttons
2. [ ] Update "Mark Stage Complete" button to check `monthly_logs.approve`
3. [ ] Update "Send Statement" button to check `monthly_logs.send_statement`
4. [ ] Update MonthlyLogsPageContent to check `monthly_logs.read` (show/hide entire feature)
5. [ ] Add permission checks to any existing navigation menus that link to monthly logs
6. [ ] Test with org_staff role to verify buttons correctly disabled

---

### 3.7 Performance Optimizations

**N+1 Query Prevention**:

- Use `useMonthlyLogData` hook (already implemented) for centralized fetching
- Batch queries: fetch all transactions, lease data, management data in single calls

**Pagination**:

- For large transaction lists (>100 items), add pagination to tables
- Use `limit` and `offset` in Supabase queries

**Caching**:

- Cache PDF URLs in monthly_logs.pdf_url field
- Cache financial summary calculations in monthly_logs denormalized amount fields

**Background Jobs** (for PDF/email in production):

- Use Supabase Edge Functions or separate worker queue (e.g., BullMQ) for long-running PDF generation
- Return job ID immediately, poll for completion
- For now, synchronous is acceptable (with 30s timeout)

**Server Components** (already used):

- `src/app/(protected)/monthly-logs/[logId]/page.tsx` is a server component, fetches data server-side

---

## 4. Endpoints / Server Actions

### New/Updated Endpoints (Revised)

| Method   | Path                                                 | Purpose                                    | Request                                                                                                               | Response                                                                                       |
| -------- | ---------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **POST** | `/api/monthly-logs/[logId]/stage-transactions`       | **Generic assign/unassign for all stages** | `{ stage: 'payments'\|'bills'\|'escrow'\|'management_fees', transactionIds: string[], action: 'assign'\|'unassign' }` | `{ success: true }`                                                                            |
| GET      | `/api/monthly-logs/[logId]/payments`                 | Fetch payment stage data                   | -                                                                                                                     | `{ previousBalance, charges, credits, payments, totalRentOwed, remainingBalance, feeCharges }` |
| GET      | `/api/monthly-logs/[logId]/bills`                    | Fetch bills stage data                     | -                                                                                                                     | `{ assignedBills, unassignedBills, totalBills }`                                               |
| GET      | `/api/monthly-logs/[logId]/escrow`                   | Fetch escrow movements                     | -                                                                                                                     | `{ deposits, withdrawals, balance, movements: [...], hasValidGLAccounts }`                     |
| POST     | `/api/monthly-logs/[logId]/escrow`                   | Add new escrow transaction                 | `{ type: 'deposit'\|'withdrawal', amount, memo, date }`                                                               | `{ success: true, transactionId }`                                                             |
| GET      | `/api/monthly-logs/[logId]/management-fees`          | Fetch mgmt fee data                        | -                                                                                                                     | `{ servicePlan, activeServices, managementFee, frequency, assignedFees, totalFees }`           |
| POST     | `/api/monthly-logs/[logId]/management-fees/generate` | Auto-generate fee transaction              | -                                                                                                                     | `{ success: true, transactionId }`                                                             |
| GET      | `/api/monthly-logs/[logId]/owner-draw`               | Calculate owner draw                       | -                                                                                                                     | `{ ownerDraw, breakdown: { payments, bills, escrow } }`                                        |
| POST     | `/api/monthly-logs/[logId]/reconcile`                | Recalculate previous balance               | -                                                                                                                     | `{ success: true }`                                                                            |
| PATCH    | `/api/properties/[propertyId]/statement-recipients`  | Update recipients                          | `{ recipients: [{email, name, role}] }`                                                                               | `{ success: true }`                                                                            |

**Phase 4a endpoints**:
| GET | `/api/monthly-logs/[logId]/statement/preview` | HTML preview of statement | - | HTML string |
| POST | `/api/monthly-logs/[logId]/statement/generate` | Generate PDF (no attachments yet) | `{ idempotencyKey: string }` | `{ success: true, pdfUrl: string }` |

**Phase 4b endpoints** (after 4a):
| POST | `/api/monthly-logs/[logId]/statement/generate` | Generate PDF with attachments | `{ idempotencyKey: string, includeAttachments: true }` | `{ success: true, pdfUrl: string }` |
| POST | `/api/monthly-logs/[logId]/statement/send` | Send email | `{ idempotencyKey: string }` | `{ success: true, emailId: string }` |
| GET | `/api/monthly-logs/[logId]/statement/history` | Email audit log | - | `{ emails: [...] }` |

**Reduced from 13 to 11 endpoints** (in initial phases) by using shared stage-transactions handler.

**Validation**: Use Zod schemas for all request bodies

**Idempotency**: For POST /generate and POST /send, require `idempotencyKey` header; check existing records before processing

**Error Handling**: Return `{ error: { code, message } }` with appropriate HTTP status (400, 403, 404, 500)

---

## 5. Component/File-Level Implementation Plan (Revised)

### Phase 1: Data Model & Calculations (Week 1)

**Files to Create/Update**:

1. `supabase/migrations/YYYYMMDDHHMMSS_add_previous_balance_to_monthly_logs.sql` (with triggers and reconciliation function)
2. `supabase/migrations/YYYYMMDDHHMMSS_seed_escrow_gl_account.sql` (validation seed)
3. `supabase/migrations/YYYYMMDDHHMMSS_add_statement_recipients_to_properties.sql`
4. `supabase/migrations/YYYYMMDDHHMMSS_create_statement_emails_table.sql`
5. `supabase/migrations/YYYYMMDDHHMMSS_add_pdf_url_to_monthly_logs.sql`
6. `src/lib/monthly-log-calculations.ts` (all formulas)
7. `src/lib/escrow-calculations.ts` (with GL validation)
8. `src/lib/monthly-log-stage-handler.ts` (generic stage transaction handler)
9. Update `src/lib/permissions.ts`: add monthly_logs permissions
10. Update `src/lib/rbac.ts`: add monthly-logs route rules

**Testing**:

- Unit tests for all calculation functions (use Vitest)
- Test reconcile_monthly_log_balance() function with various scenarios
- Test escrow GL validation returns `hasValidGLAccounts: false` when misconfigured

**Complexity**: Medium (5-7 days including testing)

---

### Phase 2: API Endpoints (Week 2)

**Shared Infrastructure**:

1. `src/lib/monthly-log-stage-handler.ts`: generic assign/unassign logic
2. `src/schemas/stage-transactions.ts`: Zod schema for validation

**Endpoints to Create**:

1. `src/app/api/monthly-logs/[logId]/stage-transactions/route.ts` (POST - generic)
2. `src/app/api/monthly-logs/[logId]/payments/route.ts` (GET)
3. `src/app/api/monthly-logs/[logId]/bills/route.ts` (GET)
4. `src/app/api/monthly-logs/[logId]/escrow/route.ts` (GET + POST)
5. `src/app/api/monthly-logs/[logId]/management-fees/route.ts` (GET)
6. `src/app/api/monthly-logs/[logId]/management-fees/generate/route.ts` (POST)
7. `src/app/api/monthly-logs/[logId]/owner-draw/route.ts` (GET)
8. `src/app/api/monthly-logs/[logId]/reconcile/route.ts` (POST)
9. `src/app/api/properties/[propertyId]/statement-recipients/route.ts` (PATCH)

**Testing** (distributed, not deferred):

- Write integration test for each endpoint as it's created
- Test permission guards with different roles
- Test Zod validation with invalid inputs
- Test generic stage-transactions handler with all stage types

**Complexity**: Medium (6-8 days including distributed testing)

---

### Phase 3: UI Stage Components (Week 3-4)

**Files to Create/Update**:

1. `src/components/monthly-logs/PaymentsStage.tsx`: full implementation
2. `src/components/monthly-logs/BillsStage.tsx`: full implementation
3. `src/components/monthly-logs/EscrowStage.tsx`: full implementation (with GL validation alert)
4. `src/components/monthly-logs/ManagementFeesStage.tsx`: full implementation
5. `src/components/monthly-logs/OwnerDrawStage.tsx`: full implementation
6. Update `src/hooks/useMonthlyLogData.ts`: extend for generic stage-transactions endpoint
7. Update all stage components to use new generic assign/unassign endpoint
8. Update `EnhancedFinancialSummaryCard.tsx` to use correct Owner Draw formula
9. `src/components/monthly-logs/StatementPreview.tsx` (new): HTML preview of statement

**Patterns**:

- Reuse `EnhancedChargesStage` pattern for Payments/Bills: show assigned, show unassigned, assign/unassign actions
- Use optimistic updates (as in Charges stage) for instant feedback
- Display loading skeletons during fetches
- Toast notifications for success/error
- All components client-side (`'use client'`)

**UI Permission Propagation**:

- Add permission checks to all buttons
- Test with org_staff role to verify correct disabling

**Testing**:

- Manual QA of each stage with real data
- Test optimistic UI updates
- Test permission-based button disabling

**Complexity**: High (10-12 days)

---

### Phase 4a: HTML Preview + Simple PDF (Week 5)

**Files to Create**:

1. `src/components/statements/StatementTemplate.tsx`
2. `src/lib/pdf/statement-generator.ts` (Puppeteer, no attachments)
3. `src/app/api/monthly-logs/[logId]/statement/preview/route.ts`
4. `src/app/api/monthly-logs/[logId]/statement/generate/route.ts`

**Dependencies**:

```bash
npm install puppeteer
```

**Implementation**:

- `statement-generator.ts`:
  - Fetch all monthly log data
  - Render `StatementTemplate` to HTML string using ReactDOMServer
  - Launch Puppeteer (headless Chrome)
  - Generate PDF
  - Upload to Supabase storage (`monthly-statements` bucket)
  - Return public URL

**Testing**:

- Snapshot test for StatementTemplate
- Test PDF generation with various data scenarios
- Verify PDF uploads to Supabase storage

**Complexity**: Medium (5-7 days)

---

### Phase 4b: PDF Attachment Merging (Week 6)

**Files to Create**:

1. `src/lib/pdf/merge-pdfs.ts`
2. Update `src/lib/pdf/statement-generator.ts` to use merge-pdfs

**Dependencies**:

```bash
npm install pdf-lib
```

**Implementation**:

- Use pdf-lib to combine main statement + attachments
- Maintain order: statement first, then bill PDFs (by date), then payment PDFs (by date)

**Testing**:

- Test with 0 attachments, 1 attachment, many attachments
- Test missing attachment handling
- Memory/performance test with large PDFs

**Complexity**: Medium (4-6 days)

---

### Phase 5: Email & Statements Stage (Week 7)

**Pre-Deployment**:

- Complete SPF/DKIM setup checklist

**Files to Create**:

1. `src/lib/email/resend-client.ts`
2. `src/lib/email/send-statement.ts`
3. `src/lib/email/templates/statement-email.html`
4. `src/app/api/monthly-logs/[logId]/statement/send/route.ts`
5. `src/app/api/monthly-logs/[logId]/statement/history/route.ts`
6. `src/components/monthly-logs/StatementsStage.tsx`: full implementation

**Dependencies**:

```bash
npm install resend
```

**Environment**:

```
RESEND_API_KEY=re_...
FROM_EMAIL=statements@yourdomain.com
```

**Implementation**:

- `resend-client.ts`:
  ```typescript
  import { Resend } from 'resend';
  export const resend = new Resend(process.env.RESEND_API_KEY);
  ```
- `send-statement.ts`:
  - Fetch PDF from storage
  - Fetch recipients from properties.statement_recipients
  - Call `resend.emails.send()` with attachment
  - Log to statement_emails table
  - Handle errors (retry logic, logging)
- Idempotency: check `statement_emails` for matching monthly_log_id + idempotency key before sending

**Testing**:

- Test email delivery with real Resend account
- Test idempotency (send twice, verify only one email sent)
- Test error handling (invalid email, Resend API error)
- Monitor deliverability first week

**Complexity**: Medium (5-7 days)

---

### Phase 6: E2E Testing & Polish (Week 8)

**Tasks**:

- Write E2E test for full monthly log workflow (Playwright)
- Run all unit and integration tests
- Fix any bugs found
- Performance testing (large transaction lists, PDF generation time)
- Accessibility audit (WCAG 2.1 AA compliance)
- Update documentation
- Code review

**E2E Test Flow**:

1. Create monthly log
2. Navigate to Charges stage, assign charges
3. Navigate to Payments stage, verify balance calculations
4. Navigate to Bills stage, assign bills
5. Navigate to Escrow stage, view balance
6. Navigate to Statements stage, generate PDF
7. Verify PDF downloads
8. Send statement email
9. Verify audit log entry

**Complexity**: Medium (5-7 days)

---

## 6. Acceptance Criteria

- [ ] Owner Draw calculation matches formula: Payments – Bills – Escrow
- [ ] Payments stage displays Total Rent Owed, Remaining Rent Balance, Total Fee Charges correctly
- [ ] Escrow stage shows current month deposits/withdrawals and running balance
- [ ] Management summary visible in Management Fees stage with service_plan, active_services, fee, notes, frequency
- [ ] Unassigned transactions can be linked to any stage; totals update immediately with optimistic UI
- [ ] Statement PDF merges detail and all related bill/payment PDFs in correct order
- [ ] Email sends with attachment, records audit log entry (statement_emails table), idempotent
- [ ] Permissions enforced: only org_admin, org_manager, platform_admin can send statements
- [ ] All calculations covered by unit tests with edge cases
- [ ] Integration tests pass for all API endpoints
- [ ] E2E test completes full monthly log workflow

---

## 7. Risks & Mitigations

| Risk                                                              | Mitigation                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Large PDF merges (memory/time)**                                | Use streaming where possible; set Puppeteer timeout to 60s; consider background job queue (Phase 2 optimization)                  |
| **Double-counting transactions**                                  | Enforce unique monthly_log_id constraint on transactions; UI prevents assigning already-assigned transactions                     |
| **Escrow balance errors if GL accounts misconfigured**            | Add migration to seed "Escrow" GL account with correct category; add validation check before escrow calculations                  |
| **Email deliverability issues (spam filters)**                    | Use verified domain with Resend; add SPF/DKIM records; include unsubscribe link; monitor bounce rates                             |
| **Previous balance calculation incorrect if prior month missing** | Default to 0; add UI note if prior month log doesn't exist; provide manual override field                                         |
| **Timezone handling (period_start at midnight)**                  | Consistently use UTC for period_start (YYYY-MM-01); display in user's timezone in UI; calculations use UTC                        |
| **Month boundary edge cases (leap years, DST)**                   | Use date-fns for date arithmetic; write unit tests for Feb 29, DST transitions                                                    |
| **Puppeteer installation issues on server**                       | Document Puppeteer setup for production (apt-get install chromium); consider using Vercel/Netlify with Puppeteer support          |
| **Denormalized balance drift**                                    | Triggers auto-recalculate on log creation and stage changes; manual reconcile endpoint available; add nightly job to detect drift |
| **Escrow GL misconfiguration**                                    | Seed migration ensures at least one escrow GL exists; fail-fast checks warn user in UI if configuration missing                   |
| **Permission changes break UI**                                   | Follow UI permission propagation checklist; test with all roles before merge                                                      |
| **PDF attachment merging delays Phase 4**                         | Ship Phase 4a (HTML preview + simple PDF) first; defer attachment merging to 4b                                                   |

---

## 8. Execution Plan (Revised Timeline)

**Total Estimated Timeline**: 8 weeks (40-56 days) - more realistic than original 7 weeks

### Phase 1: Data & Calculations (Week 1) - 5-7 days

### Phase 2: API Endpoints (Week 2) - 6-8 days (reduced scope, distributed testing)

### Phase 3: UI Stage Components (Week 3-4) - 10-12 days

### Phase 4a: HTML Preview + Simple PDF (Week 5) - 5-7 days

### Phase 4b: PDF Attachment Merging (Week 6) - 4-6 days

### Phase 5: Email & Statements (Week 7) - 5-7 days

### Phase 6: E2E Testing & Polish (Week 8) - 5-7 days

---

## 9. GitHub Issues Checklist (Revised)

### Phase 1: Data Model & Calculations

- [ ] Add `previous_lease_balance` column with triggers and reconciliation function
- [ ] Seed escrow GL account with validation
- [ ] Add `statement_recipients` column to properties
- [ ] Create `statement_emails` audit log table
- [ ] Add `pdf_url` column to monthly_logs
- [ ] Implement calculation functions in `src/lib/monthly-log-calculations.ts`
- [ ] Implement escrow balance query with GL validation in `src/lib/escrow-calculations.ts`
- [ ] Create generic stage handler in `src/lib/monthly-log-stage-handler.ts`
- [ ] Add monthly_logs permissions to `src/lib/permissions.ts`
- [ ] Write unit tests for all calculation functions
- [ ] Test reconciliation function with edge cases

### Phase 2: API Endpoints (with distributed testing)

- [ ] Create POST `/api/monthly-logs/[logId]/stage-transactions` (generic)
- [ ] Write integration test for stage-transactions endpoint
- [ ] Create GET `/api/monthly-logs/[logId]/payments` endpoint
- [ ] Write integration test for payments endpoint
- [ ] Create GET `/api/monthly-logs/[logId]/bills` endpoint
- [ ] Write integration test for bills endpoint
- [ ] Create GET/POST `/api/monthly-logs/[logId]/escrow` endpoint
- [ ] Write integration test for escrow endpoint
- [ ] Create GET `/api/monthly-logs/[logId]/management-fees` endpoint
- [ ] Create POST `/api/monthly-logs/[logId]/management-fees/generate` endpoint
- [ ] Write integration tests for management fees endpoints
- [ ] Create GET `/api/monthly-logs/[logId]/owner-draw` endpoint
- [ ] Create POST `/api/monthly-logs/[logId]/reconcile` endpoint
- [ ] Create PATCH `/api/properties/[propertyId]/statement-recipients` endpoint
- [ ] Add Zod validation schemas for all endpoints
- [ ] Add permission guards to all endpoints
- [ ] Test permission guards with different roles

### Phase 3: UI Components (with permission propagation)

- [ ] Implement full `PaymentsStage.tsx` with balance calculations
- [ ] Implement full `BillsStage.tsx` with assign/unassign
- [ ] Implement full `EscrowStage.tsx` with GL validation alert
- [ ] Implement full `ManagementFeesStage.tsx` with fee generation
- [ ] Implement full `OwnerDrawStage.tsx` with calculation breakdown
- [ ] Update `EnhancedFinancialSummaryCard.tsx` with correct Owner Draw formula
- [ ] Update `useMonthlyLogData` hook for generic stage-transactions endpoint
- [ ] Add permission checks to all stage buttons
- [ ] Test with org_staff role to verify button disabling
- [ ] Add optimistic UI updates to all stage actions
- [ ] Add toast notifications for all user actions
- [ ] Create `StatementPreview.tsx` component

### Phase 4a: HTML Preview + Simple PDF

- [ ] Install and configure Puppeteer
- [ ] Create `StatementTemplate.tsx` with full statement layout
- [ ] Implement `statement-generator.ts` with Puppeteer (no attachments)
- [ ] Create GET `/api/monthly-logs/[logId]/statement/preview` endpoint
- [ ] Create POST `/api/monthly-logs/[logId]/statement/generate` endpoint (simple PDF)
- [ ] Set up Supabase storage bucket for statement PDFs
- [ ] Add snapshot test for StatementTemplate
- [ ] Test PDF generation with various data scenarios

### Phase 4b: PDF Attachment Merging

- [ ] Install and configure pdf-lib
- [ ] Implement `merge-pdfs.ts` for PDF concatenation
- [ ] Update `statement-generator.ts` to merge attachments
- [ ] Test with 0, 1, and many attachments
- [ ] Test memory/performance with large PDFs
- [ ] Handle missing attachment files gracefully

### Phase 5: Email & Statements

- [ ] Complete SPF/DKIM setup checklist
- [ ] Install and configure Resend SDK
- [ ] Implement `resend-client.ts` and `send-statement.ts`
- [ ] Create email template HTML
- [ ] Create POST `/api/monthly-logs/[logId]/statement/send` endpoint
- [ ] Create GET `/api/monthly-logs/[logId]/statement/history` endpoint
- [ ] Implement full `StatementsStage.tsx` (preview, generate, send, audit)
- [ ] Add recipient management modal
- [ ] Test email delivery with Resend
- [ ] Test idempotency for email sending
- [ ] Monitor deliverability first week

### Phase 6: E2E Testing & Documentation

- [ ] Write E2E test for complete monthly log workflow (Playwright)
- [ ] Run and verify all unit tests pass
- [ ] Run and verify all integration tests pass
- [ ] Performance testing (large datasets, PDF generation)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Update API documentation in `docs/api/`
- [ ] Update `docs/monthly-log-plan.md` with implementation notes
- [ ] Code review and refactoring
- [ ] Final QA testing

---

## Summary

**Key Improvements from Feedback**:

1. **Reduced API duplication**: 13 endpoints → 11 (8 fewer assign/unassign endpoints via shared handler)
2. **Denormalized balance drift prevention**: Added triggers, reconciliation function, nightly job recommendation
3. **Escrow GL validation**: Fail-fast checks with user-facing warnings
4. **Phased PDF delivery**: Phase 4a (HTML + simple PDF) ships first, 4b (attachments) follows
5. **Email deliverability**: SPF/DKIM setup checklist before Phase 5
6. **Permission propagation**: Explicit UI update checklist
7. **Distributed testing**: Integration tests baked into Phase 2, not deferred

**Total Estimated Timeline**: 8 weeks (40-56 days) - more realistic than original 7 weeks

**Key Technical Decisions**:

- Previous balance: dynamically calculated with triggers + manual reconciliation endpoint
- Escrow: GL account-based with validation and fail-fast checks
- PDF: Phased delivery (HTML preview first, then attachment merging)
- Email: Resend with SPF/DKIM setup checklist
- Recipients: per-property configuration
- Fees: transaction_line entries with processing fee GL account
- API design: Shared generic stage handler reduces duplication

This plan comprehensively addresses all gaps in the Monthly Log feature with:

1. **Data Model**: Adds previous_balance tracking, escrow via GL accounts, fee tracking, statement recipients, and email audit log
2. **Calculations**: Implements all required formulas with single source of truth in utility functions
3. **API**: Creates 11 new endpoints for stage workflows, PDF generation, and email sending
4. **UI**: Implements all 7 stage components from stubs to full functionality
5. **PDF**: Server-side generation with Puppeteer, phased attachment merging
6. **Email**: Resend integration with idempotency, recipient management, audit log
7. **Permissions**: Proper RBAC enforcement for editing, approving, and sending
8. **Testing**: Comprehensive unit, integration, and E2E test coverage
