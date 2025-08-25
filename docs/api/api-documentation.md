# API Endpoints Reference

> Quick reference for API endpoints in the Property Management System

## Authentication

All endpoints require authentication using Supabase JWT tokens.

```bash

Authorization: Bearer <your-jwt-token>

```

## Endpoints

### Auth Endpoints

- `GET /api/auth/[...nextauth]` - NextAuth.js routes
- `POST /api/auth/signup` - User registration

### Bank Accounts

- `GET /api/bank-accounts` - List bank accounts
- `POST /api/bank-accounts` - Create bank account
- `POST /api/bank-accounts/sync` - Sync bank accounts from Buildium
- `GET /api/bank-accounts/sync` - Get bank account sync status

### Owners

- `GET /api/owners` - List owners
- `POST /api/owners` - Create owner
- `GET /api/owners/{id}` - Get owner details
- `PUT /api/owners/{id}` - Update owner
- `GET /api/owners/{id}/properties` - Get owner's properties

### Properties

- `GET /api/properties` - List properties
- `POST /api/properties` - Create property
- `GET /api/properties/{id}` - Get property details
- `PUT /api/properties/{id}` - Update property
- `PUT /api/properties/{id}/banking` - Update property banking

### Staff

- `GET /api/staff` - List staff members
- `POST /api/staff` - Create staff member

### Units

- `GET /api/units` - List units
- `POST /api/units` - Create unit

### Buildium Integration

- `GET /api/buildium/bank-accounts` - Buildium bank accounts
- `GET /api/buildium/properties` - Buildium properties
- `GET /api/buildium/owners` - Buildium owners
- `GET /api/buildium/leases` - Buildium leases

## File Locations

```text

src/app/api/
├── auth/
│   ├── [...nextauth]/route.ts
│   └── signup/route.ts
├── bank-accounts/
│   ├── route.ts
│   └── sync/route.ts
├── owners/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/properties/route.ts
├── properties/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/banking/route.ts
├── staff/route.ts
├── units/route.ts
└── buildium/
    ├── bank-accounts/route.ts
    ├── properties/route.ts
    ├── owners/route.ts
    └── leases/route.ts

```

## Common Response Format

```json

{
  "success": true,
  "data": [...],
  "count": 1
}

```

## Error Response

```json

{
  "error": "Error message"
}

```

## Rate Limiting

- 100 requests per minute per user
- 429 status code when exceeded
