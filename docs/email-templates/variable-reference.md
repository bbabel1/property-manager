# Email Template Variable Reference

Complete dictionary of available variables for email templates, with source mappings, formatting rules, and usage examples.

## Monthly Rental Statement Variables

### Statement Metadata

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `statementId` | Monthly log ID (UUID) | `monthly_logs.id` | string | Yes | - | `123e4567-e89b-12d3-a456-426614174000` |
| `statementUrl` | URL to view statement in app | Computed: `baseUrl + /monthly-logs/{statementId}` | url | No | - | `https://app.example.com/monthly-logs/123...` |
| `pdfUrl` | URL to download PDF | `monthly_logs.pdf_url` | url | Yes | - | `https://storage.example.com/statements/123.pdf` |
| `statementCreatedAt` | Statement creation date/time | `monthly_logs.created_at` | date | No | - | `2024-12-07T19:09:27Z` |

### Property Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `propertyName` | Property name | `properties.name` | string | Yes | `Unknown Property` | `123 Main Street` |
| `propertyAddressLine1` | Street address line 1 | `properties.address_line1` | string | No | - | `123 Main Street` |
| `propertyAddressLine2` | Street address line 2 | `properties.address_line2` | string | No | - | `Suite 100` |
| `propertyCity` | City | `properties.city` | string | No | - | `San Francisco` |
| `propertyState` | State/province | `properties.state` | string | No | - | `CA` |
| `propertyPostalCode` | ZIP/postal code | `properties.postal_code` | string | No | - | `94102` |
| `propertyAddress` | Full formatted address | Computed: `formatAddress(properties)` | string | No | - | `123 Main Street, San Francisco, CA 94102` |
| `propertyParcelId` | Parcel/tax ID | `properties.parcel_id` | string | No | - | `123-456-789` |

### Unit Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `unitNumber` | Unit number/identifier | `units.unit_number` | string | No | `N/A` | `Unit 1` |
| `unitName` | Unit name | `units.unit_name` | string | No | - | `Apartment A` |
| `unitRent` | Monthly rent amount | `lease.rent_amount` | currency | No | `$0.00` | `$2,500.00` |

### Owner Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `recipientName` | Primary owner/recipient name | Computed: `getPrimaryOwnerName(property)` | string | Yes | `Property Owner` | `John Doe` |
| `ownerFirstName` | Owner first name | `contacts.first_name` (via ownerships) | string | No | - | `John` |
| `ownerLastName` | Owner last name | `contacts.last_name` | string | No | - | `Doe` |
| `ownerEmail` | Owner email | `contacts.primary_email` | string | No | - | `john.doe@example.com` |
| `ownerPhone` | Owner phone | `contacts.primary_phone` | string | No | - | `(555) 123-4567` |
| `ownerAddress` | Owner mailing address | Computed: `formatAddress(contacts.primary_address_*)` | string | No | - | `456 Owner St, San Francisco, CA 94103` |

### Tenant Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `tenantName` | Primary tenant name | `tenants.name` (via `monthly_logs.tenant_id`) | string | No | - | `Jane Smith` |
| `tenantEmail` | Tenant email | `tenants.email` | string | No | - | `jane.smith@example.com` |
| `tenantPhone` | Tenant phone | `tenants.phone` | string | No | - | `(555) 987-6543` |

### Lease Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `leaseStartDate` | Lease start date | `lease.start_date` (via `monthly_logs.lease_id`) | date | No | - | `2024-01-01` |
| `leaseEndDate` | Lease end date | `lease.end_date` | date | No | - | `2024-12-31` |
| `leaseDeposit` | Security deposit | `lease.deposit_amount` | currency | No | `$0.00` | `$2,500.00` |

### Statement Period

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `periodStart` | Period start date | `monthly_logs.period_start` | date | Yes | - | `2024-12-01` |
| `periodEnd` | Period end date (EOM) | Computed: `endOfMonth(period_start)` | date | No | - | `2024-12-31` |
| `periodMonth` | Formatted period | Computed: `format(period_start, "MMMM yyyy")` | date | Yes | - | `December 2024` |

### Financial Summary - Balances

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `openingBalance` | Opening balance | `monthly_logs.previous_lease_balance` | currency | No | `$0.00` | `$500.00` |
| `endingBalance` | Ending balance (net to owner) | Computed: `calculateNetToOwner(...)` | currency | No | `$0.00` | `$1,234.56` |

### Financial Summary - Income

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `totalCharges` | Total charges | `monthly_logs.charges_amount` | currency | No | `$0.00` | `$2,500.00` |
| `totalPayments` | Total payments received | `monthly_logs.payments_amount` | currency | No | `$0.00` | `$2,500.00` |
| `totalCredits` | Total credits | Computed: sum of credit transactions | currency | No | `$0.00` | `$100.00` |

