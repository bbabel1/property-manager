# Buildium API Quick Reference

## Authentication

- **Base URL**: `https://api.buildium.com/v1`
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

### Tenants

- **GET** `/leases/tenants` - List all tenants
- **GET** `/leases/tenants/{tenantId}` - Get specific tenant
- **PUT** `/leases/tenants/{tenantId}` - Update tenant

### Bank Accounts

- **GET** `/bankaccounts` - List all bank accounts
- **GET** `/bankaccounts/{id}` - Get specific bank account

### General Ledger

- **GET** `/generalLedger/accounts` - List GL accounts
- **GET** `/generalLedger/entries` - List journal entries

## Script Templates

### Basic API Call Template

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

async function fetchFromBuildium(endpoint: string) {
  const response = await fetch(`${process.env.BUILDIUM_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "x-buildium-client-id": process.env.BUILDIUM_CLIENT_ID!,
      "x-buildium-client-secret": process.env.BUILDIUM_CLIENT_SECRET!,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Buildium API error: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}
```

### Environment Setup

```bash
# Required environment variables in .env.local
BUILDIUM_BASE_URL=https://api.buildium.com/v1
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
```

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
  console.error("Buildium API error:", response.status, errorData);
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
