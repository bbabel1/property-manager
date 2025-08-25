# Buildium API Integration

> Complete Buildium API integration for Property Management System

## Setup

### Environment Variables

```bash

BUILDIUM_CLIENT_ID=your-client-id
BUILDIUM_CLIENT_SECRET=your-client-secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
BUILDIUM_WEBHOOK_SECRET=your-webhook-secret-key
BUILDIUM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/buildium

```

## Webhooks

Buildium provides webhooks for real-time event notifications. Webhooks allow you to
receive instant updates when specific events occur in your Buildium account.

### Webhook Overview

Webhooks are HTTP callbacks that send POST requests to your specified URL when
events occur. This enables real-time integration without polling the API.

### Webhook Events

Buildium supports webhooks for various events across different entities:

#### **Accounting Events**

- Bank account changes
- Transaction updates
- Bill modifications
- Payment processing

#### **Property Management Events**

- Property updates
- Unit changes
- Owner modifications
- Tenant updates

#### **Lease Management Events**

- Lease creation/modification
- Payment processing
- Transaction updates
- Move-out notifications

#### **Maintenance Events**

- Task updates
- Work order changes
- Request modifications
- Status changes

### Webhook Setup

#### 1. Create Webhook Endpoint

Create a webhook endpoint in your application to receive Buildium
notifications:

```typescript

// Example: src/app/api/webhooks/buildium/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/webhooks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-buildium-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Process the webhook event
    switch (event.eventType) {
      case 'bank_account.updated':
        // Handle bank account update
        break;
      case 'lease.payment_received':
        // Handle payment received
        break;
      case 'task.status_changed':
        // Handle task status change
        break;
      default:
        console.log('Unhandled event type:', event.eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

```

#### 2. Configure Webhook in Buildium

Set up webhooks in your Buildium account:

1. **Access Buildium Admin Panel**

2. **Navigate to API Settings**

3. **Configure Webhook URL**: `https://yourdomain.com/api/webhooks/buildium`

4. **Select Events**: Choose which events to receive notifications for

5. **Set Security**: Configure webhook signature verification

#### 3. Webhook Security

Always verify webhook signatures to ensure requests come from Buildium:

```typescript

// Example: src/lib/webhooks.ts
import crypto from 'crypto';

export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.BUILDIUM_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

```

### Webhook Event Structure

```json

{
  "eventId": "evt_123456789",
  "eventType": "lease.payment_received",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "leaseId": 12345,
    "paymentAmount": 1500.00,
    "paymentDate": "2024-01-15",
    "tenantId": 67890
  },
  "metadata": {
    "source": "buildium",
    "version": "1.0"
  }
}

```

### Environment Variables for Webhooks

Add these to your environment configuration:

```bash

BUILDIUM_WEBHOOK_SECRET=your-webhook-secret-key
BUILDIUM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/buildium

```

### Best Practices

1. **Always verify signatures** - Never trust webhook requests without verification

2. **Handle idempotency** - Process the same event multiple times safely

3. **Respond quickly** - Return 200 status within 5 seconds

4. **Log events** - Keep records of all webhook events for debugging

5. **Handle failures gracefully** - Implement retry logic for failed processing

6. **Test thoroughly** - Use Buildium's webhook testing tools

### Webhook Testing

Buildium provides webhook testing tools in the admin panel:

1. **Send Test Event** - Trigger test webhook events

2. **View Delivery Logs** - Monitor webhook delivery status

3. **Retry Failed Events** - Manually retry failed webhook deliveries

### Common Event Types

| Event Type | Description | Data Included |
|------------|-------------|---------------|
| `bank_account.updated` | Bank account modified | Account details, changes |
| `lease.payment_received` | Payment received | Payment amount, date, tenant |
| `task.status_changed` | Task status updated | Task details, new status |
| `property.updated` | Property information changed | Property details, changes |
| `tenant.moved_in` | Tenant moved in | Tenant details, lease info |

## Bank Accounts Entity (Complete)

### Core Bank Accounts

- `GET /api/buildium/bank-accounts` - List all bank accounts
- `POST /api/buildium/bank-accounts` - Create bank account
- `GET /api/buildium/bank-accounts/{id}` - Get bank account details
- `PUT /api/buildium/bank-accounts/{id}` - Update bank account

### Checks

- `GET /api/buildium/bank-accounts/checks` - List all checks
- `POST /api/buildium/bank-accounts/checks` - Create check
- `GET /api/buildium/bank-accounts/checks/{id}` - Get check details
- `PUT /api/buildium/bank-accounts/checks/{id}` - Update check

### Deposits

- `GET /api/buildium/bank-accounts/deposits` - List all deposits
- `POST /api/buildium/bank-accounts/deposits` - Create deposit
- `GET /api/buildium/bank-accounts/deposits/{id}` - Get deposit details
- `PUT /api/buildium/bank-accounts/deposits/{id}` - Update deposit

### Withdrawals

- `GET /api/buildium/bank-accounts/withdrawals` - List all withdrawals
- `POST /api/buildium/bank-accounts/withdrawals` - Create withdrawal
- `GET /api/buildium/bank-accounts/withdrawals/{id}` - Get withdrawal details
- `PUT /api/buildium/bank-accounts/withdrawals/{id}` - Update withdrawal

### Transactions

- `GET /api/buildium/bank-accounts/transactions` - List all transactions
- `GET /api/buildium/bank-accounts/transactions/{id}` - Get transaction details

### Quick Deposits

- `GET /api/buildium/bank-accounts/quick-deposits` - List all quick deposits
- `POST /api/buildium/bank-accounts/quick-deposits` - Create quick deposit
- `GET /api/buildium/bank-accounts/quick-deposits/{id}` - Get quick deposit details
- `PUT /api/buildium/bank-accounts/quick-deposits/{id}` - Update quick deposit

