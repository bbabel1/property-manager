# Quick Reference Guide

## Buildium API Quick Commands

### Fetch Property Data
```bash
# Create script
cp scripts/buildium/sync/fetch-buildium-lease.ts scripts/buildium/sync/fetch-buildium-property-[ID].ts

# Modify script (replace leaseId with propertyId, /leases/ with /rentals/)
sed -i '' 's/const leaseId = '\''16235'\''/const propertyId = '\''[ID]'\''/g' scripts/buildium/sync/fetch-buildium-property-[ID].ts
sed -i '' 's/\/leases\//\/rentals\//g' scripts/buildium/sync/fetch-buildium-property-[ID].ts
sed -i '' 's/lease/property/g' scripts/buildium/sync/fetch-buildium-property-[ID].ts

# Run script
npx tsx scripts/buildium/sync/fetch-buildium-property-[ID].ts

# Clean up
rm scripts/buildium/sync/fetch-buildium-property-[ID].ts
```

### Fetch Owner Data
```bash
# Create script
cp scripts/buildium/sync/fetch-buildium-lease.ts scripts/buildium/sync/fetch-buildium-owner-[ID].ts

# Modify script
sed -i '' 's/const leaseId = '\''16235'\''/const ownerId = '\''[ID]'\''/g' scripts/buildium/sync/fetch-buildium-owner-[ID].ts
sed -i '' 's/\/leases\//\/rentals\/owners\//g' scripts/buildium/sync/fetch-buildium-owner-[ID].ts
sed -i '' 's/lease/owner/g' scripts/buildium/sync/fetch-buildium-owner-[ID].ts

# Run script
npx tsx scripts/buildium/sync/fetch-buildium-owner-[ID].ts

# Clean up
rm scripts/buildium/sync/fetch-buildium-owner-[ID].ts
```

### Environment Variables
- **File**: `.env.local` (local development)
- **Required**: `BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET`, `BUILDIUM_BASE_URL`
- **Pattern**: `dotenv.config({ path: '.env.local' })`

### Common API Endpoints
- Properties: `/rentals/{id}`
- Owners: `/rentals/owners/{id}`
- Leases: `/leases/{id}`
- Units: `/rentals/{propertyId}/units`

### Error Handling
- Always check `response.ok`
- Log full error details
- Use proper HTTP status codes

### Quick Environment Check
```bash
# Check if environment variables are loaded
echo "BUILDIUM_CLIENT_ID: $BUILDIUM_CLIENT_ID"
echo "BUILDIUM_BASE_URL: $BUILDIUM_BASE_URL"
```

### Standard Script Template
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
