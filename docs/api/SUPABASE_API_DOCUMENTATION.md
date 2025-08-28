# Supabase API Documentation

> **Last Updated**: 2025-08-28T04:46:19.623Z (Auto-generated)

> **Last Updated**: 2025-08-28T04:45:58.135Z (Auto-generated)

> **Last Updated**: 2025-08-28T04:18:24.943Z (Auto-generated)

> **Last Updated**: 2025-08-28T04:06:53.966Z (Auto-generated)

> **Last Updated**: 2025-08-28T04:06:39.317Z (Auto-generated)

> **Last Updated**: 2025-08-27T19:57:20.652Z (Auto-generated)

> **Last Updated**: 2025-08-27T19:37:08.494Z (Auto-generated)

> **Last Updated**: 2025-08-27T19:30:23.981Z (Auto-generated)

> **Last Updated**: 2025-08-27T19:18:27.916Z (Auto-generated)

> **Last Updated**: 2025-08-27T19:17:10.435Z (Auto-generated)

> **Last Updated**: 2025-08-22T19:00:28.555Z (Auto-generated)

## Overview

The Ora Property Management API is built using Next.js App Router API routes
with Supabase as the database layer. All endpoints use the Supabase client
for database operations, providing a clean separation between database logic
and API routing.

## Architecture

### Database Client Configuration

```typescript

// src/lib/db.ts
import { createClient } from '@supabase/supabase-js'

// Client-side operations (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side operations (API routes)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

```

### Authentication

- **Current State**: NextAuth SessionProvider (hybrid setup)

- **Database**: Supabase Auth configured but not actively used

- **API Security**: Service role key for admin operations

### Error Handling

All endpoints follow consistent error handling patterns:

```typescript

try {
  // Supabase operation
  const { data, error } = await supabaseAdmin.from('table').operation()

  if (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
} catch (error) {
  console.error('Unexpected error:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

```

## API Endpoints

### Properties API

#### `POST /api/properties`

Creates a new property with optional ownership and staff assignments.

**Request Body:**

```typescript

{
  // Required fields
  rentalSubType: RentalSubTypeEnum;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: CountryEnum;

  // Optional fields
  yearBuilt?: number;
  structureDescription?: string;
  operatingBankAccountId?: number;
  reserve?: number;
  propertyManagerId?: string;
  owners?: Array<{
    id: string;
    name: string;
    ownershipPercentage?: number;
    disbursementPercentage?: number;
    primary?: boolean;
  }>;
}

```

**Response:**

```typescript

// Success (201)
{
  message: "Property created successfully";
  property: Property;
}

// Error (400)
{
  error: "Missing required fields";
}

// Error (500)
{
  error: "Failed to create property" | "Failed to create ownership records";
}

```

**Database Operations:**

1. **Insert Property**: Creates main property record

2. **Create Ownership**: If owners provided, creates ownership relationships

3. **Update Primary Owner**: Sets primary owner name on property

4. **Assign Staff**: If propertyManagerId provided, creates staff assignment

**Business Logic:**

- Validates required fields before processing
- Converts camelCase request to snake_case database fields
- Creates ownership records with percentage validation
- Assigns property manager role automatically
- Handles partial failures (property created but ownership fails)

**Example Request:**

```bash

curl -X POST /api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments",
    "rentalSubType": "MultiFamily",
    "addressLine1": "123 Main St",
    "city": "Portland",
    "state": "OR",
    "postalCode": "97201",
    "country": "UnitedStates",
    "yearBuilt": 1995,
    "operatingBankAccountId": 1,
    "reserve": 5000.00,
    "owners": [
      {
        "id": "owner-uuid-1",
        "name": "John Smith",
        "ownershipPercentage": 60,
        "disbursementPercentage": 60,
        "primary": true
      },
      {
        "id": "owner-uuid-2",
        "name": "Jane Doe",
        "ownershipPercentage": 40,
        "disbursementPercentage": 40
      }
    ]
  }'

```

#### `GET /api/properties`

Retrieves all properties with related data using Supabase joins.

**Response:**

```typescript

// Success (200)
Array<{
  // Property fields
  id: string;
  name: string;
  rental_sub_type: RentalSubTypeEnum;
  address_line1: string;
  // ... other property fields

  // Related data via joins
  ownership: Array<{
    id: string;
    ownership_percentage: number;
    disbursement_percentage: number;
    primary: boolean;
    owners: {
      id: string;
      first_name: string;
      last_name: string;
      company_name: string;
      // ... other owner fields
    };
  }>;

  bank_accounts: {
    id: string;
    name: string;
    account_number: string;
    // ... other bank account fields
  };

  property_staff: Array<{
    id: string;
    role: string;
    staff: {
      id: string;
      name: string;
      // ... other staff fields
    };
  }>;
}>

// Error (500)
{
  error: "Failed to fetch properties";
}

```

**Database Query:**

```typescript

const { data: properties, error } = await supabaseAdmin
  .from('properties')
  .select(`
    *,

    ownership!property_id (
      *,

      owners!owner_id (*)

    ),
    bank_accounts!operating_bank_account_id (*),

    property_staff!property_id (
      *,

      staff!staff_id (*)

    )
  `)

```

**Features:**

- **Complex Joins**: Retrieves related owners, bank accounts, and staff

- **Nested Data**: Ownership records include full owner information

- **Efficient Queries**: Single query returns comprehensive property data

## Database Schema Integration

### Supabase Client Patterns

**Basic CRUD Operations:**

```typescript

// Create
const { data, error } = await supabaseAdmin
  .from('table_name')
  .insert(record)
  .select()
  .single()

// Read with filters
const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('*')

  .eq('field', value)
  .limit(10)

// Update
const { data, error } = await supabaseAdmin
  .from('table_name')
  .update(changes)
  .eq('id', recordId)
  .select()

// Delete
const { error } = await supabaseAdmin
  .from('table_name')
  .delete()
  .eq('id', recordId)

```