### Transfers

- `GET /api/buildium/bank-accounts/transfers` - List all transfers
- `POST /api/buildium/bank-accounts/transfers` - Create transfer
- `GET /api/buildium/bank-accounts/transfers/{id}` - Get transfer details
- `PUT /api/buildium/bank-accounts/transfers/{id}` - Update transfer

### Undeposited Funds

- `GET /api/buildium/bank-accounts/undeposited-funds` - List all undeposited funds

### Reconciliations

- `GET /api/buildium/bank-accounts/reconciliations` - List all reconciliations
- `POST /api/buildium/bank-accounts/reconciliations` - Create reconciliation
- `GET /api/buildium/bank-accounts/reconciliations/{id}` - Get reconciliation details
- `PUT /api/buildium/bank-accounts/reconciliations/{id}` - Update reconciliation
- `GET /api/buildium/bank-accounts/reconciliations/{id}/balance` - Get balance
- `PUT /api/buildium/bank-accounts/reconciliations/{id}/balance` - Update balance
- `GET /api/buildium/bank-accounts/reconciliations/{id}/transactions` - Get transactions
- `POST /api/buildium/bank-accounts/reconciliations/{id}/clear-transactions` -
  Clear
- `POST /api/buildium/bank-accounts/reconciliations/{id}/finalize` - Finalize
- `POST /api/buildium/bank-accounts/reconciliations/{id}/unclear-transactions` -
  Unclear

### Check Files

- `GET /api/buildium/bank-accounts/checks/{id}/files` - List files
- `POST /api/buildium/bank-accounts/checks/files` - Upload file
- `GET /api/buildium/bank-accounts/checks/{id}/files/{fileId}` - Get
- `DELETE /api/buildium/bank-accounts/checks/{id}/files/{fileId}` - Delete
- `POST /api/buildium/bank-accounts/checks/{id}/files/{fileId}/download`

## Bills Entity (Complete)

### Core Bills

- `GET /api/buildium/bills` - List all bills
- `POST /api/buildium/bills` - Create bill
- `GET /api/buildium/bills/{id}` - Get bill details
- `PUT /api/buildium/bills/{id}` - Update bill
- `PATCH /api/buildium/bills/{id}` - Update bill (partial)

### Bill Files

- `GET /api/buildium/bills/{id}/files` - List all files for a bill
- `POST /api/buildium/bills/{id}/files` - Upload a file
- `GET /api/buildium/bills/{id}/files/{fileId}` - Get file details
- `DELETE /api/buildium/bills/{id}/files/{fileId}` - Delete file
- `POST /api/buildium/bills/{id}/files/{fileId}/download` - Download file

### Bill Payments

- `GET /api/buildium/bills/{id}/payments` - List all payments for a bill
- `POST /api/buildium/bills/{id}/payments` - Create a payment
- `GET /api/buildium/bills/{id}/payments/{paymentId}` - Get payment details
- `POST /api/buildium/bills/payments` - Create payment for multiple bills

## General Ledger Entity (Complete)

### General Ledger Entries

- `GET /api/buildium/general-ledger/entries` - List all general ledger entries
- `POST /api/buildium/general-ledger/entries` - Create general journal entry
- `GET /api/buildium/general-ledger/entries/{id}` - Get entry details
- `PUT /api/buildium/general-ledger/entries/{id}` - Update entry

### General Ledger Transactions

- `GET /api/buildium/general-ledger/transactions` - List all transactions
- `GET /api/buildium/general-ledger/transactions/{id}` - Get transaction details

### General Ledger Accounts

- `GET /api/buildium/general-ledger/accounts` - List all accounts
- `POST /api/buildium/general-ledger/accounts` - Create account
- `GET /api/buildium/general-ledger/accounts/{id}` - Get account details
- `PUT /api/buildium/general-ledger/accounts/{id}` - Update account

### General Ledger Account Balances

- `GET /api/buildium/general-ledger/accounts/balances` - List all account balances

## Rental Properties Entity (100% Complete)

### Core Properties

- `GET /api/buildium/properties` - List all properties
- `POST /api/buildium/properties` - Create property
- `GET /api/buildium/properties/{id}` - Get property details
- `PUT /api/buildium/properties/{id}` - Update property
- `POST /api/buildium/properties/{id}/inactivate` - Inactivate property
- `POST /api/buildium/properties/{id}/reactivate` - Reactivate property

### Property Settings

- `GET /api/buildium/properties/{id}/preferred-vendors` - Get preferred vendors
- `PUT /api/buildium/properties/{id}/preferred-vendors` - Update preferred
  vendors
- `GET /api/buildium/properties/{id}/amenities` - Get amenities
- `PUT /api/buildium/properties/{id}/amenities` - Update amenities
- `GET /api/buildium/properties/{id}/epay-settings` - Get ePay settings
- `PUT /api/buildium/properties/{id}/epay-settings` - Update ePay settings

### Property Images

- `GET /api/buildium/properties/{id}/images` - List all images
- `POST /api/buildium/properties/{id}/images` - Upload image
- `PUT /api/buildium/properties/{id}/images/order` - Update image order
- `GET /api/buildium/properties/{id}/images/{imageId}` - Get image details
- `PUT /api/buildium/properties/{id}/images/{imageId}` - Update image
- `DELETE /api/buildium/properties/{id}/images/{imageId}` - Delete image
- `POST /api/buildium/properties/{id}/images/{imageId}/download` - Download
  image
- `POST /api/buildium/properties/{id}/images/video` - Create image from video
  link

### Property Notes

- `GET /api/buildium/properties/{id}/notes` - List all notes
- `POST /api/buildium/properties/{id}/notes` - Create note
- `GET /api/buildium/properties/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/properties/{id}/notes/{noteId}` - Update note

## Other Entities

### Owners

