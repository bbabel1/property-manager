# Supabase Queries for Property Details Page

This document shows the exact Supabase queries being executed when loading a property details page.

## Query Execution Flow

When a user visits `/properties/[id]`, the following queries are executed:

### 1. Property Details Query

```sql

-- Query executed in PropertyService.getPropertyById()
SELECT * FROM properties WHERE id = $1 LIMIT 1;

-- Example with actual ID:
SELECT * FROM properties WHERE id = 'c21aee3e-54f3-4b02-8966-cfdf2a9e348d' LIMIT 1;

```

**Returns:**

```json

{
  "id": "c21aee3e-54f3-4b02-8966-cfdf2a9e348d",
  "name": "Sunset Apartments",
  "address_line1": "123 Main Street",
  "address_line2": "Suite 100",
  "address_line3": null,
  "city": "Los Angeles",
  "state": "CA",
  "postal_code": "90210",
  "country": "USA",
  "rental_sub_type": "Apartment",
  // "primary_owner": "John Smith", // removed - now determined from ownerships table
  "status": "Active",
  "reserve": 200.00,
  "year_built": 2010,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z"
}

```

### 2. Units Query

```sql

-- Query executed in PropertyService.getPropertyById()
SELECT * FROM units WHERE property_id = $1 ORDER BY unit_number;

-- Example with actual ID:
SELECT * FROM units WHERE property_id = 'c21aee3e-54f3-4b02-8966-cfdf2a9e348d' ORDER BY unit_number;

```

**Returns:**

```json

[
  {
    "id": "unit-1",
    "property_id": "c21aee3e-54f3-4b02-8966-cfdf2a9e348d",
    "unit_number": "101",
    "unit_size": 750,
    "market_rent": 1800,
    "address_line1": "123 Main Street",
    "address_line2": "Unit 101",
    "address_line3": null,
    "city": "Los Angeles",
    "state": "CA",
    "postal_code": "90210",
    "country": "USA",
    "unit_bedrooms": "1",
    "unit_bathrooms": "1",
    "description": "1 Bedroom Apartment",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "unit-2",
    "property_id": "c21aee3e-54f3-4b02-8966-cfdf2a9e348d",
    "unit_number": "102",
    "unit_size": 950,
    "market_rent": 2200,
    "address_line1": "123 Main Street",
    "address_line2": "Unit 102",
    "address_line3": null,
    "city": "Los Angeles",
    "state": "CA",
    "postal_code": "90210",
    "country": "USA",
    "unit_bedrooms": "2",
    "unit_bathrooms": "1",
    "description": "2 Bedroom Apartment",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]

```

### 3. Ownership Query (with Join)

```sql

-- Query executed in PropertyService.getPropertyById()
SELECT *, owners(*) FROM ownerships WHERE property_id = $1;

-- Example with actual ID:
SELECT *, owners(*) FROM ownerships WHERE property_id = 'c21aee3e-54f3-4b02-8966-cfdf2a9e348d';

```

**Returns:**

```json

[
  {
    "id": "ownership-1",
    "primary": true,
    "ownership_percentage": 100,
    "disbursement_percentage": 100,
    "owner_name": "John Smith",
    "owner_id": "owner-1",
    "property_id": "c21aee3e-54f3-4b02-8966-cfdf2a9e348d",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "owners": {
      "id": "owner-1",
      "first_name": "John",
      "last_name": "Smith",
      "is_company": false,
      "company_name": null,
      "email": "john.smith@email.com",
      "phone_mobile": "(555) 123-4567",
      "phone_home": "(555) 987-6543",
      "address_line1": "456 Owner Street",
      "city": "Los Angeles",
      "state": "CA",
      "postal_code": "90211",
      "country": "USA",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
]

```

## Data Processing

After the queries return, the data is processed:

### 1. Units Summary Calculation

```typescript

const units_summary = {
  total: units?.length || 0,        // 2
  occupied: 0,                      // Would need lease data
  available: units?.length || 0     // 2
}

```

### 2. Occupancy Rate Calculation

```typescript

const occupancy_rate = units_summary.total > 0
  ? Math.round((units_summary.occupied / units_summary.total) * 100)

  : 0;  // 0% (since occupied = 0)

```

### 3. Owners Count

```typescript

const total_owners = ownership?.length || 0;  // 1

```

### 4. Final PropertyWithDetails Object

```typescript

{
  // From properties table
  id: "c21aee3e-54f3-4b02-8966-cfdf2a9e348d",
  name: "Sunset Apartments",
  address_line1: "123 Main Street",
  city: "Los Angeles",
  state: "CA",
  postal_code: "90210",
  rental_sub_type: "Apartment",
  // primary_owner: "John Smith", // removed - now determined from ownerships table
  status: "Active",
  reserve: 200.00,
  year_built: 2010,

  // From units table
  units: [/* array of 2 units */],

  // From ownership table
  owners: [/* array of 1 owner */],

  // Calculated fields
  units_summary: { total: 2, occupied: 0, available: 2 },
  occupancy_rate: 0,
  total_owners: 1,

  // Flag
  isMockData: false
}

```

## Error Handling

If any query fails:

```typescript

// Property query fails
if (propertyError || !property) {
  return { ...MOCK_PROPERTY, id, isMockData: true };
}

// Units query fails
if (unitsError) {
  console.error('Error fetching units:', unitsError);
  // Continue with empty units array
}

// Ownership query fails
if (ownershipError) {
  console.error('Error fetching ownership:', ownershipError);
  // Continue with empty owners array
}

```

## Performance Considerations

### Current Queries

- **3 separate queries** executed sequentially

- **No pagination** for units (could be large)

- **No caching** implemented

### Optimization Opportunities

```sql

-- Single query with joins (if needed)
SELECT
  p.*,

  json_agg(DISTINCT u.*) as units,

  json_agg(DISTINCT o.*) as ownership

FROM properties p
LEFT JOIN units u ON p.id = u.property_id
LEFT JOIN ownerships o ON p.id = o.property_id
WHERE p.id = $1
GROUP BY p.id;

```

## Mock Data Fallback

When Supabase is not available, mock data is returned:

```typescript

if (!supabase) {
  return { ...MOCK_PROPERTY, id, isMockData: true };
}

```

This ensures the UI always has data to display, even without a database connection.
