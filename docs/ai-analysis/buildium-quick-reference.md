# Buildium Integration Quick Reference

<!-- markdownlint-configure-file {"MD060": false} -->

> Generated on: 2025-01-15
>
> Quick reference for the current Buildium integration state and immediate action items.

## Current State Overview

### ✅ **What's Working Well**

1. **Complete API Integration**: All major Buildium endpoints implemented

2. **Type Safety**: Comprehensive TypeScript types for all entities

3. **Data Mapping**: Centralized mapping functions in `src/lib/buildium-mappers.ts`

4. **Database Schema**: Proper Buildium ID fields and sync tracking

5. **Authentication**: Secure OAuth 2.0 implementation

6. **Error Handling**: Robust error handling in API routes

### ❌ **Immediate Issues to Address**

1. **Script Chaos**: 70+ scripts scattered in `/scripts/` with no organization

2. **Missing Documentation**: No clear table relationship documentation

3. **Inconsistent Naming**: Mixed naming conventions throughout

4. **No Quick Reference**: No centralized guide for developers

## Current File Structure

```text
src/
├── app/api/buildium/          # ✅ Well organized API routes

│   ├── properties/
│   ├── owners/
│   ├── leases/
│   ├── bank-accounts/
│   └── sync/
├── lib/
│   ├── buildium-client.ts     # ✅ Comprehensive API client

│   ├── buildium-mappers.ts    # ✅ Data mapping functions

│   └── buildium-edge-client.ts
├── types/
│   └── buildium.ts            # ✅ Complete type definitions

└── schemas/
    └── buildium.ts            # ✅ Validation schemas

scripts/                       # ❌ CHAOS - 70+ unorganized scripts

├── sync-buildium-bank-accounts.ts
├── create-buildium-lease-records.ts
├── verify-relationships.ts
├── cleanup-duplicate-journal-entries.ts
└── ... (67 more files)

docs/
├── api/                       # ✅ Good API documentation

├── database/                  # ✅ Good schema documentation

└── buildium-*.md             # ✅ Good integration guides

```

## Key Database Tables

### Core Tables with Buildium Integration

| Table           | Buildium ID Field      | Sync Status | Notes              |
| --------------- | ---------------------- | ----------- | ------------------ |
| `properties`    | `buildium_property_id` | ✅ Tracked  | Main property data |
| `owners`        | `buildium_owner_id`    | ✅ Tracked  | Property owners    |
| `lease`         | `buildium_lease_id`    | ✅ Tracked  | Lease agreements   |
| `units`         | `buildium_unit_id`     | ✅ Tracked  | Property units     |
| `bank_accounts` | `buildium_bank_id`     | ✅ Tracked  | Bank accounts      |

### Financial Tables

| Table               | Buildium ID Field      | Status         | Notes             |
| ------------------- | ---------------------- | -------------- | ----------------- |
| `vendors`           | `buildium_vendor_id`   | ✅ Implemented | Vendor management |
| `bills`             | `buildium_bill_id`     | ✅ Implemented | Bill tracking     |
| `bill_payments`     | `buildium_payment_id`  | ✅ Implemented | Payment records   |
| `vendor_categories` | `buildium_category_id` | ✅ Implemented | Vendor categories |

### Integration Tables

| Table                     | Purpose              | Status    |
| ------------------------- | -------------------- | --------- |
| `buildium_sync_status`    | Track sync status    | ✅ Active |
| `buildium_webhook_events` | Webhook processing   | ✅ Active |
| `buildium_api_cache`      | API response caching | ✅ Active |

## API Endpoints Quick Reference

### Properties

- `GET /api/buildium/properties` - List properties
- `GET /api/buildium/properties/[id]` - Get property details
- `POST /api/buildium/properties` - Create property
- `PUT /api/buildium/properties/[id]` - Update property

### Owners

- `GET /api/buildium/owners` - List owners
- `GET /api/buildium/owners/[id]` - Get owner details
- `POST /api/buildium/owners` - Create owner
- `PUT /api/buildium/owners/[id]` - Update owner

### Leases

- `GET /api/buildium/leases` - List leases
- `GET /api/buildium/leases/[id]` - Get lease details
- `GET /api/buildium/leases/[id]/transactions` - Get transactions
- `POST /api/buildium/leases/[id]/payments` - Create lease payment
- `POST /api/buildium/leases` - Create lease

### Bank Accounts

- `GET /api/buildium/bank-accounts` - List bank accounts
- `GET /api/buildium/bank-accounts/[id]` - Get bank account details
- `POST /api/buildium/bank-accounts` - Create bank account

### Sync Operations

- `POST /api/buildium/sync/properties` - Sync properties
- `POST /api/buildium/sync/owners` - Sync owners
- `POST /api/buildium/sync/leases` - Sync leases
- `POST /api/buildium/sync/bank-accounts` - Sync bank accounts

