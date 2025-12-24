# Buildium “Record Bill” Form Reference

<!-- markdownlint-configure-file {"MD013": false} -->

_Last reviewed: 2025-11-09_

This reference captures the structure, behaviors, and validation rules observed in
Buildium’s **Accounting → Record bill** page. It is the canonical specification we use
when achieving functional parity inside `app/(protected)/bills`.

## 1. Primary Layout

The form is organised into three stacked cards:

1. **Header / bill metadata**
2. **Bill items table**
3. **Footer toolbar**

The viewport keeps the footer sticky so that totals and primary actions remain in view
while scrolling.

## 2. Header Fields

| Label (as rendered)     | Control type       | Required | Notes & validation                                                                                           |
| ----------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| **Property or company** | Combobox           | Yes      | Populated with all properties. Selection determines unit options. “Company” is the default top-level option. |
| **Unit**                | Combobox           | No       | Filtered by currently selected property. Default = “Property level”.                                         |
| **Pay to**              | Combobox           | Yes      | Vendors, sorted alphabetically; search-as-you-type. Required before save.                                    |
| **Bill date**           | Date picker        | Yes      | Defaults to today. Cannot be empty.                                                                          |
| **Post to**             | Combobox           | Yes      | GL accounts. Defaults to last used for the selected vendor.                                                  |
| **Due**                 | Date picker        | Yes      | Defaults to Bill date + vendor terms. Accepts manual override.                                               |
| **Terms**               | Combobox           | No       | Drives “Due” when changed. Available options: “Due on receipt”, “Net 15”, “Net 30”, “Net 45”, “Net 60”.      |
| **Reference #**         | Text input         | No       | Maximum 32 characters.                                                                                       |
| **Memo**                | Textarea           | No       | Persists to transaction memo and pre-populates new line descriptions.                                        |
| **Attachment uploader** | Button + drop zone | No       | Accepts multiple files; drag & drop enabled; max 25 MB per file, 50 MB combined.                             |
| **Apply bill markups**  | Checkbox           | No       | Disabled when property lacks markup configuration. When enabled, auto-adds markup lines after save.          |

Dynamic rules:

- Changing **Property or company** immediately resets Unit to “Property level” and constrains account autocomplete to property-compatible options.
- Selecting a vendor with terms recalculates **Due** as `Bill date + vendor terms`.
- Manual edits to **Due** remain even if vendor or terms change again.

## 3. Bill Items Table

Columns (left to right):

1. **Property or company** (required):
   - Mirrors header property combo but scoped per line.
   - When changed, the unit dropdown filters to the selected property automatically.
2. **Unit**:
   - “Property level” remains available.
3. **Account** (required):
   - Expense (debit) accounts only.
   - Soft validation prevents save if any debit row lacks an account.
4. **Description**:
   - Defaults to header memo for newly added rows.
   - Inline editable text field.
5. **Initial amount** (required for debit rows):
   - Numeric input (two decimal places).
   - Cannot be negative; zero disallowed.
6. **Amount paid**:
   - Read-only, reflects existing payment applications.

Additional table behaviours:

- First debit row is auto-selected; account focus opens the dropdown.
- “Add line” inserts new debit rows beneath the last non-credit row, copying prior property/unit.
- Trash action only enabled for debit rows.
- Credit rows (system generated) remain locked; amounts displayed but inputs hidden.
- Table footer shows:
  - **Total** (sum of all debit amounts).
  - **Amount paid** (sum of payments; read-only).

## 4. Footer Toolbar

Sticky toolbar includes:

| Button         | Variant | Behaviour                                                                           |
| -------------- | ------- | ----------------------------------------------------------------------------------- |
| **Save**       | Primary | Validates required header fields + debit lines. Displays inline error toast at top. |
| **Save & new** | Ghost   | Saves and resets form for another bill.                                             |
| **Cancel**     | Ghost   | Returns to bills index without saving.                                              |

When validation fails:

- Missing **Pay to** → inline message: “Select a vendor before saving.”
- Missing debit account → message beside line: “Choose an expense account.” Focus moves to field.
- Missing Bill date / Due date → red outline and inline helper text.

## 5. Network Interactions

Observed API calls (Buildium origin):

1. `GET /api/rentals` – fetch property list (invoked on load).
2. `GET /api/vendors?supportingData=true` – vendor combobox.
3. `GET /api/glaccounts?types=Expense` – account dropdown (lazy-loaded on focus).
4. `POST /api/transactions/bills` – payload includes header, debit lines, optional attachments.
5. `POST /api/files` – invoked per attachment before the bill save completes.

The POST body structure mirrors `BuildiumLeaseTransactionCreate` but with
`TransactionType: "Bill"` and debit lines each containing:

```json
{
  "PropertyId": "<buildium-property-id>",
  "UnitId": "<buildium-unit-id or null>",
  "GlAccountId": "<expense-account-id>",
  "Amount": 123.45,
  "Memo": "Line memo"
}
```

The service automatically inserts a credit line for the accounts payable account
associated with the selected vendor.

## 6. Accessibility Notes

- All controls follow label → input semantics; keyboard navigation cycles through the table.
- Trash buttons are keyboard reachable with `Tab`.
- Sticky footer maintains WCAG 2.1 contrast requirements (primary button 4.5:1).
- Error messages announced via `aria-live="polite"` banner.

## 7. Implementation Checklist for Local Parity

When recreating this form locally:

1. **Mirror the header field groupings**, using the design system’s form primitives.
2. **Ensure property/unit filtering** is reactive.
3. **Force at least one debit line** with non-null account + amount.
4. **Emit mapped payload** matching the Buildium schema.
5. **Surface validation feedback inline plus toast** at the top.
6. **Support “Save & new” flow** by resetting state.
7. **Persist attachments** via existing file upload pipeline (limit 25 MB per file).

Refer back to this document whenever endpoint behaviour or UI copy changes upstream.
