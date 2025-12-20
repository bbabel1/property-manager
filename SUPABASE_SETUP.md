# Supabase Setup Guide

This guide will help you connect your Ora Property Management application to Supabase.

## Prerequisites

1. A Supabase account (sign up via the [Supabase getting started guide](https://supabase.com/docs/guides/getting-started))
2. A Supabase project created

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**

3. Copy the following values:
   - **Project URL** (e.g., `https://your-project-ref.supabase.co`)

   - **anon public** key

   - **service_role** key (keep this secret!)

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:

   ```bash

   cp env.example .env.local
   ```

2. Update your `.env.local` file with your Supabase credentials:

   ```env

   # Supabase Configuration

   NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
   ```

## Step 3: Create Database Tables

You can create tables in Supabase using the SQL editor or the table interface. Here's an example SQL for the properties
table:

### Service Plans v2 migrations (important)

This repo uses SQL migrations in `supabase/migrations/` as the source of truth. If you are setting up a fresh/local DB or syncing schema changes to a linked project, make sure the following migrations are applied and then regenerate types:

- `supabase/migrations/20270127122000_backfill_service_plan_assignments_from_legacy.sql` — Backfilled `service_plan_assignments` from legacy columns
- `supabase/migrations/20270127123000_drop_legacy_management_fee_columns.sql` — Dropped legacy management-fee/service columns (kept `management_scope`, `service_assignment`, and `bill_pay_*`)

After applying migrations, regenerate Supabase types:

```bash
npm run types:local
npm run types:remote
```

Note: These two migrations have been applied to the remote database already.

```sql

-- Create properties table
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  type VARCHAR(100) NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  occupied_units INTEGER NOT NULL DEFAULT 0,
  available_units INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create owners table
CREATE TABLE owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create property_owners junction table
CREATE TABLE property_owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
  ownership_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(property_id, owner_id)
);

-- Create units table
CREATE TABLE units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  unit_number VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Available',
  rent_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenants table
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leases table
CREATE TABLE leases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rent_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

```

## Step 4: Set Up Row Level Security (RLS)

Enable RLS on your tables and create policies as needed:

```sql

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- Example policy for properties (allow all operations for now)
CREATE POLICY "Allow all operations on properties" ON properties
  FOR ALL USING (true);

```

## Step 5: Test the Connection

1. Start your development server:

   ```bash

   npm run dev
   ```

2. Visit `http://localhost:3000/api/properties` to test the API endpoint

## Usage Examples

### Using the Custom Hook

```tsx

import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'

// In your component
function PropertiesList() {
  const { data: properties, loading, error } = useSupabaseQuery('properties', {
    orderBy: { column: 'created_at', ascending: false }
  })

  const { insert, loading: insertLoading } = useSupabaseMutation()

  const addProperty = async () => {
    const newProperty = await insert('properties', {
      name: 'New Property',
      address: '123 Main St',
      type: 'Apartment',
      total_units: 10,
      occupied_units: 8,
      available_units: 2,
      status: 'Active'
    })

    if (newProperty) {
      console.log('Property added:', newProperty)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {properties.map(property => (
        <div key={property.id}>{property.name}</div>
      ))}
      <button onClick={addProperty} disabled={insertLoading}>
        Add Property
      </button>
    </div>
  )
}

```

### Direct Supabase Client Usage

```tsx

import { supabase } from '@/lib/supabase'

// Fetch data
const { data, error } = await supabase
  .from('properties')
  .select('*')

  .eq('status', 'Active')

// Insert data
const { data, error } = await supabase
  .from('properties')
  .insert([{ name: 'New Property', address: '123 Main St' }])
  .select()

// Update data
const { data, error } = await supabase
  .from('properties')
  .update({ status: 'Inactive' })
  .eq('id', 'property-id')
  .select()

// Delete data
const { error } = await supabase
  .from('properties')
  .delete()
  .eq('id', 'property-id')

```

## Next Steps

1. **Authentication**: Supabase Auth is the primary auth system. Ensure email/password or magic link are configured in `supabase/config.toml`.

2. **Real-time**: Enable real-time subscriptions for live updates

3. **Storage**: Use Supabase Storage for file uploads

4. **Edge Functions**: Create serverless functions for complex operations

## Troubleshooting

- **Connection errors**: Verify your environment variables are correct

- **RLS errors**: Check your Row Level Security policies

- **Type errors**: Generate TypeScript types from your Supabase schema

For more information, visit the [Supabase documentation](https://supabase.com/docs/guides/getting-started).
