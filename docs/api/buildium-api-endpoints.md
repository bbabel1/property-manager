# Buildium API Endpoints Reference

> Generated on: 2025-01-15
>
> This document provides a comprehensive reference for all Buildium API endpoints implemented in the Property Management
System.

## Overview

The Buildium API integration provides full CRUD operations for all major entities in the property management system.
Each endpoint follows RESTful conventions and includes proper error handling, authentication, and data validation.

## Authentication

All endpoints require Buildium OAuth 2.0 authentication using client credentials flow.

```typescript

// Authentication headers
Authorization: Bearer <access_token>
Content-Type: application/json

```

## Endpoint Categories

### 🏠 **Properties** (`/api/buildium/properties`)

Properties are the central entities in the system, representing real estate assets.

#### List Properties

```http

GET /api/buildium/properties

```

**Purpose**: Retrieve all properties from Buildium

**Parameters**:

- `limit` (optional): Number of records to return (default: 50, max: 1000)
- `offset` (optional): Number of records to skip
- `orderby` (optional): Sort order (e.g., "Name ASC")
- `lastupdatedfrom` (optional): Filter by last update date
- `lastupdatedto` (optional): Filter by last update date

**Response**:

```json

{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "Sample Property",
      "address": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345",
      "buildium_property_id": 456,
      "last_synced_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}

```

#### Get Property by ID

```http

GET /api/buildium/properties/{id}

```

**Purpose**: Retrieve a specific property by its Buildium ID

**Parameters**:

- `id` (path): Buildium property ID

**Response**:

```json

{
  "success": true,
  "data": {
    "id": 123,
    "name": "Sample Property",
    "address": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345",
    "buildium_property_id": 456,
    "last_synced_at": "2025-01-15T10:00:00Z"
  }
}

```

#### Create Property

```http

POST /api/buildium/properties

```

**Purpose**: Create a new property in Buildium

**Request Body**:

```json

{
  "name": "New Property",
  "address": "456 Oak Ave",
  "city": "Somewhere",
  "state": "CA",
  "postalCode": "54321",
  "propertyType": "Residential",
  "yearBuilt": 2020
}

```

**Response**:

```json

{
  "success": true,
  "data": {
    "id": 789,
    "buildium_property_id": 101112,
    "name": "New Property",
    "address": "456 Oak Ave",
    "city": "Somewhere",
    "state": "CA",
    "postalCode": "54321"
  }
}

```

#### Update Property

```http

PUT /api/buildium/properties/{id}

```

**Purpose**: Update an existing property in Buildium

**Parameters**:

- `id` (path): Buildium property ID

**Request Body**:

```json

{
  "name": "Updated Property Name",
  "address": "456 Oak Ave",
  "city": "Somewhere",
  "state": "CA",
  "postalCode": "54321"
}

```

#### Property-Specific Endpoints

##### Property Notes

```http

GET /api/buildium/properties/{id}/notes
POST /api/buildium/properties/{id}/notes
GET /api/buildium/properties/{id}/notes/{noteId}
PUT /api/buildium/properties/{id}/notes/{noteId}

```

##### Property Images

```http

GET /api/buildium/properties/{id}/images
POST /api/buildium/properties/{id}/images
DELETE /api/buildium/properties/{id}/images/{imageId}

```

##### Property Amenities

```http

GET /api/buildium/properties/{id}/amenities
POST /api/buildium/properties/{id}/amenities
DELETE /api/buildium/properties/{id}/amenities/{amenityId}

```

##### Property EPay Settings

```http

GET /api/buildium/properties/{id}/epay-settings
PUT /api/buildium/properties/{id}/epay-settings

```

##### Property Preferred Vendors

```http

GET /api/buildium/properties/{id}/preferred-vendors
PUT /api/buildium/properties/{id}/preferred-vendors

```

### 🏢 **Units** (`/api/buildium/units`)

Units represent individual spaces within properties.

#### List Units

```http

GET /api/buildium/units

```

**Parameters**:

