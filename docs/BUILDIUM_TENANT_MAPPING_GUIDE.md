# Buildium Tenant Mapping Guide

> **Last Updated**: 2025-01-15
>
> This guide documents the complete tenant mapping implementation from Buildium API to local database.

## Overview

The tenant mapping system handles the conversion of Buildium tenant data to local database format, including:

- **Contact creation/updates** in the `contacts` table
- **Tenant record creation/updates** in the `tenants` table
- **Lease relationship management** via `lease_contacts` table
- **Automatic duplicate detection** and field updates

## Field Mappings

### Buildium Tenant → Database Contacts Table

| Buildium Field                   | Database Field           | Type | Notes                                 |
| -------------------------------- | ------------------------ | ---- | ------------------------------------- |
| `FirstName`                      | `first_name`             | TEXT | Required field                        |
| `LastName`                       | `last_name`              | TEXT | Required field                        |
| `Email`                          | `primary_email`          | TEXT | Used for duplicate detection          |
| `AlternateEmail`                 | `alt_email`              | TEXT | Optional                              |
| `DateOfBirth`                    | `date_of_birth`          | DATE | Converted from ISO string             |
| `PhoneNumbers[].Type === 'Cell'` | `primary_phone`          | TEXT | Mobile phone preferred                |
| `PhoneNumbers[].Type === 'Home'` | `primary_phone`          | TEXT | Fallback if no mobile                 |
| `PhoneNumbers[].Type === 'Work'` | `alt_phone`              | TEXT | Work phone                            |
| `Address.AddressLine1`           | `primary_address_line_1` | TEXT | Primary address                       |
| `Address.AddressLine2`           | `primary_address_line_2` | TEXT | Optional                              |
| `Address.AddressLine3`           | `primary_address_line_3` | TEXT | Optional                              |
| `Address.City`                   | `primary_city`           | TEXT | Primary city                          |
| `Address.State`                  | `primary_state`          | TEXT | Primary state                         |
| `Address.PostalCode`             | `primary_postal_code`    | TEXT | Primary postal code                   |
| `Address.Country`                | `primary_country`        | ENUM | Mapped via `mapCountryFromBuildium()` |
| `AlternateAddress.AddressLine1`  | `alt_address_line_1`     | TEXT | Alternate address                     |
| `AlternateAddress.AddressLine2`  | `alt_address_line_2`     | TEXT | Optional                              |
| `AlternateAddress.AddressLine3`  | `alt_address_line_3`     | TEXT | Optional                              |
| `AlternateAddress.City`          | `alt_city`               | TEXT | Alternate city                        |
| `AlternateAddress.State`         | `alt_state`              | TEXT | Alternate state                       |
| `AlternateAddress.PostalCode`    | `alt_postal_code`        | TEXT | Alternate postal code                 |
| `AlternateAddress.Country`       | `alt_country`            | ENUM | Mapped via `mapCountryFromBuildium()` |
| `MailingPreference`              | `mailing_preference`     | TEXT | Default: 'primary'                    |

### Buildium Tenant → Database Tenants Table

| Buildium Field                             | Database Field                   | Type    | Notes                      |
| ------------------------------------------ | -------------------------------- | ------- | -------------------------- |
| `Id`                                       | `buildium_tenant_id`             | INTEGER | Unique Buildium identifier |
| `EmergencyContact.Name`                    | `emergency_contact_name`         | TEXT    | Emergency contact info     |
| `EmergencyContact.RelationshipDescription` | `emergency_contact_relationship` | TEXT    | Relationship type          |
| `EmergencyContact.Phone`                   | `emergency_contact_phone`        | TEXT    | Emergency phone            |
| `EmergencyContact.Email`                   | `emergency_contact_email`        | TEXT    | Emergency email            |
| `SMSOptInStatus`                           | `sms_opt_in_status`              | BOOLEAN | SMS consent                |
| `Comment`                                  | `comment`                        | TEXT    | Tenant notes               |
| `TaxId`                                    | `tax_id`                         | TEXT    | Tax identification         |

## Core Functions

