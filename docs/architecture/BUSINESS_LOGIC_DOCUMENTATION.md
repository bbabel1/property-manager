# Property Management Business Logic Documentation

> **Last Updated**: 2025-08-22T19:00:28.562Z (Auto-generated)

## Overview

This document outlines the core business logic implemented in the Ora Property Management system, focusing on multi-owner property management, financial calculations, and property-unit relationships.

## Core Business Entities

### 1. Properties (`properties` table)

**Primary Entity**: Central to the entire system, representing rental properties.

**Key Business Rules:**

- Each property must have a unique name and complete address
- Properties require an operating bank account for financial operations
- Optional reserve funds for unexpected expenses (non-disbursable cash)
- Integration with Buildium property management system
- Support for international addresses with country validation
- Year built validation (1000 to current year)

**Schema Highlights:**

```sql
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(127) NOT NULL,
  rental_sub_type rental_sub_type_enum NOT NULL,
  operating_bank_account_id INTEGER NOT NULL,
  reserve NUMERIC(12,2) CHECK (reserve >= 0),
  -- Address fields with validation
  -- Integration fields
  -- Timestamps
);
```

**Property Types:**

- `CondoTownhome` - Condominium and townhome properties
- `MultiFamily` - Apartment buildings and multi-unit properties  
- `SingleFamily` - Single-family rental homes
- `Industrial` - Industrial rental properties
- `Office` - Commercial office space
- `Retail` - Retail and commercial space
- `ShoppingCenter` - Shopping centers and malls
- `Storage` - Storage facilities
- `ParkingSpace` - Parking space rentals

### 2. Multi-Owner Support (`owners` + `ownership` tables)

**Business Model**: Properties can have multiple owners with different ownership stakes and income distribution rights.

**Owner Types:**

- **Individual Owners**: `is_company = false`
  - Requires first_name OR last_name
  - Personal tax information (SSN)
- **Company Owners**: `is_company = true`
  - Requires company_name
  - Business tax information (EIN)

**Ownership Structure:**

```sql
CREATE TABLE ownership (
  owner_id UUID REFERENCES owners(id),
  property_id UUID REFERENCES properties(id), 
  ownership_percentage NUMERIC(5,2) CHECK (0 <= ownership_percentage <= 100),
  disbursement_percentage NUMERIC(5,2) CHECK (0 <= disbursement_percentage <= 100),
  primary BOOLEAN DEFAULT false
);
```

**Key Business Rules:**

1. **Ownership Percentage**: Represents actual equity stake (0-100%)
2. **Disbursement Percentage**: Controls income distribution (0-100%)
3. **Primary Owner**: One owner per property can be designated as primary
4. **Independent Percentages**: Ownership ≠ Disbursement (allows complex arrangements)

**Business Logic Examples:**

#### Example 1: Equal Ownership, Unequal Distribution

```typescript
// Property with 2 owners, equal ownership, unequal income distribution
const ownership = [
  { owner_id: "owner-a", ownership_percentage: 50, disbursement_percentage: 70 },
  { owner_id: "owner-b", ownership_percentage: 50, disbursement_percentage: 30 }
];
// Owner A gets 70% of rental income despite 50% ownership
```

#### Example 2: Management Company Arrangement

```typescript
// Property owner + management company
const ownership = [
  { owner_id: "property-owner", ownership_percentage: 100, disbursement_percentage: 90, primary: true },
  { owner_id: "mgmt-company", ownership_percentage: 0, disbursement_percentage: 10 }
];
// Management company gets 10% of income with no equity stake
```

### 3. Units (`units` table)

**Business Model**: Properties contain individual rental units with specific characteristics.

**Unit Classification:**

- **Bedrooms**: `Studio`, `OneBed`, `TwoBed`, ..., `NineBedPlus`
- **Bathrooms**: `OneBath`, `OnePointFiveBath`, ..., `FivePlusBath`
- **Market Rent**: Expected rental income per unit
- **Unit Size**: Square footage

**Key Relationships:**

- Each unit belongs to exactly one property (`property_id` FK)
- Units inherit property address but can have unit-specific address lines
- Units can have different market rents within the same property

### 4. Financial Architecture

**Bank Accounts (`bank_accounts` table):**

- **Operating Accounts**: Primary accounts for property income/expenses
- **Reserve Funds**: Property-level cash reserves (non-distributable)
- **Check Printing**: Multiple layouts and configurations
- **Integration**: Buildium bank account linking

**Financial Flow:**

```text
Rental Income → Operating Bank Account → (Reserve Allocation) → Owner Distributions
```

**Reserve Fund Logic:**

- Maintained at property level
- Not included in owner distributions  
- Used for unexpected expenses
- Decimal precision to 2 places for accurate accounting