- `propertyId` (optional): Filter by property ID
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Unit by ID

```http

GET /api/buildium/units/{id}

```

#### Create Unit

```http

POST /api/buildium/units

```

**Request Body**:

```json

{
  "propertyId": 123,
  "unitNumber": "A101",
  "bedrooms": 2,
  "bathrooms": 1,
  "squareFootage": 1000
}

```

#### Update Unit

```http

PUT /api/buildium/units/{id}

```

#### Unit-Specific Endpoints

##### Unit Notes

```http

GET /api/buildium/units/{id}/notes
POST /api/buildium/units/{id}/notes

```

##### Unit Images

```http

GET /api/buildium/units/{id}/images
POST /api/buildium/units/{id}/images

```

##### Unit Amenities

```http

GET /api/buildium/units/{id}/amenities
POST /api/buildium/units/{id}/amenities

```

### 👥 **Owners** (`/api/buildium/owners`)

Owners represent individuals or entities that own properties.

#### List Owners

```http

GET /api/buildium/owners

```

**Parameters**:

- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip
- `email` (optional): Filter by email address
- `name` (optional): Filter by name

#### Get Owner by ID

```http

GET /api/buildium/owners/{id}

```

#### Create Owner

```http

POST /api/buildium/owners

```

**Request Body**:

```json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "(555) 123-4567",
  "address": {
    "addressLine1": "123 Owner St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345"
  }
}

```

#### Update Owner

```http

PUT /api/buildium/owners/{id}

```

#### Owner-Specific Endpoints

##### Owner Notes

```http

GET /api/buildium/owners/{id}/notes
POST /api/buildium/owners/{id}/notes

```

##### Owner Properties

```http

GET /api/buildium/owners/{id}/properties

```

### 📋 **Leases** (`/api/buildium/leases`)

Leases represent rental agreements between property owners and tenants.

#### List Leases

```http

GET /api/buildium/leases

```

**Parameters**:

- `propertyId` (optional): Filter by property ID
- `unitId` (optional): Filter by unit ID
- `status` (optional): Filter by lease status
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Lease by ID

```http

GET /api/buildium/leases/{id}

```

#### Create Lease

```http

POST /api/buildium/leases

```

**Request Body**:

```json

{
  "propertyId": 123,
  "unitId": 456,
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 2000,
  "securityDeposit": 2000,
  "tenantId": 789
}

```

#### Update Lease

```http

PUT /api/buildium/leases/{id}

```

#### Lease-Specific Endpoints

##### Lease Notes

```http

GET /api/buildium/leases/{id}/notes
POST /api/buildium/leases/{id}/notes

```

##### Lease Transactions

```http

GET /api/buildium/leases/{id}/transactions
POST /api/buildium/leases/{id}/transactions
POST /api/buildium/leases/{id}/payments
GET /api/buildium/leases/{id}/transactions/{transactionId}
PUT /api/buildium/leases/{id}/transactions/{transactionId}

```

##### Lease Moveouts

```http

GET /api/buildium/leases/{id}/moveouts
POST /api/buildium/leases/{id}/moveouts
GET /api/buildium/leases/{id}/moveouts/{moveOutId}

```

### 💰 **Lease Transactions** (`/api/buildium/leases/{leaseId}/transactions`)

Lease transactions track all financial activity related to leases.

#### List Transactions

```http

GET /api/buildium/leases/{leaseId}/transactions

```

**Parameters**:

- `type` (optional): Filter by transaction type (payment, charge, refund)
- `dateFrom` (optional): Filter by start date
- `dateTo` (optional): Filter by end date
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Transaction by ID

```http

GET /api/buildium/leases/{leaseId}/transactions/{transactionId}

```

#### Create Transaction

```http

POST /api/buildium/leases/{leaseId}/transactions

```

#### Create Payment

```http

POST /api/buildium/leases/{leaseId}/payments

```

**Request Body**:

```json

{
  "type": "payment",
  "amount": 2000,
  "date": "2025-01-15",
  "memo": "January rent payment",
  "paymentMethod": "ElectronicPayment"
}

```