### 1. `mapTenantToContact(buildiumTenant)`

**Purpose**: Converts Buildium tenant data to database contact format

**Features**:

- Phone number prioritization (Mobile → Home → Work)
- Date format conversion (ISO string → PostgreSQL DATE)
- Country mapping using `mapCountryFromBuildium()`
- Null-safe field handling

**Usage**:

```typescript
import { mapTenantToContact } from '../lib/buildium-mappers';

const contactData = mapTenantToContact(buildiumTenantData);
```

### 2. `mapTenantToTenantRecord(buildiumTenant)`

**Purpose**: Converts Buildium tenant data to database tenant format

**Features**:

- Direct field mapping for tenant-specific data
- Emergency contact information handling
- Boolean conversion for SMS opt-in status

**Usage**:

```typescript
import { mapTenantToTenantRecord } from '../lib/buildium-mappers';

const tenantData = mapTenantToTenantRecord(buildiumTenantData);
```

### 3. `findOrCreateContact(buildiumTenant, supabase)`

**Purpose**: Finds existing contact by email or creates new one

**Features**:

- **Duplicate Detection**: By `primary_email`
- **Smart Updates**: Only updates empty fields in existing records
- **Error Handling**: Graceful failure with detailed logging
- **Return Value**: Contact ID (number)

**Usage**:

```typescript
import { findOrCreateContact } from '../lib/buildium-mappers';

const contactId = await findOrCreateContact(buildiumTenant, supabase);
```

### 4. `findOrCreateTenant(contactId, buildiumTenant, supabase)`

**Purpose**: Finds existing tenant by buildium_tenant_id or creates new one

**Features**:

- **Duplicate Detection**: By `buildium_tenant_id`
- **Smart Updates**: Only updates empty fields in existing records
- **Relationship Linking**: Automatically links to contact via `contact_id`
- **Return Value**: Tenant ID (UUID string)

**Usage**:

```typescript
import { findOrCreateTenant } from '../lib/buildium-mappers';

const tenantId = await findOrCreateTenant(contactId, buildiumTenant, supabase);
```

### 5. `createLeaseContactRelationship(leaseId, tenantId, role, supabase)`

**Purpose**: Creates lease_contacts relationship between lease and tenant

**Features**:

- **Role Assignment**: 'Tenant' or 'Guarantor'
- **Timestamp Management**: Automatic created_at/updated_at
- **Error Handling**: Detailed error logging

**Usage**:

```typescript
import { createLeaseContactRelationship } from '../lib/buildium-mappers';

const relationshipId = await createLeaseContactRelationship(leaseId, tenantId, 'Tenant', supabase);
```

### 6. `mapLeaseFromBuildiumWithTenants(buildiumLease, supabase)`

**Purpose**: Enhanced lease mapper with complete tenant relationship handling

**Features**:

- **Tenants Array Processing**: Handles multiple tenants per lease
- **Cosigners Array Processing**: Handles multiple cosigners (Guarantors)
- **Automatic Relationship Creation**: Creates all necessary records
- **Error Resilience**: Continues processing if individual tenants fail
- **Return Value**: Enhanced lease data with tenant relationships

**Usage**:

```typescript
import { mapLeaseFromBuildiumWithTenants } from '../lib/buildium-mappers';

const enhancedLease = await mapLeaseFromBuildiumWithTenants(buildiumLease, supabase);
```

## Complete Workflow Example