### 5. Tax Information Management

**Individual Owners:**

- Tax ID Type: `SSN`
- Personal tax information
- Tax address (can differ from primary address)

**Business Owners:**

- Tax ID Type: `EIN`
- Business tax information  
- Corporate tax address

**Validation Rules:**

```sql
CHECK (
  (tax_payer_id IS NULL AND tax_payer_type IS NULL) OR
  (tax_payer_id IS NOT NULL AND tax_payer_type IS NOT NULL)
)
```

## Financial Calculation Examples

### Owner Distribution Calculation

```typescript
async function calculateOwnerDistributions(propertyId: string, netIncome: number) {
  // Get ownership records for property
  const { data: ownerships } = await supabase
    .from('ownership')
    .select('owner_id, disbursement_percentage, owners(*)')
    .eq('property_id', propertyId);

  // Get property reserve allocation
  const { data: property } = await supabase
    .from('properties')
    .select('reserve')
    .eq('id', propertyId)
    .single();

  // Calculate distributable income (after reserve)
  const reserveAllocation = property.reserve || 0;
  const distributableIncome = netIncome - reserveAllocation;

  // Calculate distributions based on percentages
  return ownerships.map(ownership => ({
    owner: ownership.owners,
    distribution: distributableIncome * (ownership.disbursement_percentage / 100)
  }));
}
```

### Property Valuation Logic

```typescript
async function calculatePropertyValue(propertyId: string) {
  // Get all units and their market rents
  const { data: units } = await supabase
    .from('units')
    .select('market_rent')
    .eq('property_id', propertyId);

  // Calculate annual gross rent
  const monthlyRent = units.reduce((sum, unit) => sum + (unit.market_rent || 0), 0);
  const annualGrossRent = monthlyRent * 12;

  // Apply market cap rate (business rule: typically 6-10%)
  const capRate = 0.08; // 8% example
  const estimatedValue = annualGrossRent / capRate;

  return {
    monthlyRent,
    annualGrossRent,
    estimatedValue,
    capRate
  };
}
```

## Data Integrity Constraints

### Database-Level Constraints

```sql
-- Ensure ownership percentages are valid
ALTER TABLE ownership ADD CONSTRAINT check_ownership_percentages 
    CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100);

-- Ensure disbursement percentages are valid  
ALTER TABLE ownership ADD CONSTRAINT check_disbursement_percentages 
    CHECK (disbursement_percentage >= 0 AND disbursement_percentage <= 100);

-- Prevent duplicate owner-property relationships
CREATE UNIQUE INDEX idx_ownership_owner_property ON ownership(owner_id, property_id);

-- Individual vs company owner validation
ALTER TABLE owners ADD CONSTRAINT check_individual_owner_names 
    CHECK (
        (is_company = false AND (first_name IS NOT NULL OR last_name IS NOT NULL)) OR
        (is_company = true AND company_name IS NOT NULL)
    );
```

### Business Logic Validation

```typescript
// Validate total ownership percentages don't exceed 100%
function validateOwnershipPercentages(ownerships: Ownership[]): boolean {
  const totalOwnership = ownerships.reduce((sum, o) => sum + o.ownership_percentage, 0);
  return totalOwnership <= 100;
}

// Validate disbursement percentages equal 100%
function validateDisbursementPercentages(ownerships: Ownership[]): boolean {
  const totalDisbursement = ownerships.reduce((sum, o) => sum + o.disbursement_percentage, 0);
  return Math.abs(totalDisbursement - 100) < 0.01; // Allow for rounding
}
```

## Integration Points

### Buildium Integration

- Property mapping via `buildium_property_id`
- Owner synchronization via `rental_owner_ids` array
- Bank account linking via `buildium_bank_id`

### International Support

- 200+ country enum support
- Address format validation
- Multi-currency potential (currently USD focused)

## Business Rules Summary

1. **Property Management**:
   - Every property requires an operating bank account
   - Reserve funds are property-level and non-distributable
   - Properties can have multiple units with independent rents

2. **Ownership Management**:
   - Multiple owners per property supported
   - Ownership % ≠ Disbursement % (allows complex arrangements)
   - Only one primary owner per property
   - Individual and business owner support with appropriate tax handling

3. **Financial Management**:
   - Income flows through operating bank accounts
   - Reserve allocation before owner distributions
   - Precise decimal calculations for financial accuracy
   - Check printing capabilities for expense management

4. **Data Integrity**:
   - UUID-based primary keys for scalability
   - Comprehensive constraints and validation
   - Row-level security for multi-tenant support
   - Automatic timestamp management

This business logic supports complex property management scenarios while maintaining data integrity and providing flexibility for various ownership structures.
