# Buildium Property Import Guide

> **Last Updated**: 2025-08-25
>
> This guide provides step-by-step instructions for importing Buildium properties into the Property Management System database.

## Quick Reference

### Import a Property
```bash
# Import a property by ID
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]
```

### Sync Bank Accounts First
```bash
# Sync bank accounts from Buildium before importing properties
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts
```

## Overview

This guide covers the process of importing Buildium data into your local database, including:

- **Properties**: Main property information with addresses and details
- **Bank Accounts**: Operating bank account linking for properties

## Prerequisites

### Environment Variables

Ensure the following environment variables are set in your `.env` file:

```bash
# Buildium API Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1

# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Schema

Ensure your database has the following tables with the correct schema:
- `properties` - Property information
- `bank_accounts` - Bank account information



## Import Process

### Step 1: Bank Account Preparation

Before importing properties, ensure bank accounts are synced from Buildium:

```bash
# Sync bank accounts from Buildium
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts
```

This step is crucial for proper `operating_bank_account_id` linking.

### Step 2: Property Import

Use the property import script:

```bash
# Import a specific property by ID
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]
```

The script will:
1. Fetch property data from Buildium
2. Create/update the property in the local database
3. Link to the appropriate bank account if available

### Step 3: Verification

Verify the import was successful:

```sql
-- Check property details
SELECT id, name, operating_bank_account_id, buildium_property_id 
FROM properties 
WHERE buildium_property_id = [your-property-id];

-- Check bank account linking
SELECT p.name as property_name, ba.name as bank_account_name
FROM properties p
LEFT JOIN bank_accounts ba ON p.operating_bank_account_id = ba.id
WHERE p.buildium_property_id = [your-property-id];
```

## Troubleshooting

### Issue: `operating_bank_account_id` is NULL

**Symptoms:**
- Property is created but `operating_bank_account_id` is NULL
- Bank account linking fails

**Root Cause:**
- Bank accounts not synced from Buildium
- Incorrect column name in database queries
- Buildium property doesn't have an operating bank account

**Solution:**
1. **Sync bank accounts first:**
   ```bash
   npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts
   ```

2. **Update existing property manually:**
   ```sql
   UPDATE properties 
   SET operating_bank_account_id = (SELECT id FROM bank_accounts WHERE buildium_bank_id = [bank-id])
   WHERE buildium_property_id = [property-id];
   ```

3. **Verify bank account exists:**
   ```sql
   SELECT id, name, buildium_bank_id 
   FROM bank_accounts 
   WHERE buildium_bank_id = 10407;
   ```

### Issue: Bank Account Not Found

**Symptoms:**
- Error: "No bank account found with Buildium ID: XXXX"
- Property created but bank account not linked

**Solution:**
1. Check if the bank account exists in Buildium
2. Verify the bank account sync was successful
3. Check the `buildium_bank_id` column in the `bank_accounts` table

### Issue: Property Already Exists

**Symptoms:**
- Script reports "Property already exists"
- No new data is imported

**Solution:**
The script is designed to handle existing properties gracefully. If you need to update an existing property:

1. **Update bank account linking manually:**
   ```sql
   UPDATE properties 
   SET operating_bank_account_id = (SELECT id FROM bank_accounts WHERE buildium_bank_id = [bank-id])
   WHERE buildium_property_id = [property-id];
   ```

2. **Force re-import (modify script):**
   - Edit the script to remove the existence check
   - Or delete the existing property first

## Data Mapping

### Property Mapping

| Buildium Field | Database Field | Notes |
|----------------|----------------|-------|
| `Id` | `buildium_property_id` | Buildium property ID |
| `Name` | `name` | Property name |
| `Address` | `address_line1`, `address_line2`, etc. | Full address breakdown |
| `OperatingBankAccountId` | `operating_bank_account_id` | **CRITICAL**: Links to local bank account |
| `Reserve` | `reserve` | Property reserve amount |
| `YearBuilt` | `year_built` | Year property was built |
| `IsActive` | `status` | Converted to 'Active'/'Inactive' |

### Bank Account Resolution

The script includes a `findBankAccountByBuildiumId()` function that:

1. Takes the Buildium `OperatingBankAccountId`
2. Queries the local `bank_accounts` table using `buildium_bank_id`
3. Returns the local bank account UUID
4. Links it to the property's `operating_bank_account_id`

### Unit Mapping

| Buildium Field | Database Field | Notes |
|----------------|----------------|-------|
| `Id` | `buildium_unit_id` | Buildium unit ID |
| `UnitNumber` | `unit_number` | Unit number/identifier |
| `UnitBathrooms` | `unit_bathrooms` | Number of bathrooms |
| `UnitBedrooms` | `unit_bedrooms` | Number of bedrooms |
| `UnitSize` | `unit_size` | Unit size in square feet |

### Owner Mapping

| Buildium Field | Database Field | Notes |
|----------------|----------------|-------|
| `Id` | `buildium_owner_id` | Buildium owner ID |
| `FirstName` | `first_name` (contacts table) | Owner's first name |
| `LastName` | `last_name` (contacts table) | Owner's last name |
| `Email` | `email` (contacts table) | Owner's email |
| `PrimaryAddress` | `address_line1`, etc. (contacts table) | Owner's address |

## Scripts Reference

### Main Import Scripts



### Supporting Scripts

- `sync-buildium-bank-accounts.ts` - Sync bank accounts from Buildium
- `update-property-bank-account.ts` - Update existing property with bank account
- `link-property-bank-account.ts` - Link property to specific bank account

### Individual Component Scripts

- `add-buildium-property.ts` - Import property only


## Best Practices

### 1. Always Sync Bank Accounts First

Bank accounts must be synced before importing properties to ensure proper linking:

```bash
# Step 1: Sync bank accounts
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# Step 2: Import properties
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]
```

### 2. Use the Property Import Script

Always use `add-buildium-property.ts` with the correct property ID to ensure proper import.

### 3. Verify Data After Import

Always verify the import was successful:

```sql
-- Check property and bank account linking
SELECT 
  p.name as property_name,
  p.operating_bank_account_id,
  ba.name as bank_account_name,
  ba.buildium_bank_id