- `GET /api/buildium/owners` - List all owners
- `GET /api/buildium/owners/{id}` - Get owner details

## Rental Units Entity (100% Complete)

### Core Units

- `GET /api/buildium/units` - List all units
- `POST /api/buildium/units` - Create unit
- `GET /api/buildium/units/{id}` - Get unit details
- `PUT /api/buildium/units/{id}` - Update unit

### Unit Settings

- `GET /api/buildium/units/{id}/amenities` - Get amenities
- `PUT /api/buildium/units/{id}/amenities` - Update amenities

### Unit Images

- `GET /api/buildium/units/{id}/images` - List all images
- `POST /api/buildium/units/{id}/images` - Upload image
- `PUT /api/buildium/units/{id}/images/order` - Update image order
- `GET /api/buildium/units/{id}/images/{imageId}` - Get image details
- `PUT /api/buildium/units/{id}/images/{imageId}` - Update image
- `DELETE /api/buildium/units/{id}/images/{imageId}` - Delete image
- `POST /api/buildium/units/{id}/images/{imageId}/download` - Download
  image
- `POST /api/buildium/units/{id}/images/video` - Create image from video
  link

### Unit Notes

- `GET /api/buildium/units/{id}/notes` - List all notes
- `POST /api/buildium/units/{id}/notes` - Create note
- `GET /api/buildium/units/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/units/{id}/notes/{noteId}` - Update note

## Rental Appliances Entity (100% Complete)

### Core Appliances

- `GET /api/buildium/appliances` - List all appliances
- `POST /api/buildium/appliances` - Create appliance
- `GET /api/buildium/appliances/{id}` - Get appliance details
- `PUT /api/buildium/appliances/{id}` - Update appliance
- `DELETE /api/buildium/appliances/{id}` - Delete appliance

### Service History

- `GET /api/buildium/appliances/{id}/service-history` - List all service history
- `POST /api/buildium/appliances/{id}/service-history` - Create service history
- `GET /api/buildium/appliances/{id}/service-history/{serviceHistoryId}` - Get service history details

## Rental Owners Entity (100% Complete)

### Core Owners

- `GET /api/buildium/owners` - List all owners
- `POST /api/buildium/owners` - Create owner
- `GET /api/buildium/owners/{id}` - Get owner details
- `PUT /api/buildium/owners/{id}` - Update owner

### Owner Notes

- `GET /api/buildium/owners/{id}/notes` - List all notes
- `POST /api/buildium/owners/{id}/notes` - Create note
- `GET /api/buildium/owners/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/owners/{id}/notes/{noteId}` - Update note

## Rental Tenants Entity (100% Complete)

### Core Tenants

- `GET /api/buildium/tenants` - List all tenants
- `POST /api/buildium/tenants` - Create tenant
- `GET /api/buildium/tenants/{id}` - Get tenant details
- `PUT /api/buildium/tenants/{id}` - Update tenant

### Tenant Notes

- `GET /api/buildium/tenants/{id}/notes` - List all notes
- `POST /api/buildium/tenants/{id}/notes` - Create note
- `GET /api/buildium/tenants/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/tenants/{id}/notes/{noteId}` - Update note

## Leases Entity (Phase 1-3 Complete)

### Core Leases

- `GET /api/buildium/leases` - List all leases
- `POST /api/buildium/leases` - Create lease
- `GET /api/buildium/leases/{id}` - Get lease details
- `PUT /api/buildium/leases/{id}` - Update lease

### Lease Move Outs

- `GET /api/buildium/leases/{id}/moveouts` - List all move outs
- `POST /api/buildium/leases/{id}/moveouts` - Create move out
- `GET /api/buildium/leases/{id}/moveouts/{moveOutId}` - Get move out details
- `DELETE /api/buildium/leases/{id}/moveouts/{moveOutId}` - Delete move out

### Lease Notes

- `GET /api/buildium/leases/{id}/notes` - List all notes
- `POST /api/buildium/leases/{id}/notes` - Create note
- `GET /api/buildium/leases/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/leases/{id}/notes/{noteId}` - Update note

## Lease Transactions Entity (Phase 1-3 Complete)

### Core Transactions

- `GET /api/buildium/leases/{id}/transactions` - List all lease transactions
- `GET /api/buildium/leases/{id}/transactions/{transactionId}` - Get lease transaction details

### Outstanding Balances

- `GET /api/buildium/leases/{id}/transactions/outstanding-balances` - Get all outstanding balances

### Lease Charges

- `GET /api/buildium/leases/{id}/transactions/charges` - List all charges
- `POST /api/buildium/leases/{id}/transactions/charges` - Create a charge
- `GET /api/buildium/leases/{id}/transactions/charges/{chargeId}` - Get charge details
- `PUT /api/buildium/leases/{id}/transactions/charges/{chargeId}` - Update a charge

## Tasks Entity (100% Complete)

### Core Tasks

- `GET /api/buildium/tasks` - List all tasks
- `GET /api/buildium/tasks/{id}` - Get task details

### Task History

- `GET /api/buildium/tasks/{id}/history` - List all task history
- `GET /api/buildium/tasks/{id}/history/{historyId}` - Get task history details
- `PUT /api/buildium/tasks/{id}/history/{historyId}` - Update task history

### Task History Files

- `GET /api/buildium/tasks/{id}/history/{historyId}/files` - List all task history files
- `POST /api/buildium/tasks/{id}/history/{historyId}/files` - Upload a task history file
- `GET /api/buildium/tasks/{id}/history/{historyId}/files/{fileId}` - Get task history file details
- `DELETE /api/buildium/tasks/{id}/history/{historyId}/files/{fileId}` - Delete task history file
- `POST /api/buildium/tasks/{id}/history/{historyId}/files/{fileId}/download` - Download a task history file

### Task Categories

