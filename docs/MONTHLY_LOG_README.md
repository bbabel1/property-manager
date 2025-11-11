# Monthly Log Feature - Complete Guide

**Version:** 1.0.0  
**Last Updated:** January 15, 2025  
**Status:** Production Ready

---

## 📖 **Table of Contents**

1. [Overview](#overview)
2. [Features](#features)
3. [Workflow Stages](#workflow-stages)
4. [Setup & Configuration](#setup--configuration)
5. [User Guide](#user-guide)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [FAQs](#faqs)

---

## 🎯 **Overview**

The Monthly Log system is a comprehensive property accounting workflow that guides users through the month-end close process, from recording charges to delivering professional statements to property owners.

### **Purpose**

- Streamline monthly accounting workflows
- Ensure accurate financial tracking
- Automate statement generation and delivery
- Provide complete audit trail
- Reduce manual errors and save time

### **Key Benefits**

- **Structured Workflow:** 7 sequential stages ensure nothing is missed
- **Real-Time Calculations:** Automatic financial summaries and balances
- **Professional Output:** Branded PDF statements with complete breakdowns
- **Automated Delivery:** Email statements to multiple recipients
- **Complete Audit Trail:** Every action is logged for compliance

---

## 🆕 **UI Overview (November 2025 refresh)**

- List view now uses a tabbed table split between **Incomplete** and **Complete** logs. Property and free-text filters remain in the drawer to the left of the KPI tiles.
- Drag-and-drop stages have been removed. Status is driven entirely by the `status` column (`pending`, `in_progress`, `complete`).
- The detail page surfaces the entire workflow inline:
  - Assigned transactions and unassigned transactions (with type and search filters).
  - Linked tasks panel for quick context.
  - Statement generation, preview, download, and email history remain grouped together.
- Marking a log complete is now a single action button in the header; reopening sets the status back to `in_progress`.

## ✨ **Features**

### **Workflow Management**

- ✅ 7 sequential workflow stages
- ✅ Stage completion tracking
- ✅ Progress indicators
- ✅ Real-time status updates

### **Financial Tracking**

- ✅ Previous month balance carry-forward
- ✅ Rent owed calculations
- ✅ Payment application tracking
- ✅ Bill and expense management
- ✅ Escrow/security deposit tracking
- ✅ Management fee calculations
- ✅ Owner draw calculations

### **Transaction Management**

- ✅ Assign/unassign transactions
- ✅ Optimistic UI updates (no page reloads)
- ✅ Bulk operations
- ✅ Transaction filtering
- ✅ Reference number tracking

### **Statement Generation**

- ✅ Professional PDF generation
- ✅ Branded templates with logo
- ✅ Complete financial breakdown
- ✅ Transaction detail tables
- ✅ HTML preview before generation
- ✅ Automatic storage in Supabase

### **Email Delivery**

- ✅ Multi-recipient support
- ✅ Personalized email templates
- ✅ Automatic PDF attachment
- ✅ Delivery status tracking
- ✅ Email audit logging
- ✅ Retry failed sends

### **Recipient Management**

- ✅ Per-property recipient configuration
- ✅ Add/remove recipients
- ✅ Role assignment
- ✅ Email validation
- ✅ Duplicate detection

---

## 🔄 **Workflow Stages**

> **Note:** The UI no longer surfaces each stage as a separate tab/board. Stage-specific APIs and calculations still exist, but the detail page now groups their outputs into inline sections (Transactions, Tasks, Statements). Use the stage helpers when interacting with the API, but expect the interface to rely on status chips instead of a kanban.

### **1. Charges**

**Purpose:** Assign charge transactions (rent, fees, utilities) to the monthly log

**Actions:**

- Review unassigned transactions
- Assign charges with single checkbox click
- Unassign incorrectly assigned charges
- Bulk unassign operations
- Add new charges

**Calculations:**

- Total Charges = Sum of all assigned charge transactions

**Completion Criteria:**

- All relevant charge transactions assigned
- Total charges verified

---

### **2. Payments**

**Purpose:** Track rent owed and payment application

**Display:**

- **Previous Month Balance:** Carried from prior month's (Charges - Payments)
- **Charges This Month:** Sum of current month charges
- **Credits This Month:** Sum of current month credits
- **Payments Applied:** Sum of payments received
- **Total Rent Owed:** Previous Balance + Charges - Credits
- **Remaining Balance:** Total Rent Owed - Payments Applied

**Visual Indicators:**

- Green: Charges and credits
- Purple: Payments
- Amber: Positive remaining balance (tenant owes)
- Green: Negative remaining balance (overpayment/credit)

**Completion Criteria:**

- Payments verified
- Balance reconciled

---

### **3. Bills**

**Purpose:** Review and verify property expenses for the period

**Display:**

- List of all assigned bills
- Vendor information
- Reference numbers
- Individual amounts
- Total bills sum

**Completion Criteria:**

- All bills reviewed
- Vendor information verified
- Total bills accepted

---

### **4. Escrow**

**Purpose:** Track security deposit movements

**Display:**

- **Current Balance:** Total deposits held
- **Deposits:** Sum of all escrow deposits
- **Withdrawals:** Sum of all withdrawals
- **Movement History:** Chronological transaction list

**How It Works:**

- Uses GL accounts categorized as "deposit"
- Credits = Deposits (increase liability)
- Debits = Withdrawals (decrease liability)

**Completion Criteria:**

- Escrow balance verified
- Movements reviewed

---

### **5. Management Fees**

**Purpose:** Generate and verify management fees

**Display:**

- Service plan configuration
- Active services list
- Monthly fee amount
- Billing frequency
- Assigned fees
- Total fees

**Actions:**

- Auto-generate fee based on unit configuration
- Review historical fees
- Verify amounts

**Completion Criteria:**

- Fee generated (if applicable)
- Amount verified

---

### **6. Owner Draw**

**Purpose:** Calculate funds available for distribution to owner

**Display:**

- **Owner Draw:** Payments – Bills – Escrow
- **Breakdown:**
  - Payments Collected (green)
  - Bills Paid (red)
  - Escrow Reserved (blue)
- **Net to Owner:** (for context)

**Interpretation:**

- **Positive Draw:** Funds available for owner distribution
- **Negative Draw:** Additional funds needed to cover expenses

**Completion Criteria:**

- Draw amount reviewed
- Breakdown verified

---

### **7. Owner Statements**

**Purpose:** Generate and deliver monthly statements

**Actions:**

1. **Generate PDF**
   - Creates professional PDF statement
   - Stores in Supabase storage
   - Updates `pdf_url` field

2. **Preview HTML**
   - Opens HTML template in new tab
   - Useful for verification before PDF generation

3. **Configure Recipients**
   - Add/remove email recipients
   - Assign roles (Owner, Accountant, etc.)
   - Validate email addresses

4. **Send via Email**
   - Sends PDF to all configured recipients
   - Includes financial summary in email body
   - Logs delivery status

5. **Review Email History**
   - View all sent emails
   - Check delivery status per recipient
   - Review error messages

**Completion Criteria:**

- PDF generated
- Statement sent to all recipients
- Delivery confirmed

---

## ⚙️ **Setup & Configuration**

### **Prerequisites**

- PostgreSQL database (Supabase)
- Node.js 18+ with npm
- Playwright installed
- Resend account (for email)

### **1. Database Setup**

Apply migrations:

```bash
npx supabase db push
```

Verify tables created:

```bash
npx supabase db check
```

### **2. Environment Configuration**

Copy template:

```bash
cp env.example .env.local
```

Configure required variables:

```bash
# Email Service
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM_ADDRESS="statements@yourdomain.com"
EMAIL_FROM_NAME="Your Company Name"

# Company Info
COMPANY_NAME="Your Property Management Company"
COMPANY_ADDRESS="123 Main St, City, ST 12345"
COMPANY_PHONE="(555) 123-4567"
COMPANY_EMAIL="info@yourcompany.com"
COMPANY_LOGO_URL="https://yourcompany.com/logo.png"
```

Test configuration:

```bash
npx tsx scripts/test-resend-config.ts
```

### **3. Dependency Installation**

Install required packages:

```bash
npm install
```

Verify Playwright browsers:

```bash
npx playwright install chromium
```

### **4. Create Test Data**

Seed escrow GL account (if not already done):

```sql
-- Already handled by migration 134
-- Verify with:
SELECT * FROM gl_accounts WHERE name ILIKE '%escrow%';
```

---

## 👤 **User Guide**

### **Creating a Monthly Log**

1. Navigate to `/monthly-logs`
2. Click **"New Monthly Log"** button
3. Select:
   - Property
   - Unit
   - Period start date (first of month)
4. Click **"Create"**
5. System redirects to monthly log detail page

### **Completing Stages**

#### **Best Practices:**

1. Complete stages in order (Charges → Statements)
2. Verify each calculation before proceeding
3. Use "Mark Stage Complete" button to advance
4. Review financial summary after each stage

#### **Common Tasks:**

**Assign Charge:**

1. Go to Charges stage
2. Find transaction in "Unassigned Transactions"
3. Click checkbox next to transaction
4. Transaction immediately moves to assigned list
5. Financial summary updates automatically

**Unassign Transaction:**

1. Select transaction in assigned list (checkbox)
2. Click "Unassign Selected" button
3. Or use dropdown menu → "Unassign"

**Generate Management Fee:**

1. Go to Management Fees stage
2. Review fee configuration
3. Click "Generate Fee" button
4. Verify fee amount
5. Fee appears in assigned list

**Generate Statement:**

1. Complete all prior stages
2. Go to Owner Statements stage
3. Click "Preview HTML" to verify (optional)
4. Click "Generate PDF"
5. Wait for generation (~10 seconds)
6. Click "Download PDF" to review

**Send Statement:**

1. Ensure PDF is generated
2. Review/configure recipients
3. Click "Send via Email"
4. Wait for confirmation toast
5. Check Email History for delivery status

---

## 🔌 **API Reference**

### **Core Endpoints**

#### **GET /api/monthly-logs/[logId]/financial-summary**

Returns complete financial summary for a monthly log.

**Response:**

```json
{
  "totalCharges": 2000.0,
  "totalPayments": 1800.0,
  "totalBills": 500.0,
  "escrowAmount": 300.0,
  "managementFees": 200.0,
  "netToOwner": 2900.0,
  "ownerDraw": 1000.0
}
```

#### **POST /api/monthly-logs/[logId]/generate-pdf**

Generates PDF statement and stores in Supabase.

**Response:**

```json
{
  "success": true,
  "pdfUrl": "https://storage.supabase.co/.../statement.pdf"
}
```

#### **POST /api/monthly-logs/[logId]/send-statement**

Sends statement to configured recipients.

**Response:**

```json
{
  "success": true,
  "sentCount": 2,
  "failedCount": 0,
  "recipients": [
    { "email": "owner1@example.com", "status": "sent" },
    { "email": "owner2@example.com", "status": "sent" }
  ],
  "auditLogId": "uuid-here"
}
```

### **Complete API List**

See `docs/api/monthly-logs.md` for full API documentation.

---

## 🐛 **Troubleshooting**

### **PDF Generation Issues**

**Problem:** "Failed to generate PDF"  
**Solutions:**

1. Check Playwright is installed: `npx playwright install chromium`
2. Verify server has enough memory (min 512MB)
3. Check logs for specific error messages

**Problem:** "PDF generation is slow"  
**Solutions:**

1. First generation is slower (browser initialization)
2. Consider caching generated PDFs
3. Run in background job for large batches

### **Email Delivery Issues**

**Problem:** "No recipients configured"  
**Solutions:**

1. Go to Owner Statements tab
2. Add recipients in Email Recipients section
3. Click "Save Changes"

**Problem:** "Emails not being delivered"  
**Solutions:**

1. Verify Resend API key is set
2. Check domain is verified (production)
3. Review Resend dashboard for delivery logs
4. Check spam folder
5. Verify recipient email addresses

**Problem:** "Rate limit exceeded"  
**Solutions:**

1. Check Resend plan limits
2. Implement delays between sends
3. Upgrade Resend plan if needed

### **Financial Calculation Issues**

**Problem:** "Previous balance is incorrect"  
**Solutions:**

1. Run reconciliation: `POST /api/monthly-logs/[logId]/reconcile`
2. Verify prior month's log is complete
3. Check transaction assignments

**Problem:** "Owner draw doesn't match expectations"  
**Solutions:**

1. Verify formula: Payments - Bills - Escrow
2. Check all transactions are assigned
3. Review escrow movements
4. Compare to Net to Owner (different formula)

---

## ❓ **FAQs**

### **Q: What's the difference between Owner Draw and Net to Owner?**

**A:**

- **Owner Draw** = Payments - Bills - Escrow (cash available for distribution)
- **Net to Owner** = Charges + Payments - Bills - Management Fees (total financial outcome)

Owner Draw represents actual cash flow, while Net to Owner includes all income and expenses.

### **Q: Why do I need to configure recipients for each property?**

**A:** Different properties may have different owners or stakeholders. Per-property configuration ensures the right people receive the right statements.

### **Q: Can I send statements to multiple recipients?**

**A:** Yes! You can configure unlimited recipients per property. Each recipient gets their own copy of the statement.

### **Q: What happens if an email fails to send?**

**A:** The system tracks each recipient's delivery status. Failed emails are logged in the Email History. You can retry sending from there.

### **Q: Can I regenerate a PDF?**

**A:** Yes! Click "Generate PDF" again to create a fresh PDF. The old PDF will be replaced.

### **Q: How is escrow tracked?**

**A:** Escrow is tracked via GL accounts categorized as "deposit". All transaction_lines linked to these accounts count as escrow movements.

### **Q: Can I edit a monthly log after it's marked complete?**

**A:** Yes, but it's not recommended. Completed logs should be considered final for audit purposes.

### **Q: What if I need to add a transaction to a prior month?**

**A:**

1. Unmark the log from complete
2. Assign the transaction
3. Verify all calculations
4. Regenerate PDF
5. Resend statement if needed
6. Mark complete again

---

## 🎓 **Best Practices**

### **Monthly Close Process**

1. **Week 1:** Record all charges for the month
2. **Week 2:** Record all payments received
3. **Week 3:** Record all bills and expenses
4. **Week 4:** Complete workflow and send statements
5. **Week 4+:** Follow up on outstanding balances

### **Data Quality**

- Assign transactions to correct monthly logs
- Verify vendor information on bills
- Keep escrow movements up to date
- Review calculations at each stage
- Generate statements only when all data is final

### **Communication**

- Send statements by 5th of following month
- Include personal message for first-time recipients
- Follow up on questions within 24-48 hours
- Keep recipients list updated (remove inactive owners)

### **Audit & Compliance**

- Never delete completed monthly logs
- Keep email history for record keeping
- Store generated PDFs long-term
- Review audit logs monthly
- Maintain backup of all financial data

---

## 🔗 **Related Documentation**

- [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md) - Email configuration
- [MONTHLY_LOG_IMPLEMENTATION_STATUS.md](./MONTHLY_LOG_IMPLEMENTATION_STATUS.md) - Technical details
- [database-schema.md](./database/database-schema.md) - Database reference
- [api-documentation.md](./api/api-documentation.md) - Complete API reference

---

## 📞 **Support**

For questions or issues:

1. Check this documentation first
2. Review troubleshooting section
3. Check API logs for error details
4. Contact development team

---

**Last Updated:** January 15, 2025  
**Document Version:** 1.0.0
