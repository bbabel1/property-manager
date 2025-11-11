# Buildium API Quick Reference

## Authentication

- **Base URL**:
  - Production: `https://api.buildium.com/v1`
  - Sandbox: `https://apisandbox.buildium.com/v1`
- **Headers Required**:
  - `x-buildium-client-id`: Your Buildium client ID
  - `x-buildium-client-secret`: Your Buildium client secret
  - `Accept`: `application/json`
  - `Content-Type`: `application/json` (for POST/PUT requests)

## Common Endpoints

### Properties

- **GET** `/rentals` - List all rental properties
- **GET** `/rentals/{id}` - Get specific property
- **POST** `/rentals` - Create new property

### Units

- **GET** `/rentals/units` - List all units
- **GET** `/rentals/units/{id}` - Get specific unit
- **POST** `/rentals/units` - Create new unit

### Leases

- **GET** `/leases` - List all leases
- **GET** `/leases/{id}` - Get specific lease
- **POST** `/leases` - Create new lease
- **POST** `/leases/{id}/payments` - Create payment for a lease

### Tenants

- **GET** `/rentals/tenants` - List all tenants
- **GET** `/rentals/tenants/{tenantId}` - Get specific tenant
- **PUT** `/rentals/tenants/{tenantId}` - Update tenant

### Bank Accounts

- **GET** `/bankaccounts` - List all bank accounts
- **GET** `/bankaccounts/{id}` - Get specific bank account

### General Ledger

- **GET** `/glaccounts` - List GL accounts

## Script Templates

### Basic API Call Template

```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });

async function fetchFromBuildium(endpoint: string) {
  const response = await fetch(`${process.env.BUILDIUM_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
```

### Environment Setup

```bash
# Required environment variables in .env.local
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1    # or https://api.buildium.com/v1
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
```

### cURL example

```bash
curl -i \
  -H "Accept: application/json" \
  -H "x-buildium-client-id: $BUILDIUM_CLIENT_ID" \
  -H "x-buildium-client-secret: $BUILDIUM_CLIENT_SECRET" \
  "$BUILDIUM_BASE_URL/vendors"
```

## File Management

### File Categories

- **GET** `/filecategories` - List all file categories
- **GET** `/filecategories/{id}` - Get specific category
- **POST** `/filecategories` - Create new category
- **PUT** `/filecategories/{id}` - Update category

### File Upload (Two-Step Process)

Buildium uses a two-step file upload process:

1. **Create Upload Request**:

   ```typescript
   POST /files/uploadrequests
   {
     "EntityType": "Lease",
     "EntityId": 12345,
     "FileName": "lease_agreement.pdf",
     "Title": "Lease Agreement",
     "Description": "Original lease document",
     "CategoryId": 1
   }
   ```

   Response:

   ```json
   {
     "BucketUrl": "https://s3.amazonaws.com/...",
     "FormData": { "key": "value", ... },
     "PhysicalFileName": "unique-file-name.pdf"
   }
   ```

2. **Upload Binary File**:
   - POST to `BucketUrl` with `FormData` as form fields
   - Include the actual file binary in the form

3. **Sync to Local Database**:
   - Use `/api/buildium/files/uploadrequests` endpoint
   - File will be automatically associated with entity via `entity_type` and `entity_id`
   - The application-level `/api/files/upload` endpoint now orchestrates this automatically for any entity that has a Buildium ID (property, unit, lease, tenant, owner, vendor, bill). When the upload succeeds, the returned Buildium file identifiers are persisted back onto the local record.
    - Portal sharing can be updated via `/api/files/{id}/sharing` (with the file’s `buildium_file_id`). Payloads must include both tenant and rental-owner flags; the handler maps to the appropriate Buildium sharing scopes based on the file’s entity type (lease, property, unit, etc.).

### File Operations

- **GET** `/files` - List files (supports `entityType` and `entityId` filters)
- **GET** `/files/{id}` - Get specific file
- **PUT** `/files/{id}` - Update file metadata
- **POST** `/files/{id}/download` - Get download URL (presigned)

**Entity Types**: Account, Association, AssociationOwner, AssociationUnit, Lease, OwnershipAccount, PublicAsset, Rental, RentalOwner, RentalUnit, Tenant, Vendor

## Common Patterns

### Pagination

Most endpoints support pagination with `limit` and `offset` parameters:

```
GET /rentals?limit=50&offset=0
```

### Filtering

Many endpoints support filtering by various parameters:

```
GET /leases?propertyId=123&status=Active
```

### Error Handling

Always check response status and handle errors appropriately:

```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('Buildium API error:', response.status, errorData);
  throw new Error(`API call failed: ${response.status}`);
}
```

## Important Notes

1. **API Documentation Priority**: ALWAYS reference the official "Open API, powered by Buildium (v1)" documentation first when working with any Buildium-related functions. This documentation is the authoritative source for endpoints, request/response schemas, and API behavior.

2. **Schema Consolidation**: The project now uses enhanced schemas (`BuildiumPropertyCreateEnhancedSchema`, `BuildiumPropertyUpdateEnhancedSchema`) for all property operations. These schemas provide:
   - Better validation with max length constraints
   - Simplified PropertyType enum (`'Rental'`, `'Association'`, `'Commercial'`)
   - Additional fields like `OperatingBankAccountId` and `Reserve`
   - Consistent field validation across all operations

3. **Rate Limiting**: Be mindful of API rate limits. Implement appropriate delays between requests when making bulk operations.

4. **Data Consistency**: Always validate data from Buildium API responses before processing to ensure data integrity.

5. **Environment Variables**: Use `.env.local` for local development and ensure all Buildium credentials are properly configured.

6. **Error Logging**: Log actionable context for debugging, but never log secrets, API keys, or personally identifiable information (PII).

## Troubleshooting

### Common Issues

- **401 Unauthorized**: Check your client ID and secret
- **403 Forbidden**: Verify your API permissions
- **404 Not Found**: Confirm the resource ID exists
- **422 Unprocessable Entity**: Validate request payload format

### Debugging Tips

- Use the official Buildium API documentation to verify endpoint URLs and parameters
- Check response headers for additional error information
- Verify environment variables are loaded correctly
- Test API calls in Postman or similar tool before implementing in code