#### Update Transaction

```http

PUT /api/buildium/leases/{leaseId}/transactions/{transactionId}

```

### 🏦 **Bank Accounts** (`/api/buildium/bank-accounts`)

Bank accounts are used for financial management and rent collection.

#### List Bank Accounts

```http

GET /api/buildium/bank-accounts

```

**Parameters**:

- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Bank Account by ID

```http

GET /api/buildium/bank-accounts/{id}

```

#### Create Bank Account

```http

POST /api/buildium/bank-accounts

```

**Request Body**:

```json

{
  "name": "Main Operating Account",
  "accountNumber": "1234567890",
  "routingNumber": "021000021",
  "accountType": "Checking",
  "bankName": "Sample Bank"
}

```

#### Update Bank Account

```http

PUT /api/buildium/bank-accounts/{id}

```

#### Bank Account-Specific Endpoints

##### Bank Account Transactions

```http

GET /api/buildium/bank-accounts/{id}/transactions
GET /api/buildium/bank-accounts/{id}/transactions/{transactionId}

```

##### Bank Account Checks

```http

GET /api/buildium/bank-accounts/{id}/checks
POST /api/buildium/bank-accounts/{id}/checks
GET /api/buildium/bank-accounts/{id}/checks/{checkId}

```

##### Bank Account Deposits

```http

GET /api/buildium/bank-accounts/{id}/deposits
POST /api/buildium/bank-accounts/{id}/deposits
GET /api/buildium/bank-accounts/{id}/deposits/{depositId}

```

##### Bank Account Transfers

```http

GET /api/buildium/bank-accounts/{id}/transfers
POST /api/buildium/bank-accounts/{id}/transfers
GET /api/buildium/bank-accounts/{id}/transfers/{transferId}

```

##### Bank Account Withdrawals

```http

GET /api/buildium/bank-accounts/{id}/withdrawals
POST /api/buildium/bank-accounts/{id}/withdrawals
GET /api/buildium/bank-accounts/{id}/withdrawals/{withdrawalId}

```

##### Bank Account Reconciliations

```http

GET /api/buildium/bank-accounts/{id}/reconciliations
POST /api/buildium/bank-accounts/{id}/reconciliations
GET /api/buildium/bank-accounts/{id}/reconciliations/{reconciliationId}

```

### 🔧 **Tasks** (`/api/buildium/tasks`)

Tasks represent maintenance requests and work items.

#### List Tasks

```http

GET /api/buildium/tasks

```

**Parameters**:

- `propertyId` (optional): Filter by property ID
- `unitId` (optional): Filter by unit ID
- `status` (optional): Filter by task status
- `categoryId` (optional): Filter by task category
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Task by ID

```http

GET /api/buildium/tasks/{id}

```

#### Create Task

```http

POST /api/buildium/tasks

```

**Request Body**:

```json

{
  "propertyId": 123,
  "unitId": 456,
  "title": "Fix leaky faucet",
  "description": "Kitchen faucet is leaking",
  "priority": "Medium",
  "categoryId": 789
}

```

#### Update Task

```http

PUT /api/buildium/tasks/{id}

```

#### Task-Specific Endpoints

##### Task History

```http

GET /api/buildium/tasks/{id}/history

```

##### Task Categories

```http

GET /api/buildium/tasks/categories
POST /api/buildium/tasks/categories
GET /api/buildium/tasks/categories/{categoryId}
PUT /api/buildium/tasks/categories/{categoryId}

```

### 🛠️ **Work Orders** (`/api/buildium/work-orders`)

Work orders represent the execution of maintenance tasks.

#### List Work Orders

```http

GET /api/buildium/work-orders

```

**Parameters**:

- `taskId` (optional): Filter by task ID
- `propertyId` (optional): Filter by property ID
- `unitId` (optional): Filter by unit ID
- `status` (optional): Filter by work order status
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Work Order by ID

```http

GET /api/buildium/work-orders/{id}

```