- `GET /api/buildium/tasks/categories` - List all task categories
- `POST /api/buildium/tasks/categories` - Create a task category
- `GET /api/buildium/tasks/categories/{categoryId}` - Get task category details
- `PUT /api/buildium/tasks/categories/{categoryId}` - Update a task category

## Rental Owner Requests Entity (100% Complete)

### Core Owner Requests

- `GET /api/buildium/owner-requests` - List all rental owner requests
- `POST /api/buildium/owner-requests` - Create a rental owner request
- `GET /api/buildium/owner-requests/{id}` - Get rental owner request details
- `PUT /api/buildium/owner-requests/{id}` - Update a rental owner request

### Owner Contribution Requests

- `GET /api/buildium/owner-requests/{id}/contribution` - Get rental owner contribution request details
- `PUT /api/buildium/owner-requests/{id}/contribution` - Update a rental owner contribution request

## Resident Requests Entity (100% Complete)

### Core Resident Requests

- `GET /api/buildium/resident-requests` - List all resident requests
- `POST /api/buildium/resident-requests` - Create a resident request
- `GET /api/buildium/resident-requests/{id}` - Get resident request details
- `PUT /api/buildium/resident-requests/{id}` - Update a resident request

## To Do Requests Entity (100% Complete)

### Core To Do Requests

- `GET /api/buildium/todo-requests` - List all to-do requests
- `POST /api/buildium/todo-requests` - Create a to-do request
- `GET /api/buildium/todo-requests/{id}` - Get to-do request details
- `PUT /api/buildium/todo-requests/{id}` - Update a to-do request

## Work Orders Entity (100% Complete)

### Core Work Orders

- `GET /api/buildium/work-orders` - List all work orders
- `POST /api/buildium/work-orders` - Create a work order
- `GET /api/buildium/work-orders/{id}` - Get work order details
- `PUT /api/buildium/work-orders/{id}` - Update a work order

## Vendors Entity (100% Complete)

### Core Vendors

- `GET /api/buildium/vendors` - List all vendors
- `POST /api/buildium/vendors` - Create a vendor
- `GET /api/buildium/vendors/{id}` - Get vendor details
- `PUT /api/buildium/vendors/{id}` - Update a vendor

### Vendor Credits

- `POST /api/buildium/vendors/{id}/credits` - Create a credit
- `GET /api/buildium/vendors/{id}/credits/{creditId}` - Get credit details

### Vendor Notes

- `GET /api/buildium/vendors/{id}/notes` - List all notes
- `POST /api/buildium/vendors/{id}/notes` - Create a note
- `GET /api/buildium/vendors/{id}/notes/{noteId}` - Get note details
- `PUT /api/buildium/vendors/{id}/notes/{noteId}` - Update a note

### Vendor Refunds

- `POST /api/buildium/vendors/{id}/refunds` - Create a refund
- `GET /api/buildium/vendors/{id}/refunds/{refundId}` - Get refund details

### Vendor Transactions

- `GET /api/buildium/vendors/{id}/transactions` - List all transactions

### Vendor Categories

- `GET /api/buildium/vendor-categories` - List all vendor categories
- `POST /api/buildium/vendor-categories` - Create a vendor category
- `GET /api/buildium/vendor-categories/{id}` - Get vendor category details
- `PUT /api/buildium/vendor-categories/{id}` - Update a vendor category

## Files Entity (100% Complete)

### Core Files

- `GET /api/buildium/files` - List all files
- `POST /api/buildium/files` - Upload a file
- `GET /api/buildium/files/{id}` - Get file details
- `PUT /api/buildium/files/{id}` - Update a file
- `POST /api/buildium/files/{id}/download` - Download a file

### File Share Settings

- `GET /api/buildium/files/{id}/sharesettings` - Get file share settings
- `PUT /api/buildium/files/{id}/sharesettings` - Update file share settings

### File Categories

- `GET /api/buildium/file-categories` - List all file categories
- `POST /api/buildium/file-categories` - Create a file category
- `GET /api/buildium/file-categories/{id}` - Get file category details
- `PUT /api/buildium/file-categories/{id}` - Update a file category

## Administration Entity (100% Complete)

### User Management

- `GET /api/buildium/users` - List all users
- `GET /api/buildium/users/{id}` - Get user details

### User Roles Management

- `GET /api/buildium/user-roles` - List all user roles
- `GET /api/buildium/user-roles/{id}` - Get user role details

### Account Information

- `GET /api/buildium/account-info` - Get account information

### Accounting Lock Periods

- `GET /api/buildium/accounting-lock-periods` - Get accounting lock periods

### Partial Payment Settings

- `GET /api/buildium/partial-payment-settings` - Get partial payment settings for residents
- `PATCH /api/buildium/partial-payment-settings` - Update partial payment settings for residents

## Additional Entities

### Leases

- `GET /api/buildium/leases` - List all leases

## Request Body Examples

### Create Bank Account

```json

{
  "Name": "Operating Account",
  "BankAccountType": "Checking",
  "AccountNumber": "1234567890",
  "RoutingNumber": "021000021",
  "Description": "Main operating account",
  "IsActive": true
}

```

### Create Check

```json

{
  "BankAccountId": 10407,
  "Amount": 1500.00,
  "PayeeName": "ABC Services",
  "Memo": "Monthly maintenance",
  "CheckNumber": "1001",
  "Date": "2024-01-15T00:00:00Z"
}

```

### Create Deposit

```json

{
  "BankAccountId": 10407,
  "Amount": 2500.00,
  "Description": "Rent payment deposit",
  "Date": "2024-01-15T00:00:00Z"
}

```

### Create Withdrawal

```json

{
  "BankAccountId": 10407,
  "Amount": 1000.00,
  "Description": "Utility payment withdrawal",
  "Date": "2024-01-15T00:00:00Z"
}

```

### Create Bill

