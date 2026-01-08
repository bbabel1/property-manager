# API Endpoints Reference

<!-- markdownlint-configure-file {"MD013": false} -->

> Quick reference for API endpoints in the Property Management System

## Authentication

All endpoints require authentication using Supabase JWT tokens.

```bash

Authorization: Bearer <your-jwt-token>

```

## Endpoints

### Auth Endpoints

- Authentication is handled via Supabase Auth (client + cookies). There are no NextAuth routes.

### Bank Accounts

- `GET /api/bank-accounts` - List bank accounts
- `POST /api/bank-accounts` - Create bank account
- `POST /api/bank-accounts/sync` - Sync bank accounts from Buildium
- `GET /api/bank-accounts/sync` - Get bank account sync status

### Bills

- `GET /api/bills` - List bills; supports `approval_state` filter via `?approval_state=pending_approval`
- `POST /api/bills` - Record a vendor bill (header + debit lines + credit balancing line)
- `PATCH /api/bills/{id}` - Update bill header/lines; amount/line edits blocked when approved
- `DELETE /api/bills/{id}` - Hard delete drafts only (no applications, not synced)
- `POST /api/bills/{id}/submit` - Move to pending approval
- `POST /api/bills/{id}/approve` - Approve (requires `bills.approve`)
- `POST /api/bills/{id}/reject` - Reject (requires `bills.approve`)
- `POST /api/bills/{id}/void` - Void with reversal (requires `bills.void`)

**Request Body:**

```json
{
  "bill_date": "2025-11-09",
  "due_date": "2025-11-16",
  "vendor_id": "123",
  "post_to_account_id": "ap-5000",
  "property_id": null,
  "unit_id": null,
  "terms": "net_30",
  "reference_number": "INV-000123",
  "memo": "Roof repair",
  "lines": [
    {
      "property_id": "88",
      "unit_id": null,
      "gl_account_id": "6000",
      "description": "Labor",
      "amount": 1200.0
    }
  ]
}
```

**Response:**

```json
{
  "data": {
    "id": "c1b4fd33-42c5-4a55-9cb6-7c5ce519d9f3",
    "vendor_id": "123",
    "total_amount": 1200,
    "date": "2025-11-09",
    "due_date": "2025-11-16",
    "memo": "Roof repair",
    "reference_number": "INV-000123",
    "term_days": 30
  }
}
```

### Owners

- `GET /api/owners` - List owners
- `POST /api/owners` - Create owner
- `GET /api/owners/{id}` - Get owner details
- `PUT /api/owners/{id}` - Update owner
- `GET /api/owners/{id}/properties` - Get owner's properties

### Properties

- `GET /api/properties` - List properties
- `POST /api/properties` - Create property
- `GET /api/properties/{id}` - Get property details
- `PUT /api/properties/{id}` - Update property
- `PUT /api/properties/{id}/banking` - Update property banking

### Staff

- `GET /api/staff` - List staff members
- `POST /api/staff` - Create staff member

### Units

- `GET /api/units` - List units
- `POST /api/units` - Create unit

### Management Service

- `GET /api/management-service/config` - Get management service configuration
- `PUT /api/management-service/config` - Update management service configuration
- `POST /api/management-service/units` - Get all units service configurations for a property

### Buildium Integration

- `GET /api/buildium/bank-accounts` - Buildium bank accounts
- `GET /api/buildium/properties` - Buildium properties
- `GET /api/buildium/owners` - Buildium owners
- `GET /api/buildium/leases` - Buildium leases

### Files

- `GET /api/files/list` - List organization files with filtering and pagination
- `GET /api/files/categories` - Retrieve synced file categories for the active org
- `POST /api/files/upload` - Upload a file; automatically mirrors the payload to Buildium whenever the target entity has a Buildium ID (property/unit/lease/tenant/owner/vendor) and records the returned Buildium file identifiers locally
- `PUT /api/files/{id}` - Update file metadata (title, description, category) and optionally trigger Buildium sync updates
- `DELETE /api/files/{id}` - Soft delete a file
- `GET /api/files/{id}/presign` - Fetch a signed URL for previewing/downloading file contents
- `PUT /api/files/{id}/sharing` - Toggle Buildium portal sharing with tenants or rental owners (requires `buildium_file_id`)

### Email Templates

### Vendor payments & credits

- `POST /api/payments`
  - Payload: `{ bank_account_id, amount, payment_date, bill_allocations: [{ bill_id, amount }] }`
  - Rules: allocations must equal amount; bank/bills must share org; bank must be `is_bank_account`; uses `validate_bill_application`; 409 if source payment reconciled
- `POST /api/bills/{id}/applications`
  - Payload: `{ source_transaction_id, applied_amount, source_type? }`
  - Rules: org match, validation via RPC, 409 if source reconciled
- `DELETE /api/bills/{id}/applications/{applicationId}`
  - Removes application; 409 if source reconciled
- `POST /api/vendor-credits`
  - Payload: `{ vendor_id, credit_date, amount, gl_account_id, bill_allocations? }`
  - Rules: credit GL must be non-bank and org-aligned; allocations ≤ amount; uses `post_transaction`
- `POST /api/vendor-credits/{id}/apply`
  - Payload: `{ bill_allocations: [{ bill_id, amount }] }`
  - Rules: org match; uses `validate_bill_application`; 409 if credit reconciled