```typescript
import { mapLeaseFromBuildiumWithTenants } from '../lib/buildium-mappers';

async function processLeaseWithTenants(buildiumLeaseId: number) {
  try {
    // 1. Fetch lease from Buildium
    const buildiumLease = await fetchLeaseFromBuildium(buildiumLeaseId);

    // 2. Enhanced mapping with tenant processing
    const enhancedLease = await mapLeaseFromBuildiumWithTenants(buildiumLease, supabase);

    // 3. Create lease record
    const leaseData = {
      ...enhancedLease,
      // Remove tenantRelationships as it's not part of lease table
      tenantRelationships: undefined,
    };

    const { data: lease, error } = await supabase
      .from('leases')
      .insert(leaseData)
      .select('id')
      .single();

    if (error) throw error;

    // 4. Create lease_contacts relationships
    for (const relationship of enhancedLease.tenantRelationships) {
      await createLeaseContactRelationship(
        lease.id,
        relationship.tenantId,
        relationship.role,
        supabase,
      );
    }

    console.log(
      `✅ Successfully processed lease ${buildiumLeaseId} with ${enhancedLease.tenantRelationships.length} tenants`,
    );
  } catch (error) {
    console.error(`❌ Failed to process lease ${buildiumLeaseId}:`, error);
  }
}
```

## Error Handling Strategy

### Graceful Degradation

- **Individual Tenant Failures**: Skip failed tenants, continue with others
- **Missing Required Fields**: Insert records anyway (as requested)
- **Database Errors**: Log detailed errors, throw for debugging

### Duplicate Handling

- **Contacts**: Find by email, update only empty fields
- **Tenants**: Find by buildium_tenant_id, update only empty fields
- **Relationships**: Create new lease_contacts records

### Phone Number Logic

```typescript
// Priority order for primary_phone
const primaryPhone = mobilePhone || homePhone || '';

// Priority order for alt_phone
const altPhone = workPhone || homePhone || '';
```

## Country Mapping

Uses the existing `mapCountryFromBuildium()` function to handle Buildium's concatenated country names:

```typescript
// Examples:
mapCountryFromBuildium('UnitedStates'); // Returns 'United States'
mapCountryFromBuildium('AntiguaandBarbuda'); // Returns 'Antigua and Barbuda'
mapCountryFromBuildium('Canada'); // Returns 'Canada' (no change)
```

## Best Practices

### 1. Use Enhanced Mappers

- **For Production**: Always use `mapLeaseFromBuildiumWithTenants()`
- **For Testing**: Use basic `mapLeaseFromBuildium()` only

### 2. Error Monitoring

- Monitor console logs for `⚠️` warnings (skipped tenants)
- Monitor console logs for `❌` errors (failed operations)
- Monitor console logs for `✅` successes (completed operations)

### 3. Data Validation

- Validate Buildium data before processing
- Check for required fields (FirstName, LastName, Email)
- Handle empty arrays gracefully

### 4. Performance Considerations

- Process tenants sequentially to avoid database conflicts
- Use transactions for atomic operations when possible
- Monitor database connection limits

## Troubleshooting

### Common Issues

1. **"No country mapping found"**
   - Check if Buildium country value is in the mapping table
   - Add new country to `BUILDIUM_TO_DATABASE_COUNTRY_MAP` if needed

2. **"Error finding contact"**
   - Verify email field is present in Buildium data
   - Check database connection and permissions

3. **"Error creating tenant"**
   - Verify contact_id is valid
   - Check for unique constraint violations on buildium_tenant_id

4. **"Skipping tenant"**
   - Check individual tenant data for missing required fields
   - Review console logs for specific error details

### Debug Mode

Enable detailed logging by setting environment variable:

```bash
DEBUG_TENANT_MAPPING=true
```

## Integration Points

### With Existing Systems

- **Property Mapping**: Tenants are linked to properties via leases
- **Unit Mapping**: Tenants are linked to units via leases
- **Lease Mapping**: Enhanced lease mapper includes tenant processing

### Database Schema Dependencies

- `contacts` table must exist with all required fields
- `tenants` table must exist with `contact_id` foreign key
- `lease_contacts` table must exist for relationship management
- `countries` enum must be defined for country validation

## Future Enhancements

### Planned Improvements

1. **Batch Processing**: Process multiple tenants in parallel
2. **Transaction Support**: Atomic operations for lease + tenant creation
3. **Validation Schema**: Zod schemas for tenant data validation
4. **Webhook Support**: Real-time tenant updates from Buildium
5. **Audit Trail**: Track all tenant changes and relationships

### Configuration Options

- Tenant role customization
- Phone number priority preferences
- Country mapping overrides
- Error handling strategies