```json

{
  "VendorId": 12345,
  "PropertyId": 67890,
  "Date": "2024-01-15T00:00:00Z",
  "DueDate": "2024-02-15T00:00:00Z",
  "Amount": 500.00,
  "Description": "Monthly maintenance bill",
  "ReferenceNumber": "INV-2024-001",
  "CategoryId": 1,
  "IsRecurring": false
}

```

### Create Bill Payment

```json

{
  "BankAccountId": 10407,
  "Amount": 500.00,
  "Date": "2024-01-20T00:00:00Z",
  "ReferenceNumber": "PAY-2024-001",
  "Memo": "Payment for maintenance bill"
}

```

### Create Bulk Bill Payment

```json

{
  "BankAccountId": 10407,
  "Bills": [
    {
      "BillId": 123,
      "Amount": 500.00
    },
    {
      "BillId": 124,
      "Amount": 300.00
    }
  ],
  "Date": "2024-01-20T00:00:00Z",
  "ReferenceNumber": "BULK-PAY-2024-001",
  "Memo": "Bulk payment for multiple bills"
}

```

### Create General Ledger Entry

```json

{
  "Date": "2024-01-15T00:00:00Z",
  "ReferenceNumber": "JE-2024-001",
  "Memo": "Monthly rent adjustment",
  "Lines": [
    {
      "AccountId": 1001,
      "Amount": 5000.00,
      "Memo": "Rent income"
    },
    {
      "AccountId": 2001,
      "Amount": -5000.00,
      "Memo": "Accounts receivable"
    }
  ]
}

```

### Create General Ledger Account

```json

{
  "Name": "Rent Income",
  "AccountType": "Revenue",
  "AccountNumber": "4000",
  "Description": "Income from rental properties",
  "IsActive": true
}

```

### Create Property

```json

{
  "Name": "Sunset Apartments",
  "Address": {
    "AddressLine1": "123 Main Street",
    "AddressLine2": "Suite 100",
    "City": "Los Angeles",
    "State": "CA",
    "PostalCode": "90210",
    "Country": "United States"
  },
  "PropertyType": "MultiFamilyTwoToFourUnits",
  "YearBuilt": 1995,
  "SquareFootage": 2500,
  "Bedrooms": 3,
  "Bathrooms": 2.5,
  "Description": "Modern apartment complex",
  "IsActive": true
}

```

### Update Property Preferred Vendors

```json

{
  "VendorIds": [123, 456, 789]
}

```

### Update Property Amenities

```json

{
  "AmenityIds": [1, 2, 3, 4]
}

```

### Update Property EPay Settings

```json

{
  "IsEnabled": true,
  "AllowPartialPayments": true,
  "MinimumPaymentAmount": 100.00,
  "PaymentMethods": ["CreditCard", "DebitCard", "ACH"]
}

```

### Upload Property Image

```json

{
  "FileName": "property-front-view.jpg",
  "FileData": "base64-encoded-image-data",
  "Description": "Front view of the property"
}

```

### Update Property Image Order

```json

{
  "ImageIds": [1, 3, 2, 4]
}

```

### Create Property Image from Video

```json

{
  "VideoUrl": "https://example.com/video.mp4",
  "Description": "Property walkthrough video"
}

```

### Create Property Note

```json

{
  "Subject": "Maintenance Update",
  "Body": "HVAC system serviced and filters replaced",
  "IsPrivate": false
}

```

### Update Property Note

```json

{
  "Subject": "Updated Maintenance Record",
  "Body": "HVAC system serviced, filters replaced, and thermostat calibrated",
  "IsPrivate": true
}

```

### Create Unit

```json

{
  "PropertyId": 12345,
  "UnitNumber": "A101",
  "UnitType": "Apartment",
  "Bedrooms": 2,
  "Bathrooms": 1.5,
  "SquareFootage": 1200,
  "MarketRent": 1800.00,
  "Description": "Spacious 2-bedroom apartment",
  "IsActive": true
}

```

### Update Unit Amenities

```json

{
  "AmenityIds": [1, 2, 3, 4]
}

```

### Upload Unit Image

```json

{
  "FileName": "unit-living-room.jpg",
  "FileData": "base64-encoded-image-data",
  "Description": "Living room view of the unit"
}

```

### Update Unit Image Order

```json

{
  "ImageIds": [1, 3, 2, 4]
}

```

### Create Unit Image from Video

```json

{
  "VideoUrl": "https://example.com/unit-walkthrough.mp4",
  "Description": "Unit walkthrough video"
}

```

### Create Unit Note

```json

{
  "Subject": "Maintenance Request",
  "Body": "Kitchen faucet needs repair",
  "IsPrivate": false
}

```

### Update Unit Note

```json

{
  "Subject": "Updated Maintenance Request",
  "Body": "Kitchen faucet repaired and tested",
  "IsPrivate": true
}

```

### Create Appliance

```json

{
  "PropertyId": 12345,
  "UnitId": 67890,
  "ApplianceType": "Refrigerator",
  "Brand": "Samsung",
  "Model": "RF28T5001SR",
  "SerialNumber": "SN123456789",
  "InstallationDate": "2024-01-15T00:00:00Z",
  "WarrantyExpirationDate": "2027-01-15T00:00:00Z",
  "Description": "French door refrigerator",
  "IsActive": true
}

```

### Update Appliance

```json

{
  "ApplianceType": "Dishwasher",
  "Brand": "Bosch",
  "Model": "SHEM63W55N",
  "SerialNumber": "SN987654321",
  "InstallationDate": "2024-02-01T00:00:00Z",
  "WarrantyExpirationDate": "2027-02-01T00:00:00Z",
  "Description": "Quiet dishwasher",
  "IsActive": true
}

```

### Create Service History

