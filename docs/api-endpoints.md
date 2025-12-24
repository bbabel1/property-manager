# Internal API Endpoints Reference

This document lists all internal API endpoints available in the codebase, organized by category.

## Admin Endpoints

- `GET/POST /api/admin/alerts/reconciliations` - Reconciliation alerts
- `GET/POST /api/admin/contacts` - Contact management
- `GET/POST /api/admin/memberships` - Organization memberships
- `GET /api/admin/memberships/simple` - Simplified membership list
- `GET/POST /api/admin/orgs` - Organization management
- `GET/POST /api/admin/permission-profiles` - Permission profiles
- `POST /api/admin/permission-profiles/assign` - Assign permission profiles
- `POST /api/admin/sync/reconciliations` - Sync reconciliations
- `GET/POST /api/admin/users` - User management
- `POST /api/admin/users/invite` - Invite users
- `GET/PUT /api/admin/users/meta` - User metadata
- `PUT /api/admin/users/update-email` - Update user email

## Authentication & Authorization

- `GET /api/auth/calendar/callback` - Google Calendar OAuth callback
- `GET /api/auth/calendar/initiate` - Initiate Google Calendar OAuth
- `GET /api/auth/gmail/callback` - Gmail OAuth callback
- `GET /api/auth/gmail/initiate` - Initiate Gmail OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/csrf` - CSRF token

## Bank Accounts

- `GET/POST /api/bank-accounts` - List/create bank accounts
- `GET/PUT/DELETE /api/bank-accounts/{id}` - Get/update/delete bank account
- `POST /api/bank-accounts/import` - Import bank accounts
- `POST /api/bank-accounts/sync` - Sync bank accounts
- `POST /api/bank-accounts/sync/from-buildium` - Sync from Buildium

## Bills

- `GET/POST /api/bills` - List/create bills
- `GET/PUT/DELETE /api/bills/{id}` - Get/update/delete bill
- `GET /api/bills/{id}/files/{fileId}/presign` - Presign bill file URL

## Buildings

- `GET/POST /api/buildings` - List/create buildings
- `GET/PUT/DELETE /api/buildings/{buildingId}` - Get/update/delete building

## Buildium Integration

### General

- `GET /api/buildium/integration` - Get integration status
- `PUT /api/buildium/integration` - Update integration credentials
- `DELETE /api/buildium/integration` - Delete integration
- `POST /api/buildium/integration/status` - Check integration status
- `POST /api/buildium/integration/toggle` - Toggle integration
- `POST /api/buildium/integration/rotate-webhook-secret` - Rotate webhook secret
- `POST /api/buildium/sync` - Trigger sync

### Account Info

- `GET /api/buildium/account-info` - Get account information
- `GET /api/buildium/accounting-lock-periods` - Get accounting lock periods

### Appliances

- `GET/POST /api/buildium/appliances` - List/create appliances
- `GET/PUT/DELETE /api/buildium/appliances/{id}` - Get/update/delete appliance
- `GET/POST /api/buildium/appliances/{id}/service-history` - Service history
- `GET/PUT/DELETE /api/buildium/appliances/{id}/service-history/{serviceHistoryId}` - Service history item

### Bank Accounts

- `GET /api/buildium/bank-accounts` - List bank accounts
- `GET /api/buildium/bank-accounts/{id}` - Get bank account
- `POST /api/buildium/bank-accounts/sync` - Sync bank accounts
- `GET /api/buildium/bank-accounts/transactions` - List transactions
- `GET /api/buildium/bank-accounts/transactions/{id}` - Get transaction
- `GET /api/buildium/bank-accounts/checks` - List checks
- `GET /api/buildium/bank-accounts/checks/{id}` - Get check
- `GET /api/buildium/bank-accounts/checks/{id}/files` - Get check files
- `GET /api/buildium/bank-accounts/checks/{id}/files/{fileId}` - Get check file
- `GET /api/buildium/bank-accounts/deposits` - List deposits
- `GET /api/buildium/bank-accounts/deposits/{id}` - Get deposit
- `GET /api/buildium/bank-accounts/quick-deposits` - List quick deposits
- `GET /api/buildium/bank-accounts/quick-deposits/{id}` - Get quick deposit
- `GET /api/buildium/bank-accounts/reconciliations` - List reconciliations
- `GET /api/buildium/bank-accounts/reconciliations/{id}` - Get reconciliation
- `POST /api/buildium/bank-accounts/reconciliations/{id}/balance` - Get balance
- `POST /api/buildium/bank-accounts/reconciliations/{id}/clear-transactions` - Clear transactions
- `POST /api/buildium/bank-accounts/reconciliations/{id}/finalize` - Finalize reconciliation
- `GET /api/buildium/bank-accounts/reconciliations/{id}/transactions` - Get reconciliation transactions
- `POST /api/buildium/bank-accounts/reconciliations/{id}/unclear-transactions` - Unclear transactions
- `GET /api/buildium/bank-accounts/transfers` - List transfers
- `GET /api/buildium/bank-accounts/transfers/{id}` - Get transfer
- `GET /api/buildium/bank-accounts/undeposited-funds` - Get undeposited funds
- `GET /api/buildium/bank-accounts/withdrawals` - List withdrawals
- `GET /api/buildium/bank-accounts/withdrawals/{id}` - Get withdrawal
- `GET /api/buildium/bank-accounts/{id}/reconciliations` - Get bank account reconciliations

### Bills

- `GET /api/buildium/bills` - List bills
- `GET /api/buildium/bills/{id}` - Get bill
- `POST /api/buildium/bills/sync` - Sync bills
- `POST /api/buildium/bills/sync/to-buildium` - Sync bill to Buildium
- `GET /api/buildium/bills/payments` - List bill payments
- `GET /api/buildium/bills/{id}/payments` - Get bill payments
- `GET /api/buildium/bills/{id}/payments/{paymentId}` - Get bill payment
- `GET /api/buildium/bills/{id}/files` - Get bill files
- `GET /api/buildium/bills/{id}/files/{fileId}` - Get bill file
- `POST /api/buildium/bills/{id}/sync` - Sync bill

### Files

- `GET /api/buildium/files` - List files
- `GET /api/buildium/files/{id}` - Get file
- `GET /api/buildium/files/{id}/sharesettings` - Get file share settings
- `GET /api/buildium/files/uploadrequests` - Get upload requests
- `GET /api/buildium/file-categories` - List file categories
- `GET /api/buildium/file-categories/{id}` - Get file category

### General Ledger

- `GET /api/buildium/general-ledger/accounts` - List GL accounts
- `GET /api/buildium/general-ledger/accounts/{id}` - Get GL account
- `GET /api/buildium/general-ledger/accounts/balances` - Get account balances
- `GET /api/buildium/general-ledger/accounts/{id}/balances` - Get account balance
- `POST /api/buildium/general-ledger/accounts/sync` - Sync GL accounts
- `GET /api/buildium/general-ledger/entries` - List GL entries
- `GET /api/buildium/general-ledger/entries/{id}` - Get GL entry
- `POST /api/buildium/general-ledger/entries/sync` - Sync GL entries
- `GET /api/buildium/general-ledger/transactions` - List GL transactions
- `GET /api/buildium/general-ledger/transactions/{id}` - Get GL transaction

### Leases

- `GET /api/buildium/leases` - List leases
- `GET /api/buildium/leases/{buildiumLeaseId}` - Get lease
- `GET /api/buildium/leases/{buildiumLeaseId}/moveouts` - List moveouts
- `GET /api/buildium/leases/{buildiumLeaseId}/moveouts/{moveOutId}` - Get moveout
- `GET/POST /api/buildium/leases/{buildiumLeaseId}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/leases/{buildiumLeaseId}/notes/{noteId}` - Get/update/delete note
- `GET /api/buildium/leases/{buildiumLeaseId}/recurringtransactions` - List recurring transactions
- `GET /api/buildium/leases/{buildiumLeaseId}/recurringtransactions/{recurringId}` - Get recurring transaction
- `GET /api/buildium/leases/{buildiumLeaseId}/transactions` - List transactions
- `GET /api/buildium/leases/{buildiumLeaseId}/transactions/{transactionId}` - Get transaction
- `GET /api/buildium/leases/{buildiumLeaseId}/transactions/charges` - List charges
- `GET /api/buildium/leases/{buildiumLeaseId}/transactions/charges/{chargeId}` - Get charge
- `GET /api/buildium/leases/{buildiumLeaseId}/transactions/outstanding-balances` - Get outstanding balances

### Owners

- `GET /api/buildium/owners` - List owners
- `GET /api/buildium/owners/{id}` - Get owner
- `POST /api/buildium/owners/sync` - Sync owners
- `POST /api/buildium/owners/{id}/sync` - Sync specific owner
- `GET/POST /api/buildium/owners/{id}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/owners/{id}/notes/{noteId}` - Get/update/delete note
- `GET /api/buildium/owner-requests` - List owner requests
- `GET /api/buildium/owner-requests/{id}` - Get owner request
- `POST /api/buildium/owner-requests/{id}/contribution` - Create contribution

### Properties

- `GET /api/buildium/properties` - List properties
- `GET /api/buildium/properties/{id}` - Get property
- `GET /api/buildium/properties/{id}/amenities` - Get amenities
- `GET /api/buildium/properties/{id}/epay-settings` - Get ePay settings
- `GET /api/buildium/properties/{id}/images` - List images
- `GET /api/buildium/properties/{id}/images/{imageId}` - Get image
- `GET /api/buildium/properties/{id}/images/video` - Get video
- `GET/POST /api/buildium/properties/{id}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/properties/{id}/notes/{noteId}` - Get/update/delete note
- `GET /api/buildium/properties/{id}/preferred-vendors` - Get preferred vendors
- `POST /api/buildium/properties/{id}/inactivate` - Inactivate property
- `POST /api/buildium/properties/{id}/reactivate` - Reactivate property
- `GET /api/buildium/properties/{id}/units` - List units
- `GET /api/buildium/properties/{id}/units/{unitId}` - Get unit

### Staff

- `POST /api/buildium/staff/sync` - Sync staff
- `GET/POST /api/buildium/staff/sync-all` - Sync all staff

### Tasks

- `GET /api/buildium/tasks` - List tasks
- `GET /api/buildium/tasks/{id}` - Get task
- `GET /api/buildium/tasks/categories` - List task categories
- `GET /api/buildium/tasks/categories/{categoryId}` - Get task category
- `GET /api/buildium/tasks/{id}/history` - List task history
- `GET /api/buildium/tasks/{id}/history/{historyId}` - Get task history item
- `GET /api/buildium/tasks/{id}/history/{historyId}/files` - List task history files
- `GET /api/buildium/tasks/{id}/history/{historyId}/files/{fileId}` - Get task history file
- `POST /api/buildium/import-task-work-order` - Import task as work order

### Tenants

- `GET /api/buildium/tenants` - List tenants
- `GET /api/buildium/tenants/{id}` - Get tenant
- `GET/POST /api/buildium/tenants/{id}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/tenants/{id}/notes/{noteId}` - Get/update/delete note

### Units

- `GET /api/buildium/units` - List units
- `GET /api/buildium/units/{id}` - Get unit
- `GET /api/buildium/units/{id}/amenities` - Get amenities
- `GET /api/buildium/units/{id}/images` - List images
- `GET /api/buildium/units/{id}/images/{imageId}` - Get image
- `GET /api/buildium/units/{id}/images/video` - Get video
- `GET/POST /api/buildium/units/{id}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/units/{id}/notes/{noteId}` - Get/update/delete note

### Users & Roles

- `GET /api/buildium/users` - List users
- `GET /api/buildium/users/{id}` - Get user
- `GET /api/buildium/user-roles` - List user roles
- `GET /api/buildium/user-roles/{id}` - Get user role

### Vendors

- `GET /api/buildium/vendors` - List vendors
- `GET /api/buildium/vendors/{id}` - Get vendor
- `GET /api/buildium/vendors/{id}/transactions` - Get vendor transactions
- `GET/POST /api/buildium/vendors/{id}/notes` - List/create notes
- `GET/PUT/DELETE /api/buildium/vendors/{id}/notes/{noteId}` - Get/update/delete note
- `GET /api/buildium/vendors/{id}/credits` - List credits
- `GET /api/buildium/vendors/{id}/credits/{creditId}` - Get credit
- `GET /api/buildium/vendors/{id}/refunds` - List refunds
- `GET /api/buildium/vendors/{id}/refunds/{refundId}` - Get refund
- `GET /api/buildium/vendor-categories` - List vendor categories
- `GET /api/buildium/vendor-categories/{id}` - Get vendor category
- `GET /api/buildium/partial-payment-settings` - Get partial payment settings

### Work Orders

- `GET /api/buildium/work-orders` - List work orders
- `GET /api/buildium/work-orders/{id}` - Get work order

### Requests

- `GET /api/buildium/resident-requests` - List resident requests
- `GET /api/buildium/resident-requests/{id}` - Get resident request
- `GET /api/buildium/todo-requests` - List todo requests
- `GET /api/buildium/todo-requests/{id}` - Get todo request

## Calendar

- `POST /api/calendar/disconnect` - Disconnect calendar
- `GET/POST /api/calendar/events` - List/create calendar events
- `GET/PUT/DELETE /api/calendar/events/{eventId}` - Get/update/delete event
- `GET /api/calendar/local-events` - Get local events
- `GET /api/calendar/status` - Get calendar status

## Compliance

- `GET /api/compliance/portfolio` - Get compliance portfolio
- `POST /api/compliance/sync` - Sync compliance data
- `GET /api/compliance/assets/{assetId}` - Get compliance asset
- `GET /api/compliance/items/{itemId}` - Get compliance item
- `GET/POST /api/compliance/programs` - List/create compliance programs
- `GET/PUT/DELETE /api/compliance/programs/{programId}` - Get/update/delete program
- `POST /api/compliance/programs/{programId}/generate` - Generate compliance program
- `GET /api/compliance/programs/{programId}/preview` - Preview compliance program
- `POST /api/compliance/programs/{programId}/reevaluate` - Reevaluate compliance program
- `GET /api/compliance/properties/{propertyId}` - Get property compliance
- `POST /api/compliance/properties/{propertyId}/filings/sync` - Sync filings
- `POST /api/compliance/properties/{propertyId}/violations/sync` - Sync violations
- `GET /api/compliance/properties/{propertyId}/programs` - List property programs
- `GET /api/compliance/properties/{propertyId}/programs/available` - List available programs
- `GET/PUT /api/compliance/properties/{propertyId}/programs/{programId}` - Get/update property program

## Dashboard

- `GET /api/dashboard/{orgId}` - Get dashboard data
- `GET /api/dashboard/{orgId}/service-metrics` - Get service metrics

## Debug

- `GET /api/debug/supabase` - Debug Supabase connection

## Email Templates

- `GET/POST /api/email-templates` - List/create email templates
- `GET/PUT/DELETE /api/email-templates/{id}` - Get/update/delete template
- `POST /api/email-templates/{id}/duplicate` - Duplicate template
- `POST /api/email-templates/{id}/preview` - Preview template
- `POST /api/email-templates/{id}/test` - Test template
- `POST /api/email-templates/preview` - Preview template (generic)
- `GET /api/email-templates/variables/{templateKey}` - Get template variables

## Files

- `GET/POST /api/files` - List/create files
- `GET/PUT/DELETE /api/files/{id}` - Get/update/delete file
- `POST /api/files/upload` - Upload file
- `POST /api/files/attach` - Attach file
- `GET /api/files/list` - List files with filters
- `GET /api/files/categories` - List file categories
- `GET /api/files/entities` - Get file entities
- `GET /api/files/{id}/download` - Download file
- `GET /api/files/{id}/link` - Get file link
- `GET /api/files/{id}/presign` - Presign file URL
- `POST /api/files/{id}/resync` - Resync file
- `GET/PUT /api/files/{id}/sharing` - Get/update file sharing

## GL Accounts

- `GET/POST /api/gl-accounts` - List/create GL accounts
- `GET/PUT/DELETE /api/gl-accounts/{id}` - Get/update/delete GL account
- `GET /api/gl-accounts/bank-accounts` - List bank GL accounts
- `GET /api/gl-accounts/expense` - List expense GL accounts

## Gmail

- `POST /api/gmail/disconnect` - Disconnect Gmail
- `GET /api/gmail/status` - Get Gmail status

## Google

- `GET /api/google/people/search` - Search Google contacts

## Health

- `GET /api/health` - Health check

## Journal Entries

- `GET/POST /api/journal-entries` - List/create journal entries
- `GET/PUT/DELETE /api/journal-entries/{transactionId}` - Get/update/delete journal entry
- `GET /api/journal-entries/{transactionId}/details` - Get journal entry details

## Lease Contacts

- `GET/PUT/DELETE /api/lease-contacts/{id}` - Get/update/delete lease contact

## Leases

- `GET/POST /api/leases` - List/create leases
- `GET/PUT/DELETE /api/leases/{id}` - Get/update/delete lease
- `GET /api/leases/status` - Get lease status
- `GET /api/leases/{id}/charges` - List charges
- `GET /api/leases/{id}/credits` - List credits
- `GET /api/leases/{id}/payments` - List payments
- `GET /api/leases/{id}/refunds` - List refunds
- `GET /api/leases/{id}/recurring-charges` - List recurring charges
- `GET /api/leases/{id}/recurring-payments` - List recurring payments
- `GET /api/leases/{id}/rent-schedules` - Get rent schedules
- `GET /api/leases/{id}/withheld-deposits` - Get withheld deposits
- `GET /api/leases/{id}/financial-options` - Get financial options
- `POST /api/leases/{id}/sync` - Sync lease
- `GET /api/leases/{id}/transactions/{transactionId}` - Get transaction
- `GET /api/leases/{id}/documents/presign` - Presign document URL
- `GET /api/leases/{id}/documents/{docId}/presign` - Presign specific document URL
- `POST /api/leases/{id}/documents/{docId}/sync` - Sync document

## Manager

- `GET/PATCH /api/organization` - Get/update organization
- `GET /api/organization/members` - List organization members
- `POST /api/organizations` - Create organization

## Metrics

- `POST /api/metrics/rum` - Record Real User Monitoring metrics

## Monthly Logs

- `GET/POST /api/monthly-logs` - List/create monthly logs
- `GET/PUT/DELETE /api/monthly-logs/{logId}` - Get/update/delete monthly log
- `GET /api/monthly-logs/{logId}/bill-options` - Get bill options
- `GET /api/monthly-logs/{logId}/bills` - Get bills
- `GET /api/monthly-logs/{logId}/escrow` - Get escrow information
- `GET /api/monthly-logs/{logId}/financial-summary` - Get financial summary
- `POST /api/monthly-logs/{logId}/generate-pdf` - Generate PDF statement
- `GET /api/monthly-logs/{logId}/management-fees` - Get management fees
- `POST /api/monthly-logs/{logId}/management-fees/generate` - Generate management fees
- `GET /api/monthly-logs/{logId}/owner-draw-options` - Get owner draw options
- `POST /api/monthly-logs/{logId}/owner-draw` - Create owner draw
- `GET /api/monthly-logs/{logId}/payments` - Get payments
- `GET /api/monthly-logs/{logId}/preview-statement` - Preview statement
- `POST /api/monthly-logs/{logId}/reconcile` - Reconcile monthly log
- `GET /api/monthly-logs/{logId}/related` - Get related logs
- `POST /api/monthly-logs/{logId}/send-statement` - Send statement
- `POST /api/monthly-logs/{logId}/stage-transactions` - Stage transactions
- `GET /api/monthly-logs/{logId}/statement-history` - Get statement history
- `GET /api/monthly-logs/{logId}/tasks` - Get tasks
- `GET /api/monthly-logs/{logId}/transactions` - Get transactions
- `POST /api/monthly-logs/{logId}/transactions/assign` - Assign transactions
- `GET /api/monthly-logs/{logId}/transactions/{transactionId}` - Get transaction
- `POST /api/monthly-logs/{logId}/transactions/{transactionId}/unassign` - Unassign transaction
- `POST /api/monthly-logs/{logId}/update` - Update monthly log
- `GET/POST /api/monthly-logs/recurring-tasks` - List/create recurring tasks
- `GET/PUT/DELETE /api/monthly-logs/recurring-tasks/{taskId}` - Get/update/delete recurring task

## NYC Data

- `GET/POST /api/nyc-data/integration` - Get/update NYC data integration
- `GET /api/nyc-data/pluto` - Get PLUTO data
- `GET/POST /api/nyc-data/sources` - List/create data sources

## Owners

- `GET/POST /api/owners` - List/create owners
- `GET/PUT/DELETE /api/owners/{id}` - Get/update/delete owner
- `GET /api/owners/{id}/properties` - Get owner properties

## Profile

- `GET/PUT /api/profile` - Get/update user profile
- `POST /api/profile/avatar` - Update profile avatar

## Properties

- `GET/POST /api/properties` - List/create properties
- `GET/PUT/DELETE /api/properties/{id}` - Get/update/delete property
- `GET /api/properties/{id}/banking` - Get banking information
- `GET /api/properties/{id}/details` - Get property details
- `GET /api/properties/{id}/financials` - Get financial information
- `GET/POST /api/properties/{id}/notes` - List/create notes
- `GET /api/properties/{id}/statement-recipients` - Get statement recipients
- `POST /api/properties/{id}/sync` - Sync property
- `GET /api/properties/{id}/sync-status` - Get sync status

## Property Staff

- `GET/POST /api/property-staff` - List/create property staff assignments

## Reconciliations

- `GET /api/reconciliations/pending` - Get pending reconciliations

## Reports

- `GET /api/reports/services` - Get services report

## Services

- `GET/POST /api/services/assignments` - List/create service assignments
- `GET /api/services/assignment-services` - List assignment services
- `GET /api/services/assignment-level` - Get assignment level
- `GET/POST /api/services/automation-rules` - List/create automation rules
- `GET/PUT/DELETE /api/services/automation-rules/{id}` - Get/update/delete automation rule
- `GET/POST /api/services/billing-events` - List/create billing events
- `POST /api/services/billing-events/{id}/void` - Void billing event
- `GET/POST /api/services/catalog` - List/create service catalog items
- `GET/PUT/DELETE /api/services/catalog/{id}` - Get/update/delete catalog item
- `GET/POST /api/services/plans` - List/create service plans

## Staff

- `GET/POST /api/staff` - List/create staff members

## Tenants

- `GET /api/tenants/active` - List active tenants
- `GET/PUT/DELETE /api/tenants/{id}` - Get/update/delete tenant

## Transactions

- `GET /api/transactions/unassigned` - List unassigned transactions

## Units

- `GET/POST /api/units` - List/create units
- `GET/PUT/DELETE /api/units/{id}` - Get/update/delete unit
- `POST /api/units/{id}/sync` - Sync unit
- `POST /api/units/sync/from-buildium` - Sync units from Buildium
- `GET/POST /api/units/{id}/images` - List/create unit images
- `GET/DELETE /api/units/{id}/images/{imageId}` - Get/delete unit image

## Vendors

- `GET/POST /api/vendors` - List/create vendors
- `GET/PUT/DELETE /api/vendors/{vendorId}` - Get/update/delete vendor
- `POST /api/vendors/recommendations` - Get vendor recommendations
- `POST /api/vendors/ai/assistant` - AI vendor assistant
- `GET /api/vendor-categories` - List vendor categories

## Webhooks

- `POST /api/webhooks/buildium` - Buildium webhook handler
- `GET/PUT /api/webhooks/settings` - Get/update webhook settings

## Work Orders

- `GET/POST /api/work-orders` - List/create work orders
- `POST /api/work-orders/sync/from-buildium` - Sync work orders from Buildium
- `POST /api/work-orders/sync/to-buildium` - Sync work orders to Buildium

---

**Note:** Dynamic route parameters are shown as `{id}`, `{logId}`, `{propertyId}`, etc. Replace
these with actual IDs when making requests.

**HTTP Methods:**

- Most endpoints support GET for retrieval and POST for creation
- Many support PUT for updates and DELETE for deletion
- Check individual route files for specific method support