- `GET /api/email-templates` - List email templates with pagination and filtering
- `POST /api/email-templates` - Create new email template (admin/manager only)
- `GET /api/email-templates/{id}` - Get template by ID
- `PUT /api/email-templates/{id}` - Full update with optimistic concurrency (admin/manager only)
- `PATCH /api/email-templates/{id}` - Partial update with optimistic concurrency (admin/manager only)
- `DELETE /api/email-templates/{id}` - Archive template (soft delete, admin/manager only)
- `POST /api/email-templates/{id}/preview` - Preview rendered template (rate limited: 10/min)
- `POST /api/email-templates/{id}/test` - Send test email (admin/manager only, rate limited: 5/hour)
- `GET /api/email-templates/variables/{templateKey}` - Get available variables for template type

**GET /api/email-templates**

Query parameters:

- `status` (optional): Filter by status (`active`, `inactive`, `archived`)
- `templateKey` (optional): Filter by template key
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**POST /api/email-templates**

Request body:

```json
{
  "template_key": "monthly_rental_statement",
  "name": "Monthly Rental Statement",
  "description": "Template description",
  "subject_template": "Monthly Statement - {{propertyName}}",
  "body_html_template": "<p>HTML content</p>",
  "body_text_template": "Plain text content",
  "available_variables": [...],
  "status": "active"
}
```

**POST /api/email-templates/{id}/preview**

Request body (optional):

```json
{
  "variables": {
    "propertyName": "123 Main St",
    "periodMonth": "December 2024"
  }
}
```

Response:

```json
{
  "subject": "Monthly Statement - 123 Main St",
  "bodyHtml": "<p>Rendered HTML</p>",
  "bodyText": "Rendered text",
  "warnings": ["Missing required variable: recipientName"]
}
```

### Buildium sync (bills/AP)

- Outbound payments: include `BillIds[]` built from `bill_applications` allocations; keeps Buildium in sync with multi-bill payments.
- Inbound BillPayment/VendorTransaction webhooks: create/update `bill_workflow` (Buildium bills treated as approved), build `bill_applications` from `BillIds[]`, and ingest vendor credits/refunds with allocations when provided.
- Vendor credits/refunds outbound: currently not supported; local transaction remains primary (warn logged).
- Approval conflicts prefer local state; discrepancies are logged for manual review.

### Backfill runbook

- Script: `scripts/backfill-bill-workflow-and-applications.ts`
- DRY RUN: `DRY_RUN=true npx tsx scripts/backfill-bill-workflow-and-applications.ts`
- Live: `npx tsx scripts/backfill-bill-workflow-and-applications.ts`
- Outputs `backfill-report-<timestamp>.json` with metrics (workflows/applications created, AP account resolutions, failures).

**Error Codes:**

- `TEMPLATE_NOT_FOUND` - Template doesn't exist or wrong org
- `INVALID_TEMPLATE_KEY` - Unknown template_key enum value
- `INVALID_VARIABLES` - Unknown variables in template
- `TEMPLATE_CONFLICT` - Optimistic concurrency conflict (409)
- `TEMPLATE_KEY_IMMUTABLE` - Attempted to change template_key
- `TEMPLATE_KEY_EXISTS` - Template key already exists for org
- `RATE_LIMIT_EXCEEDED` - Rate limit hit (429)
- `VALIDATION_ERROR` - Field validation failed (400)

## File Locations

```text

src/app/api/
├── bank-accounts/
│   ├── route.ts
│   └── sync/route.ts
├── owners/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/properties/route.ts
├── properties/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/banking/route.ts
├── staff/route.ts
├── units/route.ts
├── management-service/
│   ├── config/route.ts
│   └── units/route.ts
└── buildium/
    ├── bank-accounts/route.ts
    ├── properties/route.ts
    ├── owners/route.ts
    └── leases/route.ts

```

## Common Response Format

```json

{
  "success": true,
  "data": [...],
  "count": 1
}

```

## Error Response

```json
{
  "error": "Error message"
}
```

## Management Service API Details

### GET /api/management-service/config

Get management service configuration for a property or unit.

**Query Parameters:**

- `propertyId` (required): UUID of the property
- `unitId` (optional): UUID of the unit (for unit-level configuration)

**Response:**

```json
{
  "success": true,
  "data": {
    "service_plan": "Full",
    "active_services": ["Rent Collection", "Maintenance"],
    "bill_administration": "Notes about billing",
    "source": "property",
    "unit_id": "uuid"
  }
}
```

**Logic:**

- If `service_assignment` is "Property Level": fetches from `properties` table
- If `service_assignment` is "Unit Level": fetches from `units` table
- Defaults to property level if `service_assignment` is null

### PUT /api/management-service/config

Update management service configuration.

**Query Parameters:**

- `propertyId` (required): UUID of the property
- `unitId` (optional): UUID of the unit (for unit-level updates)

**Request Body:**

```json
{
  "service_plan": "Basic",
  "active_services": ["Rent Collection"],
  "bill_administration": "Updated notes"
}
```

**Response:**

```json
{
  "success": true
}
```

### POST /api/management-service/units

Get all units service configurations for a property.

**Request Body:**

```json
{
  "propertyId": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "service_plan": "Full",
      "active_services": ["Rent Collection", "Maintenance"],
      "bill_administration": "Unit notes",
      "source": "unit",
      "unit_id": "uuid",
      "unit_number": "1A"
    }
  ]
}
```

## Rate Limiting

- 100 requests per minute per user
- 429 status code when exceeded
