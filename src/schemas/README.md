# Validation Schemas

This directory contains Zod validation schemas for all entities in the
Property Management System. These schemas provide type-safe validation for
API requests, form inputs, and data transformations.

## Overview

Each entity has its own schema file with the following structure:

- `{Entity}CreateSchema` - For creating new records
- `{Entity}UpdateSchema` - For updating existing records (partial)
- `{Entity}QuerySchema` - For querying records with filters
- `{Entity}WithDetailsQuerySchema` - For querying with related data

## Available Schemas

### Core Entities

- **`property.ts`** - Property management and details

- **`owner.ts`** - Property owners and contact information

- **`unit.ts`** - Individual units within properties

- **`staff.ts`** - Staff members and roles

- **`ownership.ts`** - Property ownership relationships

- **`bank-account.ts`** - Banking and trust accounts

- **`lease.ts`** - Lease agreements and terms

- **`tenant.ts`** - Tenant information and applications

## Usage Examples

### Basic Schema Usage

```typescript

import { PropertyCreateSchema, OwnerCreateSchema } from '@/schemas';

// Validate property creation data
const propertyData = {
  name: "Sunset Apartments",
  addressLine1: "123 Main St",
  city: "Los Angeles",
  state: "CA",
  postalCode: "90210",
  country: "USA",
  propertyType: "Mult-Family"
};

const validatedData = PropertyCreateSchema.parse(propertyData);

```

### API Route Usage

```typescript

import { OwnerCreateSchema } from '@/schemas';
import { sanitizeAndValidate } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = sanitizeAndValidate(body, OwnerCreateSchema);

  // data is now type-safe and validated
  const newOwner = await createOwner(data);
}

```

### Form Validation with React Hook Form

```typescript

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UnitCreateSchema, type UnitCreateInput } from '@/schemas';

export function AddUnitForm() {
  const form = useForm<UnitCreateInput>({
    resolver: zodResolver(UnitCreateSchema),
    defaultValues: {
      status: 'Available',
      rentCycle: 'MONTHLY'
    }
  });

  const onSubmit = (data: UnitCreateInput) => {
    // data is validated and type-safe
    createUnit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* form fields */}

    </form>
  );
}

```

### Query Parameters Validation

```typescript

import { PropertyQuerySchema } from '@/schemas';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = sanitizeAndValidate(Object.fromEntries(searchParams), PropertyQuerySchema);

  // query.limit, query.offset, query.search are validated
  const properties = await getProperties(query);
}

```

## Schema Features

### Type Safety

All schemas generate TypeScript types automatically:

```typescript

import type { PropertyCreateInput } from '@/schemas';

```

### Validation Rules

- **Required fields** - Must be provided

- **String lengths** - Maximum character limits

- **Number ranges** - Min/max values

- **Enums** - Predefined value sets

- **Email validation** - Format checking

- **Custom validation** - Business logic rules

### Business Logic Validation

Some schemas include custom business logic:

```typescript

// Ownership percentage validation
const OwnershipPercentageValidationSchema = z.object({
  propertyId: z.string(),
  ownerships: z.array(z.object({
    ownershipPercentage: z.number().min(0).max(100)
  }))
}).refine((data) => {
  const total = data.ownerships.reduce((sum, o) => sum + o.ownershipPercentage, 0);

  return total <= 100;
}, {
  message: "Total ownership percentage cannot exceed 100%"
});

```

## Best Practices

1. **Always validate input** - Use schemas for all user input

2. **Import from index** - Use `@/schemas` for clean imports

3. **Handle validation errors** - Provide user-friendly error messages

4. **Use partial schemas** - For updates, use `{Entity}UpdateSchema`

5. **Validate query parameters** - Use query schemas for API filters

## Error Handling

```typescript

import { ZodError } from 'zod';

try {
  const data = PropertyCreateSchema.parse(input);
} catch (error) {
  if (error instanceof ZodError) {
    // Handle validation errors
    const fieldErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
  }
}

```

## Extending Schemas

To add new validation rules:

```typescript

// Add custom validation
export const CustomPropertySchema = PropertyCreateSchema.extend({
  customField: z.string().min(1, "Custom field is required")
});

// Add conditional validation
export const ConditionalSchema = PropertyCreateSchema.refine(
  (data) => data.propertyType !== 'Mult-Family' || data.totalUnits > 1,
  {
    message: "Multi-family properties must have more than 1 unit",
    path: ["totalUnits"]
  }
);

```
