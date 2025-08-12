# Supabase Migrations

This directory contains SQL migrations for the Ora Property Management database schema.

## Migration Files

### `001_create_properties_table.sql`
Creates the main Properties table with comprehensive schema including:

- **Enums**: `country_enum` and `rental_sub_type_enum`
- **Primary Key**: UUID with `gen_random_uuid()` default
- **Address Fields**: Complete address structure with validation
- **Business Fields**: Integration with Buildium, bank accounts, reserves
- **Constraints**: Data validation and business rules
- **Indexes**: Performance optimization for common queries
- **Triggers**: Automatic `updated_at` timestamp management
- **RLS**: Row Level Security enabled

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/cidfgplknvueaivsxiqa)
2. Navigate to **SQL Editor**
3. Copy and paste the migration SQL
4. Click **Run** to execute

### Option 2: Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref cidfgplknvueaivsxiqa

# Apply migrations
supabase db push
```

### Option 3: Direct Database Connection
```bash
# Connect to your Supabase database and run the SQL
psql "postgresql://postgres:[YOUR-PASSWORD]@db.cidfgplknvueaivsxiqa.supabase.co:5432/postgres"
```

## Schema Overview

### Properties Table
```sql
CREATE TABLE properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(127) NOT NULL,
    structure_description TEXT,
    address_line1 VARCHAR(100) NOT NULL,
    address_line2 VARCHAR(100),
    address_line3 VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country country_enum NOT NULL,
    buildium_property_id INTEGER,
    rental_sub_type rental_sub_type_enum NOT NULL,
    rental_owner_ids INTEGER[],
    operating_bank_account_id INTEGER NOT NULL,
    reserve NUMERIC(12,2),
    year_built INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Enums

#### Country Enum
Contains 200+ countries for international property support.

#### Rental Sub Type Enum
- `CondoTownhome` - Condominiums and townhomes
- `MultiFamily` - Multi-family residential properties
- `SingleFamily` - Single-family homes
- `Industrial` - Industrial properties
- `Office` - Office buildings
- `Retail` - Retail properties
- `ShoppingCenter` - Shopping centers and malls
- `Storage` - Storage facilities
- `ParkingSpace` - Parking spaces and lots

## Constraints and Validation

### Data Validation
- **Name**: Required, non-empty string, max 127 characters
- **Address**: Required address line 1 and postal code
- **Country**: Must match predefined enum values
- **Year Built**: Must be between 1000 and current year
- **Reserve**: Must be non-negative
- **Rental Sub Type**: Must match predefined enum values

### Business Rules
- **Operating Bank Account**: Required for financial operations
- **Buildium Integration**: Optional field for external system integration
- **Owner IDs**: Array of integers for multiple property owners

## Performance Optimizations

### Indexes Created
- Primary key index (automatic)
- Name search index
- Country filter index
- Rental sub-type filter index
- Address search composite index
- GIN index for owner IDs array
- Timestamp indexes for sorting

### Query Optimization
The schema is optimized for common property management queries:
- Property search by name
- Geographic filtering (city, state, country)
- Type-based filtering
- Owner relationship queries
- Date-based sorting and filtering

## Security

### Row Level Security (RLS)
- Enabled on all tables
- Basic policy allows all operations (customize based on auth requirements)
- Ready for user-based access control implementation

### Data Protection
- UUID primary keys for security
- Proper data types and constraints
- Input validation at database level

## TypeScript Integration

The schema is fully typed with TypeScript interfaces in `src/types/properties.ts`:

```typescript
import { Property, CountryEnum, RentalSubTypeEnum } from '@/types/properties';
```

## Next Steps

1. **Apply the migration** using one of the methods above
2. **Test the connection** using the test page at `/test-supabase`
3. **Create additional tables** as needed (Units, Tenants, Leases, etc.)
4. **Implement authentication** and customize RLS policies
5. **Add real-time subscriptions** for live updates

## Troubleshooting

### Common Issues
- **Enum values**: Ensure exact case matching for enum values
- **UUID generation**: Requires `uuid-ossp` extension (included in Supabase)
- **Array columns**: Use proper array syntax for `rental_owner_ids`
- **Timestamps**: All timestamps are in UTC with timezone information

### Support
For migration issues, check:
1. Supabase dashboard logs
2. Database connection settings
3. SQL syntax validation
4. Constraint violations in data
