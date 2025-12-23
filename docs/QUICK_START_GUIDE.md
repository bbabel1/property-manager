# Quick Start Guide - Property Management System

> **Last Updated**: 2025-08-25
>
> This guide provides step-by-step instructions for new users to add properties, units, owners, leases, and other entities in the correct sequence.

## 🚀 Getting Started

### Prerequisites

- Supabase project configured and linked
- Buildium API credentials set in `.env` file
- Node.js and npm installed

### Environment Setup

Ensure your `.env` file contains:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
```

## 📋 Complete Workflow: Adding a New Property

### Step 1: Create Property

**Purpose**: Create the main property entity that will contain units and be owned by owners.

**API Endpoint**: `POST /api/properties`

**Request Body**:

```json
{
  "name": "123 Main Street Apartments",
  "address_line1": "123 Main Street",
  "address_line2": "Suite 100",
  "city": "Anytown",
  "state": "CA",
  "postal_code": "12345",
  "country": "US",
  "property_type": "Mult-Family",
  "operating_bank_account_id": 123,
  "reserve": 5000.0,
  "year_built": 2020
}
```

**Response**:

```json
{
  "message": "Property created successfully",
  "property": {
    "id": "uuid-here",
    "name": "123 Main Street Apartments",
    "buildium_property_id": 456,
    "buildiumSync": {
      "success": true,
      "buildiumId": 456,
      "error": null
    }
  }
}
```

### Step 2: Add Units to Property

**Purpose**: Create individual rental units within the property.

**API Endpoint**: `POST /api/units`

**Request Body**:

```json
{
  "property_id": "property-uuid-from-step-1",
  "unit_number": "A1",
  "bedrooms": 2,
  "bathrooms": 1,
  "square_footage": 850,
  "market_rent": 1200.0,
  "unit_type": "Apartment"
}
```

**Response**:

```json
{
  "message": "Unit created successfully",
  "unit": {
    "id": "unit-uuid-here",
    "unit_number": "A1",
    "buildium_unit_id": 789,
    "buildiumSync": {
      "success": true,
      "buildiumId": 789,
      "error": null
    }
  }
}
```

### Step 3: Create Owners

**Purpose**: Create property owners (individuals or companies) who will own the property.

**API Endpoint**: `POST /api/owners`

**For Individual Owner**:

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "(555) 123-4567",
  "is_company": false,
  "tax_payer_id": "123-45-6789",
  "tax_payer_type": "SSN",
  "tax_payer_name1": "John Doe",
  "tax_address_line1": "456 Owner Street",
  "tax_city": "Owner City",
  "tax_state": "CA",
  "tax_postal_code": "54321",
  "tax_country": "US"
}
```

**For Company Owner**:

```json
{
  "company_name": "Doe Properties LLC",
  "email": "info@doeproperties.com",
  "phone": "(555) 987-6543",
  "is_company": true,
  "tax_payer_id": "12-3456789",
  "tax_payer_type": "EIN",
  "tax_payer_name1": "Doe Properties LLC",
  "tax_address_line1": "789 Business Ave",
  "tax_city": "Business City",
  "tax_state": "CA",
  "tax_postal_code": "67890",
  "tax_country": "US"
}
```

### Step 4: Create Ownership Relationships

**Purpose**: Link owners to properties with ownership percentages and income distribution rights.

**API Endpoint**: `POST /api/ownership`

**Request Body**:

```json
{
  "owner_id": "owner-uuid-from-step-3",
  "property_id": "property-uuid-from-step-1",
  "ownership_percentage": 100.0,
  "disbursement_percentage": 100.0,
  "primary": true
}
```

### Step 5: Create Tenants

**Purpose**: Create tenant records for individuals who will rent units.

**API Endpoint**: `POST /api/tenants`

