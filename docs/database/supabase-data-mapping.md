# Supabase Data Mapping

This document maps the Supabase database schema to the UI components and data
structures used in the Property Management System.

## Overview

The database contains several core tables that map to different UI components:

- `properties` - Main property information and management
- `units` - Individual units within properties
- `owners` - Property owners and their information
- `lease` - Lease agreements and terms
- `lease_transactions` - Financial transactions for leases

## Properties Table

### Integration Fields

```typescript
// Buildium integration + sync metadata
interface PropertyIntegration {
  buildium_property_id?: number; // Buildium property ID (unique per property)
  buildium_created_at?: string; // Timestamp from Buildium when first seen
  buildium_updated_at?: string; // Timestamp from Buildium for last update
}
```

### Units Card

```typescript
interface UnitsCardData {
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  maintenance_units: number;
}
```

### Owners Card

```typescript
interface OwnersCardData {
  total_owners: number;
  active_owners: number;
  inactive_owners: number;
}
```

### Type Card

```typescript
interface TypeCardData {
  property_type: string;
  square_footage: number;
  bedrooms: number;
  bathrooms: number;
}
```

### Occupancy Card

```typescript
interface OccupancyCardData {
  occupancy_rate: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
}
```

### Property Details

#### Property Image

```typescript
interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  created_at: string;
}
```

#### Address

```typescript
interface PropertyAddress {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}
```

#### Property Manager

```typescript
interface PropertyManager {
  id: string;
  name: string;
  email: string;
  phone: string;
}
```

#### Property Type

```typescript
interface PropertyType {
  property_type: string;
  description?: string;
}
```

#### Status

```typescript
interface PropertyStatus {
  is_active: boolean;
  status: 'active' | 'inactive' | 'maintenance';
}
```

#### Rental Owners

```typescript
interface RentalOwners {
  owners: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    ownership_percentage: number;
  }>;
}
```

#### Property Reserve

```typescript
interface PropertyReserve {
  reserve_amount: number;
  reserve_currency: string;
}
```

#### Year Built

```typescript
interface YearBuilt {
  year_built: number;
}
```

#### Total Units

```typescript
interface TotalUnits {
  total_units: number;
  units_breakdown: {
    occupied: number;
    vacant: number;
    maintenance: number;
  };
}
```

#### Operating Account

```typescript
interface OperatingAccount {
  bank_account_id: string;
  account_name: string;
  account_number: string;
  routing_number: string;
}
```

#### Deposit Trust Account

```typescript
interface DepositTrustAccount {
  bank_account_id: string;
  account_name: string;
  account_number: string;
  routing_number: string;
}
```

#### Property Reserve

```typescript
interface PropertyReserve {
  reserve_amount: number;
  reserve_currency: string;
  reserve_purpose: string;
}
```

## Units Table

```typescript
interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string;
  square_footage: number;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
  is_occupied: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Buildium integration
  buildium_unit_id?: number; // Unique Buildium unit ID
  buildium_property_id?: number; // Parent Buildium property ID
  buildium_created_at?: string; // First-seen timestamp from Buildium
  buildium_updated_at?: string; // Last update timestamp from Buildium
}
```

## Financial Data

```typescript
interface FinancialData {
  total_income: number;
  total_expenses: number;
  net_income: number;
  occupancy_rate: number;
  average_rent: number;
  maintenance_costs: number;
  property_taxes: number;
  insurance_costs: number;
}
```

## Files Data

```typescript
interface FileData {
  id: string;
  entity_type: 'property' | 'unit' | 'owner' | 'lease';
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}
```

## Vendors Data

```typescript
interface VendorData {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: {
    address_line_1: string;
    city: string;
    state: string;
    postal_code: string;
  };
  category: string;
  is_active: boolean;
}
```

## Database Schema Enhancements

### Properties Table Additions Needed

```sql

ALTER TABLE properties ADD COLUMN IF NOT EXISTS:
  property_type VARCHAR(50),
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  year_built INTEGER,
  property_reserve DECIMAL(10,2),
  operating_bank_account_id UUID REFERENCES bank_accounts(id),
  deposit_trust_bank_account_id UUID REFERENCES bank_accounts(id);

```

### Units Table Additions Needed

```sql

ALTER TABLE units ADD COLUMN IF NOT EXISTS:
  unit_type VARCHAR(50),
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  -- Buildium integration columns (documented; may already exist in schema)
  buildium_unit_id BIGINT UNIQUE,
  buildium_property_id BIGINT;

```

### Properties Table (Buildium Columns)

```sql
-- Buildium integration columns (documented; may already exist in schema)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  buildium_property_id BIGINT UNIQUE,
  buildium_created_at TIMESTAMPTZ,
  buildium_updated_at TIMESTAMPTZ;
```

### New Tables Needed

```sql

-- Property Images
CREATE TABLE property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property Owners (Many-to-Many)
CREATE TABLE property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
  ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(property_id, owner_id)
);

-- Property Files
CREATE TABLE property_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address_line_1 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor Categories
CREATE TABLE vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT true
);

-- Bills
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  bill_number TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  category VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill Payments
CREATE TABLE bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

```

## Implementation Notes

- All monetary amounts should be stored as DECIMAL(10,2) for precision
- Use UUIDs for all primary keys for consistency
- Implement Row Level Security (RLS) policies for data protection
- Add appropriate indexes for performance optimization
- Consider implementing audit trails for important data changes
