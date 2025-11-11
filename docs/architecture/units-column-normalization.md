# Units Table Column Normalization

This document describes the normalization of column names in the `units` table to follow consistent lowercase snake_case
naming conventions.

## Overview

The `units` table had a mix of naming conventions, with some columns using spaces and mixed case. This migration
normalizes all column names to lowercase snake_case for consistency.

## Changes Made

### Column Names Normalized

The following columns were renamed:

| Old Name | New Name |
|----------|----------|
| `"Service Start"` | `service_start` |
| `"Service End"` | `service_end` |
| `"Service Plan"` | `service_plan` |
| `"Fee Type"` | `fee_type` |
| `"Fee Percent"` | `fee_percent` |
| `"Management Fee"` | `fee_dollar_amount` |
| `"Fee Frequency"` | `fee_frequency` |
| `"Active Services"` | `active_services` |
| `"Fee Notes"` | `fee_notes` |

### Files Updated

1. **Database Migration**: `supabase/migrations/20250115000000_normalize_units_columns.sql`

2. **Original Migration**: `supabase/migrations/20250815111240_add_service_fields_to_units.sql` (updated to use correct

names)

3. **TypeScript Types**: `src/types/units.ts` (added missing fields and enums)

4. **Migration Script**: `scripts/run-column-normalization.ts`

5. **SQL Script**: `scripts/normalize-units-columns.sql`

## How to Apply the Changes

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/normalize-units-columns.sql`
4. Run the script
5. Verify the changes by checking the units table structure

### Option 2: Using the Migration Script

1. Ensure your environment variables are set:
   ```bash

   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Run the migration script:
   ```bash

   npm run tsx scripts/run-column-normalization.ts
   ```

### Option 3: Using Supabase CLI

1. Apply the migration using Supabase CLI:
   ```bash

   supabase db push
   ```

## Verification

After running the migration, verify the changes:

1. **Check column names**:

   ```sql

   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'units'
   ORDER BY ordinal_position;
   ```

2. **Test API endpoints**:

   - GET `/api/units?propertyId=<id>`
   - POST `/api/units`

3. **Test application functionality**:

   - Navigate to property pages
   - Add/edit units
   - Verify all data displays correctly

## TypeScript Types

The `src/types/units.ts` file has been updated to include:

- All missing fields (buildium fields, service fields)
- Proper enum types for service-related fields
- Updated mapping functions for database ↔ application conversion

### New Enums Added

```typescript

export type ServicePlan = 'Full' | 'Basic' | 'A-la-carte';
export type FeeFrequency = 'Monthly' | 'Annually';
export type FeeType = 'Percentage' | 'Flat Rate';

```

### New Fields Added

- `buildiumUnitId` / `buildium_unit_id`
- `buildiumPropertyId` / `buildium_property_id`
- `serviceStart` / `service_start`
- `serviceEnd` / `service_end`
- `servicePlan` / `service_plan`
- `feeType` / `fee_type`
- `feePercent` / `fee_percent`
- `feeDollarAmount` / `fee_dollar_amount`
- `feeFrequency` / `fee_frequency`
- `activeServices` / `active_services`
- `feeNotes` / `fee_notes`

## Rollback Plan

If you need to rollback the changes:

1. **Rename columns back**:

   ```sql

   ALTER TABLE "units" RENAME COLUMN "service_start" TO "Service Start";
   ALTER TABLE "units" RENAME COLUMN "service_end" TO "Service End";
   -- ... repeat for all columns
   ```

2. **Revert TypeScript types** to the previous version

3. **Update any application code** that uses the new field names

## Impact Assessment

### Low Risk

- Column renaming is a safe operation that doesn't affect data
- All existing code already uses snake_case for the core fields
- No breaking changes to existing functionality

### No Impact On

- Existing data (all data is preserved)
- Core functionality (property management, unit management)
- API endpoints (they already use correct column names)
- User interface (components already use correct field names)

### Benefits

- Consistent naming convention across the database
- Easier to work with in SQL queries
- Better alignment with PostgreSQL best practices
- Cleaner TypeScript types with all fields included

## Testing Checklist

- [ ] Migration runs without errors
- [ ] All column names are normalized
- [ ] Trigger function works correctly
- [ ] API endpoints return correct data
- [ ] Property pages load without errors
- [ ] Unit creation/editing works
- [ ] TypeScript compilation succeeds
- [ ] No console errors in browser

## Support

If you encounter any issues during the migration:

1. Check the Supabase logs for detailed error messages
2. Verify your environment variables are set correctly
3. Ensure you have the necessary permissions to modify the database
4. Test on a development environment first
