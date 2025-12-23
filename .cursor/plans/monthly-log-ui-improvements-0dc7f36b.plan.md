<!-- 0dc7f36b-19fe-458a-a23a-10e731da4c3e 8d20e244-29b9-4eb0-acf9-a4379680cccf -->

# Monthly Log Audit & Enhancement Plan (Revised)

## Key Refinements from Feedback

1. **Reduced API Duplication**: Shared generic stage transaction handler replaces 8 separate assign/unassign endpoints
2. **Denormalized Balance Reconciliation**: Clear triggers and reconciliation checks to prevent drift
3. **Escrow GL Account Validation**: Fail-fast checks with configuration validation
4. **Phased PDF Delivery**: Phase 4a (HTML preview + simple PDF), Phase 4b (attachment merging)
5. **Email Sender Verification**: Added SPF/DKIM setup checklist
6. **Distributed Testing**: Integration tests baked into each phase, not deferred to Phase 6
7. **Permission Propagation**: Explicit UI update checklist when permissions change

---

## 1. Codebase Inventory & Current Behavior

_(Same as original - no changes)_

### Database Schema

- **monthly_logs** table: 7 stages, denormalized amounts, org/property/unit/tenant links
- **transactions** table: all financial events
- **transaction_lines** table: GL postings with monthly_log_id FK
- **units** table: balance fields
- **lease** table: dates, rent, status
- **properties** table: service_plan, active_services[], management_fee

### API Endpoints

- Create, fetch transactions, assign, unassign, financial summary, update stage
- **Missing**: CRUD per stage, statement generation, email, escrow ops

### UI Components

- EnhancedChargesStage: IMPLEMENTED
- All other stages: STUBS

---

## 2. Gaps vs. Required Behavior

_(Same gap analysis as original)_

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

_(Same as original - transaction_lines with processing fee GL account)_

#### D. Statement recipients on properties table

_(Same as original)_

#### E. Statement generation audit log

_(Same as original)_

---

### 3.2 Calculations (Explicit Formulas)

_(Same as original)_

---

### 3.3 UI/UX Enhancements

_(Same as original, with added note for Escrow stage)_

#### Escrow Stage (`src/components/monthly-logs/EscrowStage.tsx`)

- Current month escrow movements table
- Running balance display at top
- **Validation Alert**: If `hasValidGLAccounts === false`, show warning banner:
  - "Escrow GL accounts not configured. Contact administrator to set up Security Deposit liability accounts."
  - Disable "Add Escrow Transaction" button

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
- `src/app/api/monthly-logs/[logId]/statement/send/route.ts`

**Flow**:
_(Same as original, with added deliverability checks)_

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

**UI Permission Propagation Checklist**:

1. [ ] Update all stage components to check `monthly_logs.write` before showing assign/unassign buttons
2. [ ] Update "Mark Stage Complete" button to check `monthly_logs.approve`
3. [ ] Update "Send Statement" button to check `monthly_logs.send_statement`
4. [ ] Update MonthlyLogsPageContent to check `monthly_logs.read` (show/hide entire feature)
5. [ ] Add permission checks to any existing navigation menus that link to monthly logs
6. [ ] Test with org_staff role to verify buttons correctly disabled

---

### 3.7 Performance Optimizations

_(Same as original)_

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
6. Update `src/hooks/useMonthlyLogData.ts`: exten

### To-dos

- [ ] Write and apply DB migrations (previous_balance, statement_recipients, statement_emails, pdf_url)
- [ ] Create calculation libraries (monthly-log-calculations.ts, escrow-calculations.ts)
- [ ] Update permissions and RBAC for monthly_logs
- [ ] Write unit tests for all calculation functions
- [ ] Create Payments stage API endpoints (GET, assign)
- [ ] Create Bills stage API endpoints (GET, assign)
- [ ] Create Escrow stage API endpoints (GET, add)
- [ ] Create Management Fees stage API endpoints (GET, generate)
- [ ] Create Owner Draw API endpoint
- [ ] Add Zod validation and permission guards to all endpoints
- [ ] Write integration tests for all API endpoints
- [ ] Implement PaymentsStage.tsx with balance calculations
- [ ] Implement BillsStage.tsx with assign/unassign
- [ ] Implement EscrowStage.tsx with movements table
- [ ] Implement ManagementFeesStage.tsx with fee generation
- [ ] Implement OwnerDrawStage.tsx with calculation breakdown
- [ ] Update EnhancedFinancialSummaryCard with correct Owner Draw formula
- [ ] Create StatementTemplate.tsx component with full layout
- [ ] Implement statement-generator.ts with Puppeteer
- [ ] Implement merge-pdfs.ts for bill/payment attachments
- [ ] Create POST /statement/generate endpoint
- [ ] Set up Resend client and send-statement.ts
- [ ] Create POST /statement/send and GET /statement/history endpoints
- [ ] Implement full StatementsStage.tsx (preview, generate, send, audit)
- [ ] Write E2E test for complete monthly log workflow
- [ ] Update documentation and API reference
