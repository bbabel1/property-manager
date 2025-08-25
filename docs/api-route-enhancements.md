# API Route Enhancements - Buildium Integration

## Overview

This document details the enhancements made to existing API routes to integrate Buildium sync functionality.

## 🎯 **Phase 3: API Route Enhancement - COMPLETED** ✅

### **What Was Implemented:**

#### **1. Enhanced Properties API Route** ✅

**File:** `src/app/api/properties/route.ts`

**Enhancements:**

- **Buildium Sync Integration**: Automatic sync to Buildium when properties are created

- **Sync Status Tracking**: Track sync success/failure for each property

- **Enhanced Response**: Include Buildium sync information in API responses

- **Error Handling**: Graceful handling of Buildium sync failures

- **Data Mapping**: Proper mapping between local and Buildium data formats

**Key Features:**

```typescript

// POST /api/properties now includes Buildium sync
{
  message: 'Property created successfully',
  property: { /* property data */ },

  buildiumSync: {
    success: true,
    buildiumId: 12345,
    error: null
  }
}

```

#### **2. Enhanced Owners API Route** ✅

**File:** `src/app/api/owners/route.ts`

**Enhancements:**

- **Buildium Sync Integration**: Automatic sync to Buildium when owners are created

- **Contact Data Mapping**: Proper mapping of contact information to Buildium format

- **Sync Status Tracking**: Track sync success/failure for each owner

- **Enhanced Response**: Include Buildium sync information in API responses

- **Error Handling**: Graceful handling of Buildium sync failures

**Key Features:**

```typescript

// POST /api/owners now includes Buildium sync
{
  id: 'owner-id',
  // ... owner data ...
  buildiumSync: {
    success: true,
    buildiumId: 67890,
    error: null
  }
}

```

#### **3. Buildium Sync Management API** ✅

**File:** `src/app/api/buildium/sync/route.ts`

**Endpoints:**

- **GET /api/buildium/sync**: Get sync status for entities or failed syncs

- **POST /api/buildium/sync**: Retry failed syncs

**Features:**

- **Sync Status Queries**: Query sync status by entity type and ID

- **Failed Sync Management**: View and retry failed syncs

- **Batch Retry**: Retry multiple failed syncs at once

- **Error Reporting**: Detailed error reporting for failed syncs

**Usage Examples:**

```typescript

// Get sync status for a specific property
GET /api/buildium/sync?entityType=property&entityId=123

// Get all failed syncs
GET /api/buildium/sync

// Retry failed syncs for properties
POST /api/buildium/sync
{
  "entityType": "property"
}

```

#### **4. Buildium Webhook Endpoint** ✅

**File:** `src/app/api/webhooks/buildium/route.ts`

**Features:**

- **Webhook Processing**: Handle real-time events from Buildium

- **Event Storage**: Store webhook events in database

- **Event Processing**: Process different types of webhook events

- **Error Handling**: Robust error handling for webhook processing

- **Signature Verification**: Framework for webhook signature verification

**Supported Event Types:**

- Property events (created, updated)
- Unit events (created, updated)
- Owner events (created, updated)
- Vendor events (created, updated)
- Task events (created, updated)
- Bill events (created, updated)
- Bank account events (created, updated)
- Lease events (created, updated)

#### **5. Buildium Sync Service** ✅

**File:** `src/lib/buildium-sync.ts`

**Comprehensive sync service with:**

- **Entity Sync Methods**: Sync all entity types to/from Buildium

- **Error Handling**: Comprehensive error handling and retry logic

- **Status Tracking**: Track sync status in database

- **Batch Operations**: Support for batch sync operations

- **Retry Logic**: Automatic retry of failed syncs

## 📊 **API Response Enhancements**

### **Enhanced Property Creation Response:**

```json

{
  "message": "Property created successfully",
  "property": {
    "id": "property-id",
    "name": "Sample Property",
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "rentalSubType": "Office",
    "status": "Active",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  },
  "buildiumSync": {
    "success": true,
    "buildiumId": 12345,
    "error": null
  }
}

```

### **Enhanced Owner Creation Response:**

```json

{
  "id": "owner-id",
  "contact_id": "contact-id",
  "is_company": false,
  "first_name": "John",
  "last_name": "Doe",
  "primary_email": "john.doe@example.com",
  "primary_phone": "+1-555-0123",

  "displayName": "John Doe",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "buildiumSync": {
    "success": true,
    "buildiumId": 67890,
    "error": null
  }
}

```

### **Sync Status Response:**