**Advanced Joins:**

```typescript

// Many-to-many relationships
const { data } = await supabaseAdmin
  .from('properties')
  .select(`
    name,
    ownership!inner (
      ownership_percentage,
      owners!inner (
        first_name,
        last_name
      )
    )
  `)

```

### Row Level Security (RLS)

All tables have RLS enabled with basic policies:

```sql

-- Current policy (allow all - needs refinement)
CREATE POLICY "Allow all operations on properties" ON properties
    FOR ALL USING (true);

```

**Future RLS Implementation:**

```sql

-- Example user-based policy
CREATE POLICY "Users can only see their properties" ON properties
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM ownership o
        JOIN owners ow ON o.owner_id = ow.id
        WHERE o.property_id = properties.id
        AND ow.auth_user_id = auth.uid()
      )
    );

```

## Data Validation

### Client-Side Validation

```typescript

// Type definitions ensure compile-time validation
interface CreatePropertyRequest {
  name: string;
  rental_sub_type: RentalSubTypeEnum;
  // ... other fields with proper types
}

```

### Database Constraints

```sql

-- Properties table constraints
CHECK (name != ''),
CHECK (postal_code != ''),
CHECK (reserve >= 0),
CHECK (year_built >= 1000 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE))

-- Ownership table constraints
CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
CHECK (disbursement_percentage >= 0 AND disbursement_percentage <= 100)

```

### API-Level Validation

```typescript

// Required field validation
if (!rentalSubType || !name || !addressLine1 || !city || !state || !postalCode || !country) {
  return NextResponse.json(
    { error: 'Missing required fields' },
    { status: 400 }
  )
}

// Type conversion with validation
const reserve = reserve ? parseFloat(reserve.toString()) : null;
const yearBuilt = yearBuilt ? parseInt(yearBuilt) : null;

```

## Future API Endpoints

Based on the database schema, additional endpoints will be needed:

### Owners API

- `GET /api/owners` - List all owners
- `POST /api/owners` - Create new owner
- `PUT /api/owners/[id]` - Update owner
- `DELETE /api/owners/[id]` - Remove owner

### Units API

- `GET /api/properties/[id]/units` - Get units for property
- `POST /api/units` - Create new unit
- `PUT /api/units/[id]` - Update unit
- `DELETE /api/units/[id]` - Remove unit

### Bank Accounts API

- `GET /api/bank-accounts` - List bank accounts
- `POST /api/bank-accounts` - Create bank account
- `PUT /api/bank-accounts/[id]` - Update bank account

### Ownership API

- `GET /api/properties/[id]/ownership` - Get ownership for property
- `POST /api/ownership` - Create ownership relationship
- `PUT /api/ownership/[id]` - Update ownership percentages

## Performance Considerations

### Indexing Strategy

All frequently queried columns have indexes:

```sql

-- Property indexes for common queries
CREATE INDEX idx_properties_name ON properties(name);
CREATE INDEX idx_properties_rental_sub_type ON properties(rental_sub_type);
CREATE INDEX idx_properties_city ON properties(city);

-- Composite indexes for complex queries
CREATE INDEX idx_properties_address_search ON properties(city, state, postal_code, country);

```

### Query Optimization

- Use `select()` to specify exact fields needed
- Implement pagination for large datasets
- Use `single()` when expecting one result
- Leverage Supabase's built-in query optimization

### Caching Strategy

```typescript

// Future implementation with Next.js caching
export async function GET() {
  const properties = await unstable_cache(
    async () => {
      const { data } = await supabaseAdmin.from('properties').select('*')

      return data
    },
    ['properties-list'],
    { revalidate: 300 } // 5 minutes
  )()

  return NextResponse.json(properties)
}

```

## Security Best Practices

### Environment Variables

```bash

# Required environment variables

NEXT_PUBLIC_SUPABASE_URL="https://project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="secret-service-role-key"

```

### Service Role Usage

- Use `supabaseAdmin` only in API routes (server-side)
- Never expose service role key to client
- Implement proper RLS policies before production

### Data Sanitization

```typescript

// Sanitize and validate all inputs
const sanitizedData = {
  name: sanitizeString(name),
  reserve: validateCurrency(reserve),
  year_built: validateYear(yearBuilt)
}

```

## Error Codes Reference

| Status | Error | Description |
|--------|-------|-------------|
| 200 | - | Success |
| 201 | - | Resource created |
| 400 | Missing required fields | Required fields not provided |
| 400 | Invalid data format | Data validation failed |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Resource not found | Requested resource doesn't exist |
| 409 | Conflict | Duplicate resource or constraint violation |
| 500 | Internal server error | Unexpected server error |
| 500 | Database error | Supabase operation failed |

## Testing Examples

### Unit Tests (Future)

```typescript

describe('/api/properties', () => {
  it('should create property with owners', async () => {
    const response = await request(app)
      .post('/api/properties')
      .send(mockPropertyData)
      .expect(201)

    expect(response.body.property).toHaveProperty('id')
    expect(response.body.message).toBe('Property created successfully')
  })
})

```

### Integration Tests (Future)

```typescript

describe('Property creation flow', () => {
  it('should create property and ownership records', async () => {
    // Test full workflow including database operations
    const property = await createProperty(mockData)
    const ownership = await getOwnership(property.id)

    expect(ownership).toHaveLength(2)
    expect(ownership[0].primary).toBe(true)
  })
})

```

This API documentation reflects the current Supabase-based implementation and provides guidance for future development
as the system continues to evolve.