FROM properties p
LEFT JOIN bank_accounts ba ON p.operating_bank_account_id = ba.id
WHERE p.buildium_property_id = [your-property-id];
```

### 4. Handle Errors Gracefully

The scripts include comprehensive error handling and logging. Check the logs for any issues:

```bash
# Run with verbose logging
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id] 2>&1 | tee import.log
```

## Common Issues and Solutions

### Issue: "Cannot find module './utils/logger'"

**Solution:** The import path is incorrect. Fix the path in the script:
```typescript
// Change from:
import { logger } from './utils/logger'
// To:
import { logger } from '../../utils/logger'
```

### Issue: "Missing required environment variables"

**Solution:** Ensure all environment variables are set in your `.env` file:
```bash
# Check environment variables
echo "BUILDIUM_BASE_URL: $BUILDIUM_BASE_URL"
echo "BUILDIUM_CLIENT_ID: $BUILDIUM_CLIENT_ID"
echo "BUILDIUM_CLIENT_SECRET: $BUILDIUM_CLIENT_SECRET"
```

### Issue: "Property already exists"

**Solution:** This is expected behavior. The script checks for existing properties to avoid duplicates. If you need to update an existing property, use SQL directly:
```sql
UPDATE properties 
SET operating_bank_account_id = (SELECT id FROM bank_accounts WHERE buildium_bank_id = [bank-id])
WHERE buildium_property_id = [property-id];
```

## Future Improvements

### Planned Enhancements

1. **Bulk Import Script**: Import multiple properties at once
2. **Incremental Sync**: Only sync changed data
3. **Validation Scripts**: Verify data integrity after import
4. **Rollback Scripts**: Undo imports if needed

### Customization

To import different properties, use the script with the property ID as a parameter:

```bash
npx tsx scripts/buildium/create/add-buildium-property.ts [YOUR_PROPERTY_ID]
```

## Support

If you encounter issues not covered in this guide:

1. Check the script logs for detailed error messages
2. Verify your environment variables are correct
3. Ensure your database schema matches the expected structure
4. Check that Buildium API credentials are valid and have proper permissions

## Changelog

### 2025-01-15
- **FIXED**: `operating_bank_account_id` issue resolved
- **ADDED**: Bank account sync requirement
- **IMPROVED**: Error handling and logging
- **ADDED**: Comprehensive troubleshooting section
- **UPDATED**: Script to use correct database column names