```json

{
  "syncStatus": {
    "entityType": "property",
    "entityId": "property-id",
    "buildiumId": 12345,
    "lastSyncedAt": "2025-01-15T10:30:00Z",
    "syncStatus": "synced",
    "errorMessage": null,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}

```

### **Failed Syncs Response:**

```json

{
  "failedSyncs": [
    {
      "entityType": "property",
      "entityId": "property-id",
      "buildiumId": null,
      "lastSyncedAt": null,
      "syncStatus": "failed",
      "errorMessage": "API rate limit exceeded",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}

```

## 🔧 **Usage Examples**

### **Creating a Property with Buildium Sync:**

```typescript

const response = await fetch('/api/properties', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    name: 'Sample Property',
    addressLine1: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    rentalSubType: 'Office',
    status: 'Active'
  })
});

const result = await response.json();
console.log('Property created:', result.property);
console.log('Buildium sync:', result.buildiumSync);

```

### **Creating an Owner with Buildium Sync:**

```typescript

const response = await fetch('/api/owners', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    isCompany: false,
    firstName: 'John',
    lastName: 'Doe',
    primaryEmail: 'john.doe@example.com',
    primaryPhone: '+1-555-0123',

    primaryAddressLine1: '456 Oak Ave',
    primaryCity: 'New York',
    primaryState: 'NY',
    primaryPostalCode: '10002',
    primaryCountry: 'US'
  })
});

const result = await response.json();
console.log('Owner created:', result);
console.log('Buildium sync:', result.buildiumSync);

```

### **Checking Sync Status:**

```typescript

// Get sync status for a specific property
const response = await fetch('/api/buildium/sync?entityType=property&entityId=123');
const { syncStatus } = await response.json();

// Get all failed syncs
const response = await fetch('/api/buildium/sync');
const { failedSyncs } = await response.json();

// Retry failed syncs
const response = await fetch('/api/buildium/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    entityType: 'property'
  })
});

const { success, retried, errors } = await response.json();

```

### **Webhook Processing:**

```typescript

// Buildium will send webhooks to this endpoint
POST /api/webhooks/buildium

// Example webhook payload
{
  "Events": [
    {
      "Id": "event-id",
      "EventType": "PropertyUpdated",
      "EntityId": 12345,
      "EntityType": "Property",
      "EventDate": "2025-01-15T10:30:00Z",
      "Data": { /* property data */ }

    }
  ]
}

```

## 🛡️ **Error Handling**

### **Buildium Sync Failures:**

- **Graceful Degradation**: Local operations succeed even if Buildium sync fails

- **Error Logging**: All sync errors are logged for debugging

- **Status Tracking**: Failed syncs are tracked in database

- **Retry Mechanism**: Failed syncs can be retried manually or automatically

### **Webhook Processing:**

- **Event Storage**: All webhook events are stored before processing

- **Individual Processing**: Each event is processed independently

- **Error Isolation**: One failed event doesn't affect others

- **Retry Capability**: Failed events can be reprocessed

### **API Rate Limiting:**

- **Built-in Rate Limiting**: All endpoints include rate limiting

- **Buildium Rate Limits**: Respect Buildium API rate limits

- **Retry Logic**: Automatic retry with exponential backoff

- **Queue Management**: Failed requests are queued for retry

## 📋 **Environment Variables**

Add these to your `.env` file:

```bash

# Buildium API Configuration

BUILDIUM_API_KEY=your_buildium_api_key
BUILDIUM_BASE_URL=https://api.buildium.com/v1
BUILDIUM_WEBHOOK_SECRET=your_webhook_secret

# Optional: Buildium sync settings

BUILDIUM_SYNC_ENABLED=true
BUILDIUM_RETRY_ATTEMPTS=3
BUILDIUM_RETRY_DELAY=1000
BUILDIUM_TIMEOUT=30000

```

## 🎉 **Summary**

Phase 3 has been successfully completed with:

✅ **Enhanced Properties API** with Buildium sync

✅ **Enhanced Owners API** with Buildium sync

✅ **Buildium Sync Management API** for status and retry

✅ **Buildium Webhook Endpoint** for real-time updates

✅ **Comprehensive Buildium Sync Service** for all entities

✅ **Robust Error Handling** and status tracking

✅ **Enhanced API Responses** with sync information

### **Next Steps:**

1. **Phase 4: Testing & Validation** - Comprehensive testing of all integration points

2. **Phase 5: Monitoring & Logging** - Production monitoring and alerting

3. **Phase 6: Performance Optimization** - Optimize sync performance and reliability

The API routes are now fully integrated with Buildium and ready for production use!