```json

{
  "ServiceDate": "2024-03-15T00:00:00Z",
  "ServiceType": "Maintenance",
  "Description": "Annual maintenance check",
  "Cost": 150.00,
  "VendorId": 12345,
  "Notes": "All systems functioning"
}

```

### Create Owner

```json

{
  "FirstName": "John",
  "LastName": "Smith",
  "Email": "john.smith@example.com",
  "PhoneNumber": "(555) 123-4567",
  "Address": {
    "AddressLine1": "123 Main Street",
    "AddressLine2": "Suite 100",
    "City": "New York",
    "State": "NY",
    "PostalCode": "10001",
    "Country": "United States"
  },
  "TaxId": "12-3456789",
  "IsActive": true
}

```

### Update Owner

```json

{
  "FirstName": "John",
  "LastName": "Smith",
  "Email": "john.smith.updated@example.com",
  "PhoneNumber": "(555) 987-6543",
  "Address": {
    "AddressLine1": "456 Oak Avenue",
    "AddressLine2": "Apt 2B",
    "City": "Los Angeles",
    "State": "CA",
    "PostalCode": "90210",
    "Country": "United States"
  },
  "TaxId": "98-7654321",
  "IsActive": true
}

```

### Create Owner Note

```json

{
  "Subject": "Property Discussion",
  "Body": "Discussed property maintenance and rental rates",
  "IsPrivate": false
}

```

### Update Owner Note

```json

{
  "Subject": "Updated Property Discussion",
  "Body": "Updated discussion notes with new schedule",
  "IsPrivate": true
}

```

### Create Tenant

```json

{
  "FirstName": "Jane",
  "LastName": "Doe",
  "Email": "jane.doe@example.com",
  "PhoneNumber": "(555) 123-4567",
  "Address": {
    "AddressLine1": "123 Main Street",
    "AddressLine2": "Apt 4B",
    "City": "New York",
    "State": "NY",
    "PostalCode": "10001",
    "Country": "United States"
  },
  "DateOfBirth": "1990-05-15T00:00:00Z",
  "SocialSecurityNumber": "123-45-6789",
  "EmergencyContact": {
    "Name": "John Doe",
    "PhoneNumber": "(555) 987-6543",
    "Relationship": "Spouse"
  },
  "IsActive": true
}

```

### Update Tenant

```json

{
  "FirstName": "Jane",
  "LastName": "Smith",
  "Email": "jane.smith@example.com",
  "PhoneNumber": "(555) 987-6543",
  "Address": {
    "AddressLine1": "456 Oak Avenue",
    "AddressLine2": "Unit 2C",
    "City": "Los Angeles",
    "State": "CA",
    "PostalCode": "90210",
    "Country": "United States"
  },
  "DateOfBirth": "1990-05-15T00:00:00Z",
  "SocialSecurityNumber": "987-65-4321",
  "EmergencyContact": {
    "Name": "John Smith",
    "PhoneNumber": "(555) 123-4567",
    "Relationship": "Spouse"
  },
  "IsActive": true
}

```

### Create Tenant Note

```json

{
  "Subject": "Maintenance Request",
  "Body": "Tenant reported leaky faucet in kitchen",
  "IsPrivate": false
}

```

### Update Tenant Note

```json

{
  "Subject": "Updated Maintenance Request",
  "Body": "Leaky faucet has been repaired",
  "IsPrivate": true
}

```

### Create Lease

```json

{
  "PropertyId": 12345,
  "UnitId": 67890,
  "TenantId": 11111,
  "StartDate": "2024-01-01T00:00:00Z",
  "EndDate": "2024-12-31T23:59:59Z",
  "RentAmount": 1500.00,
  "SecurityDepositAmount": 1500.00,
  "PetDepositAmount": 300.00,
  "LeaseType": "FixedTerm",
  "IsActive": true,
  "Notes": "Standard one-year lease agreement"
}

```

### Update Lease

```json

{
  "PropertyId": 12345,
  "UnitId": 67890,
  "TenantId": 11111,
  "StartDate": "2024-01-01T00:00:00Z",
  "EndDate": "2025-01-31T23:59:59Z",
  "RentAmount": 1600.00,
  "SecurityDepositAmount": 1600.00,
  "PetDepositAmount": 300.00,
  "LeaseType": "FixedTerm",
  "IsActive": true,
  "Notes": "Updated lease with rent increase"
}

```

### Create Lease Move Out

```json

{
  "MoveOutDate": "2024-12-31T23:59:59Z",
  "Reason": "Lease expiration",
  "Notes": "Tenant completed lease term successfully"
}

```

### Create Lease Note

```json

{
  "Subject": "Maintenance Request",
  "Body": "Tenant reported HVAC issue in unit",
  "IsPrivate": false
}

```

### Update Lease Note

```json

{
  "Subject": "Updated Maintenance Request",
  "Body": "HVAC issue has been resolved",
  "IsPrivate": true
}

```

### Create Lease Charge

```json

{
  "Amount": 1500.00,
  "Date": "2024-01-01T00:00:00Z",
  "Description": "Monthly rent payment",
  "ChargeType": "Rent",
  "IsRecurring": true,
  "RecurringFrequency": "Monthly",
  "Notes": "Standard monthly rent charge"
}

```

### Update Lease Charge

```json

{
  "Amount": 1600.00,
  "Date": "2024-01-01T00:00:00Z",
  "Description": "Updated monthly rent payment",
  "ChargeType": "Rent",
  "IsRecurring": true,
  "RecurringFrequency": "Monthly",
  "Notes": "Updated rent amount due to lease renewal"
}

```

### Update Task History

```json

{
  "Status": "Completed",
  "Notes": "Task completed successfully",
  "CompletedDate": "2024-01-15T10:30:00Z",
  "AssignedTo": "John Doe"
}

```

### Upload Task History File

```json

{
  "FileName": "maintenance_report.pdf",
  "FileContent": "base64_encoded_file_content",
  "ContentType": "application/pdf"
}

```

