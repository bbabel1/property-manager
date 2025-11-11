# Management Service Configuration

## Overview

The Management Service provides conditional logic for handling service assignments at both property and unit levels. It automatically determines whether to fetch service configuration from the `properties` table or the `units` table based on the `service_assignment` field value.

## Key Features

- **Conditional Logic**: Automatically switches between property-level and unit-level service configuration
- **Service Assignment Detection**: Reads `service_assignment` field to determine data source
- **Unified Interface**: Provides consistent API regardless of assignment level
- **Bill Administration**: Handles billing notes (property-level: null, unit-level: from `fee_notes`)
- **Active Services Parsing**: Handles both JSON array and comma-separated string formats

## Database Schema

### Properties Table Fields

- `service_assignment`: `'Property Level' | 'Unit Level' | null`
- `service_plan`: `'Full' | 'Basic' | 'A-la-carte' | null`
- `active_services`: `management_services_enum[] | null`

### Units Table Fields

- `service_plan`: `'Full' | 'Basic' | 'A-la-carte' | null`
- `active_services`: `text | null` (JSON array or comma-separated)
- `fee_notes`: `text | null` (used as bill_administration)

## Service Logic

### Property Level Assignment (`service_assignment = 'Property Level'`)

1. Fetches `service_plan` and `active_services` from `properties` table
2. Sets `bill_administration` to `null` (not available at property level)
3. Sets `source` to `'property'`

### Unit Level Assignment (`service_assignment = 'Unit Level'`)

1. Fetches `service_plan`, `active_services`, and `fee_notes` from `units` table
2. Parses `active_services` from text format (JSON or comma-separated)
3. Uses `fee_notes` as `bill_administration`
4. Sets `source` to `'unit'` and includes `unit_id`

### Default Behavior

- If `service_assignment` is `null` or `undefined`, defaults to property level
- Logs warning when defaulting to property level

## API Endpoints

### GET /api/management-service/config

Get management service configuration for a property or unit.

**Query Parameters:**

- `propertyId` (required): UUID of the property
- `unitId` (optional): UUID of the unit (for unit-level configuration)

**Response:**

```json
{
  "success": true,
  "data": {
    "service_plan": "Full",
    "active_services": ["Rent Collection", "Maintenance"],
    "bill_administration": "Notes about billing",
    "source": "property",
    "unit_id": "uuid"
  }
}
```

### PUT /api/management-service/config

Update management service configuration.

**Query Parameters:**

- `propertyId` (required): UUID of the property
- `unitId` (optional): UUID of the unit (for unit-level updates)

**Request Body:**

```json
{
  "service_plan": "Basic",
  "active_services": ["Rent Collection"],
  "bill_administration": "Updated notes"
}
```

### POST /api/management-service/units

Get all units service configurations for a property.

**Request Body:**

```json
{
  "propertyId": "uuid"
}
```

## Usage Examples

### Basic Usage

```typescript
import { ManagementService } from '@/lib/management-service';

// Property-level configuration
const propertyService = new ManagementService('property-uuid');
const config = await propertyService.getServiceConfiguration();

// Unit-level configuration
const unitService = new ManagementService('property-uuid', 'unit-uuid');
const unitConfig = await unitService.getServiceConfiguration();
```

### React Component Usage

```tsx
import ManagementServiceConfigComponent from '@/components/management/ManagementServiceConfig';

function PropertyPage({ propertyId, unitId }) {
  return (
    <ManagementServiceConfigComponent
      propertyId={propertyId}
      unitId={unitId}
      onConfigChange={(config) => console.log('Config updated:', config)}
    />
  );
}
```

### React Hook Usage

```tsx
import { useManagementService } from '@/hooks/useManagementService';

function MyComponent({ propertyId, unitId }) {
  const { config, loading, updateConfig } = useManagementService({
    propertyId,
    unitId,
    autoLoad: true,
  });

  const handleUpdate = async () => {
    await updateConfig({
      service_plan: 'Full',
      active_services: ['Rent Collection', 'Maintenance'],
    });
  };

  return (
    <div>
      {loading ? (
        'Loading...'
      ) : (
        <div>
          <p>Service Plan: {config?.service_plan}</p>
          <p>Source: {config?.source}</p>
          <button onClick={handleUpdate}>Update Config</button>
        </div>
      )}
    </div>
  );
}
```

## Service Plans

- **Full**: Complete management service package
- **Basic**: Essential management services only
- **A-la-carte**: Customizable service selection

## Active Services

Available services that can be assigned:

- Rent Collection
- Maintenance
- Turnovers
- Compliance
- Bill Pay
- Condition Reports
- Renewals

## Error Handling

The service includes comprehensive error handling:

- Database connection errors
- Invalid property/unit IDs
- Missing required fields
- Data parsing errors
- Network/API errors

All errors are logged with context and re-thrown with descriptive messages.

## Testing

Run the test script to verify functionality:

```bash
npx tsx scripts/test-management-service.ts
```

The test script will:

1. Test property-level configuration retrieval
2. Test unit-level configuration retrieval
3. Test units service configurations listing
4. Test configuration updates for both levels
5. Verify conditional logic behavior

## Migration Notes

- The `service_assignment` field was migrated from `'Building'/'Unit'` to `'Property Level'/'Unit Level'`
- The `active_services` field in units table stores text (JSON or comma-separated)
- The `bill_administration` field maps to `fee_notes` in units table
- Default behavior maintains backward compatibility

## Security

- All API endpoints require authentication
- Rate limiting applied (100 requests/minute per user)
- Input validation using Zod schemas
- SQL injection protection via Supabase client
- Error messages don't expose sensitive information
