# Ownerships Total Fields Implementation

## Overview

Added `total_units` and `total_properties` fields to the `ownerships` table that automatically calculate and maintain
the sum of units and count of active properties for each owner.

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/20250115000006_add_total_fields_to_ownerships.sql`

- Added `total_units` column to the `ownerships` table (INTEGER, NOT NULL, DEFAULT 0)
- Added `total_properties` column to the `ownerships` table (INTEGER, NOT NULL, DEFAULT 0)
- Created functions to calculate and update total fields:
  - `calculate_owner_total_units(owner_uuid UUID)` - Sums total_units from all properties owned by an owner
- `calculate_owner_total_properties(owner_uuid UUID)` - Counts active properties (status != 'Inactive') owned by an
owner
  - `update_owner_total_fields(owner_uuid UUID)` - Updates total_units and total_properties for a specific owner
  - `update_all_owners_total_fields()` - Updates total fields for all owners
- Created trigger functions to handle automatic updates:
  - `trigger_update_owner_total_fields()` - Handles ownerships table changes
  - `trigger_update_ownerships_from_properties()` - Handles properties table changes
- Added triggers on both `ownerships` and `properties` tables
- Initialized total fields for all existing ownerships

### 2. TypeScript Types

**File:** `src/types/ownerships.ts`

- Created new TypeScript interfaces for the ownerships table
- Added `total_units: number` and `total_properties: number` to `OwnershipDB` interface
- Added `totalUnits: number` and `totalProperties: number` to `Ownership` interface
- Created mapping functions for database ↔ application conversion
- Added utility types for form handling and validation

## How It Works

### Automatic Updates

The system automatically maintains accurate counts through database triggers:

#### Ownerships Table Triggers

1. **INSERT**: When a new ownership record is added, updates the owner's total fields

2. **UPDATE**: When ownership details change, updates the owner's total fields

3. **DELETE**: When an ownership record is deleted, updates the owner's total fields

#### Properties Table Triggers

1. **UPDATE**: When a property's `total_units` or `status` changes, updates all owners of that property

### Calculation Logic

#### Total Units

- **Definition**: Sum of `total_units` from all properties owned by the owner

- **Formula**: `SUM(properties.total_units)` for all properties where owner has ownership

- **Example**: If an owner owns 3 properties with 5, 8, and 12 units respectively, their `total_units` = 25

#### Total Properties

- **Definition**: Count of active properties (status != 'Inactive') owned by the owner

- **Formula**: `COUNT(*)` of properties where `status != 'Inactive'` and owner has ownership

- **Example**: If an owner owns 4 properties but 1 is inactive, their `total_properties` = 3

### Manual Updates

You can manually update total fields using the provided functions:

```sql

-- Update a specific owner
SELECT update_owner_total_fields('owner-uuid-here');

-- Update all owners
SELECT update_all_owners_total_fields();

```

## Database Schema

### Ownerships Table

```sql

CREATE TABLE ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  primary BOOLEAN NOT NULL DEFAULT false,
  ownership_percentage NUMERIC(5,2) NOT NULL,
  disbursement_percentage NUMERIC(5,2) NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,           -- NEW FIELD
  total_properties INTEGER NOT NULL DEFAULT 0,      -- NEW FIELD
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, owner_id)
);

```

## Usage in Frontend

The new fields are available in the Ownership interface and can be used in components that display owner information:

```typescript

import { Ownership } from '@/types/ownerships';

// Access the calculated fields
const ownership: Ownership = {
  // ... other fields
  totalUnits: 25,        // Sum of all property units
  totalProperties: 3     // Count of active properties
};

```

## API Integration

The ownerships API routes can now return the calculated fields:

```typescript

// Example API response
{
  id: "ownership-uuid",
  propertyId: "property-uuid",
  ownerId: "owner-uuid",
  primary: true,
  ownershipPercentage: 100,
  disbursementPercentage: 100,
  totalUnits: 25,        // Calculated field
  totalProperties: 3,    // Calculated field
  createdAt: "2025-01-15T00:00:00Z",
  updatedAt: "2025-01-15T00:00:00Z"
}

```

## Testing

Use the provided test script `test_ownerships_total_fields.sql` to verify the implementation:

```bash

# Run the test script in your Supabase SQL editor

# This will check:

# 1. Column existence

# 2. Function existence

# 3. Trigger existence

# 4. Data consistency

# 5. Current ownership data

# 6. Calculation accuracy

```

## Benefits

1. **Performance**: No need to calculate totals on every query

2. **Consistency**: Automatic updates ensure data accuracy

3. **Real-time**: Changes are reflected immediately

4. **Scalability**: Efficient for owners with many properties

5. **Reliability**: Database-level constraints ensure data integrity

6. **Analytics**: Easy access to owner portfolio summaries

## Relationship with Properties Table

This implementation builds upon the `total_units` field in the properties table:

- **Properties.total_units** = Count of active units for that property

- **Ownerships.total_units** = Sum of total_units from all properties owned by that owner

- **Ownerships.total_properties** = Count of active properties owned by that owner

The system maintains a hierarchical relationship where changes to units affect properties, and changes to properties
affect ownerships.