## Data Mapping Patterns

### Local → Buildium (PascalCase)

```typescript
// Local format (camelCase)
{
  name: "Sample Property",
  addressLine1: "123 Main St",
  city: "Anytown",
  state: "CA",
  postalCode: "12345"
}

// Buildium format (PascalCase)
{
  Name: "Sample Property",
  Address: {
    AddressLine1: "123 Main St",
    City: "Anytown",
    State: "CA",
    PostalCode: "12345"
  }
}

```

### Buildium → Local (camelCase)

```typescript
// Buildium format (PascalCase)
{
  Id: 12345,
  Name: "Sample Property",
  Address: {
    AddressLine1: "123 Main St",
    City: "Anytown"
  },
  CreatedDate: "2025-01-15T10:30:00Z"
}

// Local format (camelCase)
{
  buildiumPropertyId: 12345,
  name: "Sample Property",
  addressLine1: "123 Main St",
  city: "Anytown",
  buildiumCreatedAt: "2025-01-15T10:30:00Z"
}

```

## Common Scripts (Current Chaos)

### Sync Scripts

- `sync-buildium-bank-accounts.ts` - Sync bank accounts
- `fetch-all-lease-transactions.ts` - Fetch lease transactions
- `populate-relationships.ts` - Populate relationships

### Creation Scripts

- `create-buildium-lease-records.ts` - Create lease records
- `create-buildium-transaction-lines.ts` - Create transaction lines
- `create-buildium-journal-entries.ts` - Create journal entries

### Verification Scripts

- `verify-relationships.ts` - Verify data relationships
- `verify-buildium-transaction-lines.ts` - Verify transaction lines
- `verify-lease-creation.ts` - Verify lease creation

### Cleanup Scripts

- `cleanup-duplicate-journal-entries.ts` - Clean duplicate entries
- `cleanup-duplicate-transaction-lines.ts` - Clean duplicate lines

## Immediate Action Items

### 🔥 **High Priority (This Week)**

1. **Reorganize Scripts**

   ```bash
   # Create organized structure
   mkdir -p scripts/{buildium/{sync,create,verify,cleanup},database,api,utils}
   ```

2. **Create Script Index**

   ```bash
   # Add README.md to scripts/ with usage guide
   ```

3. **Add Health Check Endpoint**

   ```typescript
   // Create /api/health endpoint
   ```

### 🟡 **Medium Priority (Next Sprint)**

1. **Add Relationship Documentation**
   - Create ER diagrams for all tables
   - Document foreign key relationships
   - Add data flow diagrams

2. **Standardize Naming**
   - Fix inconsistent naming conventions
   - Update all references

3. **Add Pagination**
   - Implement pagination in all list endpoints
   - Add proper response metadata

### 🟢 **Low Priority (Future)**

1. **Add Comprehensive Testing**
   - Unit tests for mappers
   - Integration tests for endpoints
   - End-to-end tests

2. **Performance Optimization**
   - Add response caching
   - Implement background processing
   - Add performance monitoring

## Environment Variables

### Required for Buildium Integration

```bash
# Buildium API Configuration

BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1

# Supabase Configuration

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application Configuration

NEXT_PUBLIC_SITE_URL=https://yourdomain.com

```

## Common Issues and Solutions

### 401 Unauthorized Error

- **Cause**: Missing or incorrect Buildium credentials

- **Solution**: Check `BUILDIUM_CLIENT_ID` and `BUILDIUM_CLIENT_SECRET`

### Webhook Not Processing

- **Cause**: Incorrect webhook URL configuration

- **Solution**: Ensure webhook points to `/api/webhooks/buildium`

### Data Not Syncing

- **Cause**: Database connection issues

- **Solution**: Check Supabase connection and permissions

### Script Not Found

- **Cause**: Scripts are scattered and unorganized

- **Solution**: Use the script index (when created) or search in `/scripts/`

## Useful Commands

### Sync Operations

```bash
# Sync bank accounts

npx tsx scripts/sync-buildium-bank-accounts.ts

# Sync all data (when implemented)

npx tsx scripts/buildium/sync/sync-all.ts

```

### Verification

```bash
# Verify relationships

npx tsx scripts/verify-relationships.ts

# Verify transaction lines

npx tsx scripts/verify-buildium-transaction-lines.ts

```

### Cleanup

```bash
# Clean duplicate entries

npx tsx scripts/cleanup-duplicate-journal-entries.ts

# Clean duplicate transaction lines

npx tsx scripts/cleanup-duplicate-transaction-lines.ts

```

## Next Steps

1. **Immediate**: Reorganize scripts and create index

2. **Short-term**: Add relationship documentation and health checks

3. **Long-term**: Implement comprehensive testing and performance optimization

The Buildium integration is solid but needs organization and documentation improvements for better developer experience.