**Request Body**:

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "(555) 111-2222",
  "date_of_birth": "1990-01-15",
  "emergency_contact_name": "Bob Smith",
  "emergency_contact_phone": "(555) 333-4444",
  "emergency_contact_relationship": "Spouse"
}
```

### Step 6: Create Lease

**Purpose**: Create a lease agreement between the property and tenants.

**API Endpoint**: `POST /api/leases`

**Request Body**:

```json
{
  "property_id": "property-uuid-from-step-1",
  "unit_id": "unit-uuid-from-step-2",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "monthly_rent": 1200.0,
  "security_deposit": 1200.0,
  "lease_status": "Active",
  "rent_cycle": "Monthly"
}
```

### Step 7: Link Tenants to Lease

**Purpose**: Connect tenants to the lease as lease contacts.

**API Endpoint**: `POST /api/lease-contacts`

**Request Body**:

```json
{
  "lease_id": "lease-uuid-from-step-6",
  "tenant_id": "tenant-uuid-from-step-5",
  "role": "Tenant",
  "is_primary": true,
  "move_in_date": "2025-01-01"
}
```

### Step 8: Create Rent Schedule

**Purpose**: Set up recurring rent charges for the lease.

**API Endpoint**: `POST /api/rent-schedules`

**Request Body**:

```json
{
  "lease_id": "lease-uuid-from-step-6",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "total_amount": 1200.0,
  "rent_cycle": "Monthly",
  "backdate_charges": false
}
```

## 🔄 Buildium Integration

### Automatic Sync

- Properties, units, owners, and leases are automatically synced to Buildium when created
- Check the `buildiumSync` field in API responses for sync status
- Failed syncs can be retried using the sync management API

### Manual Sync

If automatic sync fails, you can manually sync:

**API Endpoint**: `POST /api/buildium/sync`

**Request Body**:

```json
{
  "entity_type": "properties",
  "entity_id": "property-uuid"
}
```

## 🛠️ Common Operations

### Adding Multiple Units

Repeat Step 2 for each unit in the property:

```json
{
  "property_id": "same-property-uuid",
  "unit_number": "A2",
  "bedrooms": 1,
  "bathrooms": 1,
  "market_rent": 1000.0
}
```

### Adding Multiple Owners

Repeat Steps 3-4 for each owner, adjusting ownership percentages:

```json
{
  "owner_id": "second-owner-uuid",
  "property_id": "property-uuid",
  "ownership_percentage": 50.0,
  "disbursement_percentage": 50.0,
  "primary": false
}
```

### Adding Multiple Tenants to Lease

Repeat Step 7 for each tenant on the lease:

```json
{
  "lease_id": "same-lease-uuid",
  "tenant_id": "second-tenant-uuid",
  "role": "Tenant",
  "is_primary": false,
  "move_in_date": "2025-01-01"
}
```

## 📊 Data Relationships

### Entity Hierarchy

```
Property
├── Units (one-to-many)
├── Owners (many-to-many via ownership table)
└── Leases (one-to-many)
    ├── Tenants (many-to-many via lease_contacts table)
    └── Rent Schedules (one-to-many)
```

### Key Relationships

- **Property → Units**: One property can have multiple units
- **Property ↔ Owners**: Many-to-many relationship with ownership percentages
- **Unit → Lease**: One unit can have one active lease at a time
- **Lease → Tenants**: Many tenants can be on one lease
- **Lease → Rent Schedule**: One lease can have multiple rent schedules

## 🚨 Important Notes

### Data Validation

- All required fields must be provided
- Email addresses must be valid format
- Phone numbers should include area code
- Dates must be in YYYY-MM-DD format
- Percentages must be between 0 and 100

### Buildium Sync

- Sync happens automatically but may fail due to network issues
- Check sync status in API responses
- Failed syncs don't prevent local operations
- Manual retry available for failed syncs

### Ownership Rules

- Total ownership percentage should equal 100% for all owners of a property
- Only one owner can be marked as primary per property
- Ownership and disbursement percentages can be different

## 🔧 Troubleshooting

### Common Issues

**1. Property Creation Fails**

- Check that operating_bank_account_id exists
- Ensure all required address fields are provided
- Verify property_type is valid

**2. Unit Creation Fails**

- Ensure property_id exists and is valid
- Check that unit_number is unique within the property
- Verify bedroom/bathroom counts are valid

**3. Owner Creation Fails**

- Check tax_payer_id format (SSN: XXX-XX-XXXX, EIN: XX-XXXXXXX)
- Ensure email is unique
- Verify tax address is complete

**4. Lease Creation Fails**

- Ensure property_id and unit_id exist
- Check that unit is not already leased
- Verify dates are valid and end_date > start_date

**5. Buildium Sync Fails**

- Check Buildium API credentials
- Verify network connectivity
- Check Buildium API status
- Retry sync manually if needed

### Getting Help

- Check API response error messages
- Review database schema documentation
- Consult Buildium integration guides
- Check sync status for Buildium-related issues

## 📚 Additional Resources

- [Database Schema Documentation](./database/DATABASE_SCHEMA.md)
- [Business Logic Documentation](./architecture/BUSINESS_LOGIC_DOCUMENTATION.md)
- [Buildium Integration Guide](./buildium-integration-guide.md)
- [API Documentation](./api/api-documentation.md)
- [Script Organization Guide](./SCRIPTS_ORGANIZATION.md)