### Financial Summary - Expenses

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `totalBills` | Total bills/expenses | `monthly_logs.bills_amount` | currency | No | `$0.00` | `$500.00` |
| `managementFee` | Management fee | `monthly_logs.management_fees_amount` | currency | No | `$0.00` | `$250.00` |
| `escrowAmount` | Escrow amount | `monthly_logs.escrow_amount` | currency | No | `$0.00` | `$200.00` |
| `totalFees` | Total fees | Computed: `management_fees_amount + other_fees` | currency | No | `$0.00` | `$275.00` |
| `taxAmount` | Total tax | Computed: sum of tax transactions | currency | No | `$0.00` | `$150.00` |

### Financial Summary - Owner Distribution

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `netToOwner` | Net to owner | Computed: `calculateNetToOwnerValue(...)` | currency | Yes | `$0.00` | `$1,234.56` |
| `ownerDraw` | Owner draw available | Computed: `getOwnerDrawSummary(...)` | currency | Yes | `$0.00` | `$1,234.56` |
| `ownerStatementAmount` | Owner statement amount | `monthly_logs.owner_statement_amount` | currency | No | `$0.00` | `$1,234.56` |
| `ownerDistributionAmount` | Owner distribution | `monthly_logs.owner_distribution_amount` | currency | No | `$0.00` | `$1,234.56` |

### Organization/Company Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `companyName` | Organization name | `organizations.name` | string | Yes | `Property Management Company` | `Acme Property Management` |
| `companyAddress` | Organization address | `organizations.address` | string | No | - | `789 Company St, San Francisco, CA 94104` |
| `companyPhone` | Organization phone | `organizations.phone` | string | No | - | `(555) 555-5555` |
| `companyEmail` | Organization email | `organizations.email` | string | No | - | `info@acmepm.com` |

### Bank/Remittance Information

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `bankAccountName` | Bank account name | `bank_accounts.account_name` (via `properties.operating_bank_account_id`) | string | No | - | `Operating Account` |
| `bankAccountNumber` | Account number (masked) | `bank_accounts.account_number_masked` | string | No | - | `****1234` |
| `remitToAddress` | Remittance address | Computed: `companyAddress or bankAddress` | string | No | - | `789 Company St, San Francisco, CA 94104` |

### Statement Notes/Memo

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `statementNotes` | Statement notes/memo | `monthly_logs.notes` | string | No | - | `Special note about this statement period` |

### Current Date/Time

| Variable | Description | Source | Format | Required | Null Default | Example |
|----------|-------------|--------|--------|----------|--------------|---------|
| `currentDate` | Current year | Computed: `new Date().getFullYear()` | string | No | `2024` | `2024` |
| `currentDateTime` | Current date/time | Computed: `new Date()` | date | No | - | `2024-12-07T19:09:27Z` |

## Formatting Rules

### Currency Formatting
- Locale: `en-US`
- Currency: `USD`
- Format: `$1,234.56`
- Null handling: Returns `nullDefault` (typically `$0.00` or empty string)

### Date Formatting
- Short format: `1/15/2024`
- Long format: `January 15, 2024`
- ISO format: `2024-01-15T00:00:00Z`
- Month-Year format: `January 2024`
- Timezone: Uses system timezone (can be overridden)

### Number Formatting
- Decimals: 2 decimal places (configurable)
- Format: `1,234.56`
- Null handling: Returns `nullDefault` (typically empty string)

### Percent Formatting
- Decimals: 1 decimal place (configurable)
- Format: `12.5%`
- Input: Value as number (e.g., `12.5` for 12.5%)
- Null handling: Returns `nullDefault` (typically empty string)

### URL Formatting
- Validates URL format
- Adds `https://` prefix if missing
- Returns empty string if invalid

## Usage Examples

### Subject Line
```
Monthly Statement - {{propertyName}} ({{periodMonth}})
```

### HTML Body
```html
<p>Dear {{recipientName}},</p>
<p>Your monthly statement for <strong>{{periodMonth}}</strong> is now available.</p>
<p>Property: {{propertyName}}</p>
<p>Net to Owner: {{netToOwner}}</p>
<p>Owner Draw: {{ownerDraw}}</p>
<a href="{{pdfUrl}}">Download Statement PDF</a>
```

### Plain Text Body
```
Dear {{recipientName}},

Your monthly statement for {{periodMonth}} is now available.

Property: {{propertyName}}
Net to Owner: {{netToOwner}}
Owner Draw: {{ownerDraw}}

Download your statement: {{pdfUrl}}
```

## Variable Substitution Rules

1. **Syntax**: `{{variableName}}` (case-sensitive, double curly braces)
2. **Unknown variables**: **ERROR** - prevents template save, returns validation error
3. **Missing required variables**: Replaced with empty string, **log warning**
4. **Missing optional variables**: Replaced with empty string (or `nullDefault`), **no warning**
5. **Unused variables**: Silently ignored
6. **HTML escaping**:
   - HTML body: Variables inserted as raw HTML (no escaping)
   - Text body: Variables escaped (HTML entities), HTML tags stripped
   - Subject line: No HTML allowed, variables as plain text

