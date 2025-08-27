# Buildium Integration Scripts

> **Purpose**: Scripts for Buildium API integration, data synchronization, and verification

## Overview

This directory contains scripts for managing Buildium API integration, including entity creation, data synchronization, and verification operations.

## Directory Structure

```
buildium/
├── create/          # Entity creation scripts
├── sync/            # Data synchronization scripts
├── verify/          # Data verification scripts
└── README.md        # This file
```

## Script Categories

### **Creation Scripts** (`create/`)
Scripts for creating entities in Buildium and syncing to local database.

**Key Scripts**:
- `add-buildium-property.ts` - Create property in Buildium
- `create-buildium-lease-records.ts` - Create lease records
- `create-buildium-charge-records.ts` - Create charge records
- `create-buildium-journal-entries.ts` - Create journal entries
- `create-buildium-transaction-lines.ts` - Create transaction lines
- `create-buildium-rent-schedule-record.ts` - Create rent schedules
- `create-buildium-gl-accounts.ts` - Create general ledger accounts

### **Sync Scripts** (`sync/`)
Scripts for synchronizing data between Buildium and local database.

**Key Scripts**:
- `sync-buildium-bank-accounts.ts` - Sync bank accounts
- `fetch-all-lease-transactions.ts` - Fetch lease transactions
- `fetch-buildium-lease.ts` - Fetch specific lease
- `fetch-buildium-leases-list.ts` - Fetch all leases
- `fetch-buildium-rent-schedule.ts` - Fetch rent schedules
- `fetch-buildium-journal-entry.ts` - Fetch journal entries
- `populate-relationships.ts` - Populate entity relationships

### **Verification Scripts** (`verify/`)
Scripts for verifying data integrity and relationships.

**Key Scripts**:
- `verify-relationships.ts` - Verify entity relationships
- `verify-buildium-transaction-lines.ts` - Verify transaction lines
- `verify-lease-creation.ts` - Verify lease creation
- `verify-owner-created.ts` - Verify owner creation
- `verify-buildium-charge-records.ts` - Verify charge records
- `verify-rent-schedule-creation.ts` - Verify rent schedule creation
- `check-property-fields.ts` - Check property field completeness

## Common Workflows

### **Adding a New Property**
```bash
# 1. Create property
npx tsx scripts/buildium/create/add-buildium-property.ts

# 2. Verify creation
npx tsx scripts/buildium/verify/check-local-property.ts

# 3. Add units
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]

# 4. Verify units
npx tsx scripts/buildium/verify/check-unit-created.ts
```

### **Data Synchronization**
```bash
# 1. Sync bank accounts
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# 2. Fetch transactions
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts

# 3. Verify relationships
npx tsx scripts/buildium/verify/verify-relationships.ts
```

### **Troubleshooting**
```bash
# 1. Check property data
npx tsx scripts/buildium/verify/check-property-fields.ts

# 2. Verify relationships
npx tsx scripts/buildium/verify/verify-relationships.ts

# 3. Check transaction lines
npx tsx scripts/buildium/verify/verify-buildium-transaction-lines.ts
```

## Environment Variables Required

```env
# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Important Notes

### **API Rate Limits**
- Respect Buildium API rate limits
- Use appropriate delays between requests
- Handle API errors gracefully
- Log all API interactions

### **Data Consistency**
- Verify relationships after data creation
- Check for orphaned records
- Ensure data integrity constraints
- Monitor sync status

### **Error Handling**
- Check script output for errors
- Verify data integrity after operations
- Retry failed operations as needed
- Document any manual interventions

## Additional Resources

- [Buildium Integration Guide](../../docs/buildium-integration-guide.md)
- [API Documentation](../../docs/api/buildium-api-documentation.md)
- [Quick Start Guide](../../docs/QUICK_START_GUIDE.md)
