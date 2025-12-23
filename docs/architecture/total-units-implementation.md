# Total Units Implementation

## Overview

Added a new `total_units` field to the `properties` table that automatically counts
the number of active units (where status != 'Inactive') for each property.

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/20250115000004_add_total_units_to_properties.sql`

- Added `total_units` column to the `properties` table (INTEGER, NOT NULL,
  DEFAULT 0)
- Created functions to count and update total units:
  - `count_active_units_for_property(property_uuid UUID)` - Counts active units for
    a specific property
  - `update_property_total_units(property_uuid UUID)` - Updates total_units for a
    specific property
  - `update_all_properties_total_units()` - Updates total_units for all properties
- Created trigger function `trigger_update_property_total_units()` to handle
  INSERT/UPDATE/DELETE operations on units
- Added triggers on the `units` table to automatically update `total_units` when
  units are modified
- Initialized `total_units` for all existing properties

### 2. TypeScript Types

**File:** `src/types/properties.ts`

- Added `total_units: number` to `PropertyDB` interface
- Added `totalUnits: number` to `Property` interface
- Updated mapping functions to include the new field

### 3. Property Service

**File:** `src/lib/property-service.ts`

- Added `total_units: number` to `Property` interface
- Updated mock data to include `total_units: 2`
- Modified `units_summary` calculation to use `property.total_units` instead of
  counting all units

## How It Works

### Automatic Updates

The system automatically maintains the `total_units` count through database triggers:

1. **INSERT**: When a new unit is added, the trigger updates the property's

   `total_units`

2. **UPDATE**: When a unit's status or property_id changes, the trigger updates

   affected properties

3. **DELETE**: When a unit is deleted, the trigger updates the property's

   `total_units`

### Active Units Definition

An "active unit" is defined as any unit where `status != 'Inactive'`. This means:

- Units with status 'Occupied' are counted
- Units with status 'Vacant' are counted
- Units with status 'Inactive' are NOT counted

### Manual Updates

You can manually update total_units using the provided functions:

```sql

-- Update a specific property
SELECT update_property_total_units('property-uuid-here');

-- Update all properties
SELECT update_all_properties_total_units();

```

## Usage in Frontend

The `total_units` field is now available in the Property interface and is
displayed in the PropertySummary component. The value represents the count of
active units for each property.

## Testing

You can verify the implementation by running these SQL queries in your Supabase SQL
editor:

```sql

-- Check if the total_units column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'properties' AND column_name = 'total_units';

-- Check if the functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'count_active_units_for_property',
  'update_property_total_units',
  'update_all_properties_total_units',
  'trigger_update_property_total_units'
);

-- Check if the triggers exist
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'units'
AND trigger_name LIKE '%total_units%';

-- Test the count function with a sample property
SELECT
  p.id,
  p.name,
  p.total_units,
  COUNT(u.id) as actual_active_units
FROM properties p
LEFT JOIN units u ON p.id = u.property_id AND u.status != 'Inactive'
GROUP BY p.id, p.name, p.total_units
LIMIT 5;

```

## Benefits

1. **Performance**: No need to count units on every query

2. **Consistency**: Automatic updates ensure data accuracy

3. **Real-time**: Changes are reflected immediately

4. **Scalability**: Efficient for properties with many units

5. **Reliability**: Database-level constraints ensure data integrity