### Create Task Category

```json

{
  "Name": "Plumbing",
  "Description": "All plumbing related maintenance tasks",
  "Color": "#FF5733"

}

```

### Update Task Category

```json

{
  "Name": "Plumbing Maintenance",
  "Description": "Updated description for plumbing tasks",
  "Color": "#FF5733"

}

```

### Create Owner Request

```json

{
  "OwnerId": 12345,
  "PropertyId": 67890,
  "Subject": "Kitchen sink repair needed",
  "Description": "The kitchen sink is leaking and needs immediate repair",
  "Priority": "High",
  "RequestType": "Maintenance",
  "EstimatedCost": 250.00,
  "RequestedDate": "2024-01-15T10:30:00Z"
}

```

### Update Owner Request

```json

{
  "Subject": "Updated kitchen sink repair request",
  "Description": "Kitchen sink repair with additional details",
  "Priority": "Urgent",
  "RequestType": "Maintenance",
  "Status": "InProgress",
  "EstimatedCost": 300.00,
  "CompletedDate": "2024-01-20T15:45:00Z"
}

```

### Update Owner Contribution Request

```json

{
  "ContributionAmount": 150.00,
  "ContributionPercentage": 50,
  "Notes": "Owner agrees to contribute 50% of the repair cost",
  "Status": "Approved"
}

```

### Create Resident Request

```json

{
  "TenantId": 12345,
  "PropertyId": 67890,
  "UnitId": 11111,
  "Subject": "Heating system not working",
  "Description": "The heating system stopped working this morning.",
  "Priority": "High",
  "RequestType": "Maintenance",
  "EstimatedCost": 200.00,
  "RequestedDate": "2024-01-15T08:00:00Z"
}

```

### Update Resident Request

```json

{
  "Subject": "Updated heating system repair request",
  "Description": "Heating system repair with additional details",
  "Priority": "Urgent",
  "RequestType": "Maintenance",
  "Status": "InProgress",
  "EstimatedCost": 250.00,
  "CompletedDate": "2024-01-16T14:30:00Z"
}

```

### Create To Do Request

```json

{
  "Subject": "Review monthly financial reports",
  "Description": "Review and analyze monthly financial reports",
  "Priority": "High",
  "AssignedTo": "John Smith",
  "DueDate": "2024-01-20T17:00:00Z",
  "Category": "Financial Review",
  "Notes": "Focus on revenue trends and expense analysis"
}

```

### Update To Do Request

```json

{
  "Subject": "Updated monthly financial review",
  "Description": "Review and analyze monthly financial reports with cash flow focus",
  "Priority": "Urgent",
  "Status": "InProgress",
  "AssignedTo": "John Smith",
  "DueDate": "2024-01-22T17:00:00Z",
  "Category": "Financial Review",
  "Notes": "Include cash flow analysis and budget variance",
  "CompletedDate": "2024-01-21T16:30:00Z"
}

```

### Create Work Order

```json

{
  "PropertyId": 12345,
  "UnitId": 67890,
  "Subject": "HVAC system repair",
  "Description": "The HVAC system is not cooling properly",
  "Priority": "High",
  "AssignedTo": "Maintenance Team",
  "EstimatedCost": 500.00,
  "ScheduledDate": "2024-01-25T09:00:00Z",
  "Category": "HVAC Maintenance",
  "Notes": "Tenant reported issue with cooling system"
}

```

### Update Work Order

```json

{
  "Subject": "Updated HVAC system repair",
  "Description": "HVAC system repair with diagnostic work",
  "Priority": "Urgent",
  "Status": "InProgress",
  "AssignedTo": "Maintenance Team",
  "EstimatedCost": 600.00,
  "ActualCost": 550.00,
  "ScheduledDate": "2024-01-26T09:00:00Z",
  "Category": "HVAC Maintenance",
  "Notes": "Additional diagnostic work required",
  "CompletedDate": "2024-01-27T16:00:00Z"
}

```

### Create Vendor

```json

{
  "Name": "ABC Plumbing Services",
  "CategoryId": 12345,
  "ContactName": "John Smith",
  "Email": "john.smith@abcplumbing.com",
  "PhoneNumber": "(555) 123-4567",
  "Address": {
    "AddressLine1": "123 Main Street",
    "AddressLine2": "Suite 100",
    "City": "Anytown",
    "State": "CA",
    "PostalCode": "90210",
    "Country": "USA"
  },
  "TaxId": "12-3456789",
  "Notes": "Reliable plumbing contractor for emergency repairs",
  "IsActive": true
}

```

### Update Vendor

```json

{
  "Name": "ABC Plumbing & HVAC Services",
  "CategoryId": 12346,
  "ContactName": "John Smith",
  "Email": "john.smith@abcplumbing.com",
  "PhoneNumber": "(555) 123-4567",
  "Address": {
    "AddressLine1": "123 Main Street",
    "AddressLine2": "Suite 200",
    "City": "Anytown",
    "State": "CA",
    "PostalCode": "90210",
    "Country": "USA"
  },
  "TaxId": "12-3456789",
  "Notes": "Reliable plumbing and HVAC contractor for emergency repairs",
  "IsActive": true
}

```

### Create Vendor Credit

```json

{
  "Amount": 150.00,
  "Date": "2024-01-15T10:00:00Z",
  "Description": "Credit for overpayment on invoice #12345",

  "ReferenceNumber": "CR-2024-001",
  "Notes": "Customer requested credit for overpayment"
}

```

### Create Vendor Note

```json

{
  "Subject": "Contract Renewal Discussion",
  "Note": "Discussed contract renewal terms for 2024. Vendor requested 5% increase in rates.",
  "IsPrivate": false
}

```

### Update Vendor Note