#### Create Work Order

```http

POST /api/buildium/work-orders

```

**Request Body**:

```json

{
  "taskId": 123,
  "propertyId": 456,
  "unitId": 789,
  "title": "Repair kitchen faucet",
  "description": "Replace leaking kitchen faucet",
  "assignedTo": "John Smith",
  "estimatedCost": 150
}

```

#### Update Work Order

```http

PUT /api/buildium/work-orders/{id}

```

### 👷 **Vendors** (`/api/buildium/vendors`)

Vendors provide services for properties and maintenance.

#### List Vendors

```http

GET /api/buildium/vendors

```

**Parameters**:

- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip
- `name` (optional): Filter by vendor name
- `email` (optional): Filter by email address

#### Get Vendor by ID

```http

GET /api/buildium/vendors/{id}

```

#### Create Vendor

```http

POST /api/buildium/vendors

```

**Request Body**:

```json

{
  "name": "ABC Plumbing",
  "email": "contact@abcplumbing.com",
  "phone": "(555) 987-6543",
  "address": {
    "addressLine1": "456 Vendor St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345"
  },
  "services": ["Plumbing", "HVAC"]
}

```

#### Update Vendor

```http

PUT /api/buildium/vendors/{id}

```

#### Vendor-Specific Endpoints

##### Vendor Notes

```http

GET /api/buildium/vendors/{id}/notes
POST /api/buildium/vendors/{id}/notes

```

##### Vendor Transactions

```http

GET /api/buildium/vendors/{id}/transactions

```

##### Vendor Credits

```http

GET /api/buildium/vendors/{id}/credits
POST /api/buildium/vendors/{id}/credits

```

##### Vendor Refunds

```http

GET /api/buildium/vendors/{id}/refunds
POST /api/buildium/vendors/{id}/refunds

```

### 📄 **Bills** (`/api/buildium/bills`)

Bills represent financial obligations to vendors and service providers.

#### List Bills

```http

GET /api/buildium/bills

```

**Parameters**:

- `propertyId` (optional): Filter by property ID
- `vendorId` (optional): Filter by vendor ID
- `status` (optional): Filter by bill status
- `dateFrom` (optional): Filter by start date
- `dateTo` (optional): Filter by end date
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Bill by ID

```http

GET /api/buildium/bills/{id}

```

#### Create Bill

```http

POST /api/buildium/bills

```

**Request Body**:

```json

{
  "propertyId": 123,
  "vendorId": 456,
  "amount": 500,
  "dueDate": "2025-02-15",
  "description": "Plumbing repair services",
  "lineItems": [
    {
      "description": "Faucet replacement",
      "amount": 300
    },
    {
      "description": "Labor",
      "amount": 200
    }
  ]
}

```

#### Update Bill

```http

PUT /api/buildium/bills/{id}

```

#### Bill-Specific Endpoints

##### Bill Files

```http

GET /api/buildium/bills/{id}/files
POST /api/buildium/bills/{id}/files
GET /api/buildium/bills/{id}/files/{fileId}

```

##### Bill Payments

```http

GET /api/buildium/bills/{id}/payments
POST /api/buildium/bills/{id}/payments
GET /api/buildium/bills/{id}/payments/{paymentId}

```

### 📁 **Files** (`/api/buildium/files`)

Files represent documents and attachments in the system.

#### List Files

```http

GET /api/buildium/files

```

**Parameters**:

- `entityType` (optional): Filter by entity type (Property, Unit, Lease, etc.)
- `entityId` (optional): Filter by entity ID
- `categoryId` (optional): Filter by file category
- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get File by ID

```http

GET /api/buildium/files/{id}

```

#### Upload File

```http

POST /api/buildium/files

```

**Request Body** (multipart/form-data):

```json

{
  "file": "<file_binary>",
  "title": "Lease Agreement",
  "description": "Signed lease agreement for Unit A101",
  "entityType": "Lease",
  "entityId": 123,
  "categoryId": 456
}

```

#### Update File

