# Buildium API Quick Reference

## Authentication Pattern
```typescript
headers: {
  'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
  'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

## Common Endpoints
- **Properties**: `GET /rentals/{id}`
- **Owners**: `GET /rentals/owners/{id}`
- **Leases**: `GET /leases/{id}`
- **Units**: `GET /rentals/{propertyId}/units`
- **Bank Accounts**: `GET /bankaccounts/{id}`
- **Vendors**: `GET /vendors/{id}`

## Script Template
```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })

const entityId = '[ID]'

async function fetchFromBuildium(entityId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/[endpoint]/${entityId}`
  
  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
```

## Quick Commands
```bash
# Fetch property
npx tsx scripts/buildium/sync/fetch-buildium-lease.ts  # Copy and modify

# Environment check
echo "BUILDIUM_CLIENT_ID: $BUILDIUM_CLIENT_ID"

# Create quick script
cp scripts/buildium/sync/fetch-buildium-lease.ts temp-fetch.ts
# Modify temp-fetch.ts
npx tsx temp-fetch.ts
rm temp-fetch.ts
```

## Common Response Fields
### Property Response
```json
{
  "Id": 12345,
  "Name": "Property Name",
  "Address": {
    "AddressLine1": "123 Main St",
    "City": "Anytown",
    "State": "CA",
    "PostalCode": "12345"
  },
  "IsActive": true,
  "RentalType": "Residential"
}
```

### Owner Response
```json
{
  "Id": 67890,
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john@example.com",
  "IsActive": true
}
```

## Error Handling
- Check `response.ok` before processing
- Log full error details for debugging
- Handle rate limiting (429 errors)
- Validate response structure