```json

{
  "Subject": "Updated Contract Renewal Discussion",
"Note": "Discussed contract renewal terms for 2024. Vendor requested 5% increase in rates. Negotiated to 3%
increase.",
  "IsPrivate": false
}

```

### Create Vendor Refund

```json

{
  "Amount": 250.00,
  "Date": "2024-01-20T14:30:00Z",
  "Description": "Refund for cancelled service appointment",
  "ReferenceNumber": "REF-2024-001",
  "Notes": "Customer cancelled appointment with 24-hour notice"
}

```

### Create Vendor Category

```json

{
  "Name": "Plumbing Services",
  "Description": "Vendors providing plumbing repair and maintenance services",
  "IsActive": true
}

```

### Update Vendor Category

```json

{
  "Name": "Plumbing & HVAC Services",
  "Description": "Vendors providing plumbing and HVAC repair and maintenance services",
  "IsActive": true
}

```

### Upload File

```json

{
  "Name": "Property_Photo_001.jpg",
  "CategoryId": 12345,
  "Description": "Front view of the property",
  "FileData": "base64_encoded_file_data_here",
  "FileType": "image/jpeg",
  "IsPrivate": false
}

```

### Update File

```json

{
  "Name": "Updated_Property_Photo_001.jpg",
  "CategoryId": 12346,
  "Description": "Updated front view of the property",
  "IsPrivate": true
}

```

### Update File Share Settings

```json

{
  "IsPublic": true,
  "AllowDownload": true,
  "AllowView": true,
  "ExpirationDate": "2024-12-31T23:59:59Z"
}

```

### Create File Category

```json

{
  "Name": "Property Photos",
  "Description": "Category for all property-related photos",
  "IsActive": true
}

```

### Update File Category

```json

{
  "Name": "Property Documents & Photos",
  "Description": "Category for all property-related documents and photos",
  "IsActive": true
}

```

### Update Partial Payment Settings

```json

{
  "AllowPartialPayments": true,
  "MinimumPaymentAmount": 50.00,
  "PartialPaymentFee": 5.00,
  "PartialPaymentFeeType": "Fixed",
  "ApplyFeeToAllPartialPayments": true
}

```

## Response Format

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
  "error": "Error message",
  "details": "Additional error details"
}

```

## Implementation Status

- ✅ **Bank Accounts Entity**: 100% Complete (45 endpoints)

- ✅ **Bills Entity**: 100% Complete (15 endpoints)

- ✅ **General Ledger Entity**: 100% Complete (10 endpoints)

- ✅ **Rental Properties Entity**: 100% Complete (24 endpoints)

- ✅ **Rental Owners Entity**: 100% Complete (8 endpoints)

- ✅ **Rental Tenants Entity**: 100% Complete (8 endpoints)

- ✅ **Rental Units Entity**: 100% Complete (18 endpoints)

- ✅ **Rental Appliances Entity**: 100% Complete (8 endpoints)

- 🔄 **Leases Entity**: Phase 1-3 Complete (12 endpoints)

- 🔄 **Lease Transactions Entity**: Phase 1-3 Complete (8 endpoints)

- ✅ **Tasks Entity**: 100% Complete (15 endpoints)

- ✅ **Rental Owner Requests Entity**: 100% Complete (6 endpoints)

- ✅ **Resident Requests Entity**: 100% Complete (4 endpoints)

- ✅ **To Do Requests Entity**: 100% Complete (4 endpoints)

- ✅ **Work Orders Entity**: 100% Complete (4 endpoints)

- ✅ **Vendors Entity**: 100% Complete (17 endpoints)

- ✅ **Files Entity**: 100% Complete (12 endpoints)

- ✅ **Administration Entity**: 100% Complete (8 endpoints)

## File Structure

```text

src/app/api/buildium/
├── bank-accounts/          # Complete implementation

│   ├── route.ts
│   ├── [id]/route.ts
│   ├── checks/
│   ├── deposits/
│   ├── withdrawals/
│   ├── transactions/
│   ├── quick-deposits/
│   ├── transfers/
│   ├── undeposited-funds/
│   ├── reconciliations/
│   └── checks/[id]/files/
├── bills/                  # Complete implementation

│   ├── route.ts
│   ├── [id]/route.ts
│   ├── files/
│   ├── payments/
│   └── payments/route.ts
├── general-ledger/         # Complete implementation

│   ├── entries/
│   ├── transactions/
│   └── accounts/
├── properties/             # Basic implementation

├── owners/                 # Basic implementation

├── units/                  # Basic implementation

├── leases/                 # Basic implementation

├── tasks/                  # Complete implementation

├── owner-requests/         # Complete implementation

│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/contribution/route.ts
├── resident-requests/      # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── todo-requests/         # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── work-orders/          # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── vendors/              # Complete implementation

│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/credits/route.ts
│   ├── [id]/credits/[creditId]/route.ts
│   ├── [id]/notes/route.ts
│   ├── [id]/notes/[noteId]/route.ts
│   ├── [id]/refunds/route.ts
│   ├── [id]/refunds/[refundId]/route.ts
│   └── [id]/transactions/route.ts
├── vendor-categories/    # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── files/               # Complete implementation

│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/sharesettings/route.ts
├── file-categories/     # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── users/              # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── user-roles/         # Complete implementation

│   ├── route.ts
│   └── [id]/route.ts
├── account-info/       # Complete implementation

│   └── route.ts
├── accounting-lock-periods/  # Complete implementation

│   └── route.ts
└── partial-payment-settings/ # Complete implementation

    └── route.ts
    ├── route.ts
    ├── [id]/route.ts
    ├── [id]/history/
    │   ├── route.ts
    │   └── [historyId]/
    │       ├── route.ts
    │       └── files/
    │           ├── route.ts
    │           └── [fileId]/route.ts
    └── categories/
        ├── route.ts
        └── [categoryId]/route.ts

```