```http

PUT /api/buildium/files/{id}

```

#### File-Specific Endpoints

##### File Share Settings

```http

GET /api/buildium/files/{id}/sharesettings
PUT /api/buildium/files/{id}/sharesettings

```

##### File Categories

```http

GET /api/buildium/files/categories
POST /api/buildium/files/categories
GET /api/buildium/files/categories/{id}
PUT /api/buildium/files/categories/{id}

```

### 🏦 **General Ledger** (`/api/buildium/general-ledger`)

General ledger accounts track financial transactions and categories.

#### List Accounts

```http

GET /api/buildium/general-ledger/accounts

```

**Parameters**:

- `limit` (optional): Number of records to return
- `offset` (optional): Number of records to skip

#### Get Account by ID

```http

GET /api/buildium/general-ledger/accounts/{id}

```

#### Account Balances

```http

GET /api/buildium/general-ledger/accounts/balances

```

#### General Ledger Entries

```http

GET /api/buildium/general-ledger/entries
POST /api/buildium/general-ledger/entries
GET /api/buildium/general-ledger/entries/{id}
PUT /api/buildium/general-ledger/entries/{id}

```

#### General Ledger Transactions

```http

GET /api/buildium/general-ledger/transactions
GET /api/buildium/general-ledger/transactions/{id}

```

### 🔄 **Sync Endpoints**

#### Sync All Data

```http

POST /api/buildium/sync

```

**Purpose**: Sync all data from Buildium to local database

**Request Body**:

```json

{
  "entities": ["properties", "units", "owners", "leases", "transactions"],
  "forceSync": false
}

```

#### Sync Specific Entity

```http

POST /api/buildium/sync/{entity}

```

**Purpose**: Sync specific entity type from Buildium

**Parameters**:

- `entity` (path): Entity type to sync (properties, units, owners, leases, transactions)

**Request Body**:

```json

{
  "forceSync": false,
  "ids": [123, 456, 789]
}

```

### 🔗 **Webhook Endpoints**

#### Webhook Handler

```http

POST /api/webhooks/buildium

```

**Purpose**: Handle webhook events from Buildium

**Request Body**:

```json

{
  "eventType": "property.updated",
  "entityId": 123,
  "timestamp": "2025-01-15T10:00:00Z",
  "data": {
    "propertyId": 123,
    "changes": {
      "name": "Updated Property Name"
    }
  }
}

```

## Error Handling

All endpoints return consistent error responses:

```json

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "name",
      "issue": "Name is required"
    }
  }
}

```

### Common Error Codes

- `AUTHENTICATION_ERROR`: Invalid or expired access token
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND_ERROR`: Resource not found
- `RATE_LIMIT_ERROR`: Too many requests
- `BUILDIUM_API_ERROR`: Error from Buildium API
- `DATABASE_ERROR`: Database operation failed

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Standard**: 100 requests per minute per client

- **Bulk Operations**: 10 requests per minute per client

- **Sync Operations**: 5 requests per minute per client

## Pagination

List endpoints support pagination:

```json

{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}

```

## Best Practices

### 🔒 **Security**

1. **Authentication**: Always include valid access tokens

2. **HTTPS**: Use HTTPS for all API calls

3. **Input Validation**: Validate all input data

4. **Error Handling**: Handle errors gracefully

### 🚀 **Performance**

1. **Pagination**: Use pagination for large datasets

2. **Filtering**: Use filters to reduce data transfer

3. **Caching**: Cache frequently accessed data

4. **Batch Operations**: Use batch endpoints when possible

### 🔄 **Sync Management**

1. **Incremental Sync**: Use incremental sync for efficiency

2. **Error Recovery**: Implement retry logic for failed syncs

3. **Monitoring**: Monitor sync performance and failures

4. **Webhooks**: Use webhooks for real-time updates

## Conclusion

This API provides comprehensive access to all Buildium functionality while maintaining security, performance, and
reliability. The endpoints follow RESTful conventions and include proper error handling, authentication, and data
validation.
