# Bank Account Sync Documentation

This document describes the bank account synchronization functionality between
Buildium and the local database.

## Overview

The bank account sync system allows you to fetch bank accounts from Buildium and
store them in your local database. This ensures that your local system has
up-to-date bank account information from Buildium.

## API Endpoints

### 1. Sync Bank Accounts from Buildium

**Endpoint:** `POST /api/bank-accounts/sync`

**Description:** Fetches all bank accounts from Buildium and syncs them to the

local database.

**Request Body:**

```json
{
  "forceSync": false
}
```

**Parameters:**

- `forceSync` (boolean, optional): If true, forces a full sync even if records
  already exist. Default: false

**Response:**

```json
{
  "success": true,
  "message": "Bank accounts synced successfully",
  "data": {
    "syncedCount": 5,
    "updatedCount": 2,
    "errorCount": 0,
    "errors": []
  }
}
```

### 2. Get Bank Account Sync Status

**Endpoint:** `GET /api/bank-accounts/sync`

**Description:** Retrieves sync status for bank accounts.

**Query Parameters:**

- `bankAccountId` (string, optional): Specific bank account ID to get sync status
  for

**Response (all bank accounts):**

```json
[
  {
    "entityType": "bankAccount",
    "entityId": "123",
    "buildiumId": 456,
    "lastSyncedAt": "2024-01-15T10:30:00Z",
    "syncStatus": "success",
    "errorMessage": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

### 3. Get Bank Accounts with Sync Option

**Endpoint:** `GET /api/bank-accounts?syncFromBuildium=true`

**Description:** Fetches bank accounts from the local database, with an optional

sync from Buildium first.

**Query Parameters:**

- `syncFromBuildium` (boolean, optional): If true, syncs from Buildium before
  fetching local records

**Response:**

```json
[
  {
    "id": "uuid",
    "buildium_bank_id": 456,
    "name": "Main Operating Account",
    "description": "Primary business account",
    "bank_account_type": "checking",
    "account_number": "****1234",

    "routing_number": "****5678",

    "country": "US",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

## Data Mapping

### Buildium to Local Database

| Buildium Field    | Local Database Field | Notes                            |
| ----------------- | -------------------- | -------------------------------- |
| `Id`              | `buildium_bank_id`   | Buildium's unique identifier     |
| `Name`            | `name`               | Bank account name                |
| `BankAccountType` | `bank_account_type`  | Converted to lowercase           |
| `AccountNumber`   | `account_number`     | Account number (may be masked)   |
| `RoutingNumber`   | `routing_number`     | Routing number (may be masked)   |
| `Description`     | `description`        | Optional description             |
| `IsActive`        | Not stored           | Used for filtering during sync   |
| `CreatedDate`     | Not stored           | Buildium creation timestamp      |
| `ModifiedDate`    | Not stored           | Buildium last modified timestamp |

### Bank Account Types

| Buildium Type          | Local Database Type      |
| ---------------------- | ------------------------ |
| `Checking`             | `checking`               |
| `Savings`              | `savings`                |
| `MoneyMarket`          | `money_market`           |
| `CertificateOfDeposit` | `certificate_of_deposit` |

## Sync Process

### 1. Fetch from Buildium

- Makes paginated requests to Buildium API
- Handles rate limiting and retries
- Collects all bank accounts across all pages

### 2. Data Transformation

- Maps Buildium data format to local database format
- Handles type conversions and field mappings
- Validates required fields

### 3. Database Operations

- Checks for existing records using `buildium_bank_id`
- Updates existing records if found
- Inserts new records if not found
- Tracks sync status and errors

### 4. Error Handling

- Logs all errors with context
- Continues processing other records if one fails
- Returns summary of successful and failed operations

## Usage Examples

### Using the API

```javascript
// Sync bank accounts from Buildium
const response = await fetch('/api/bank-accounts/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ forceSync: true }),
});

const result = await response.json();
console.log(`Synced: ${result.data.syncedCount}, Updated: ${result.data.updatedCount}`);

// Get bank accounts with sync
const bankAccountsResponse = await fetch('/api/bank-accounts?syncFromBuildium=true');
const bankAccounts = await bankAccountsResponse.json();
```

### Using the Script

```bash

# Run the sync script directly

npx tsx scripts/sync-buildium-bank-accounts.ts

```

## Error Handling

### Common Errors

1. **Authentication Error (401)**
   - Missing or invalid API key
   - Expired authentication token

2. **Rate Limiting (429)**
   - Too many requests to Buildium API
   - Implemented retry logic with exponential backoff

3. **Database Errors**
   - Constraint violations
   - Connection issues
   - Permission errors

### Error Response Format

```json
{
  "success": false,
  "error": "Failed to sync bank accounts",
  "details": "Specific error message"
}
```

## Monitoring and Logging

### Log Levels

- **INFO**: Sync start/completion, record counts

- **WARN**: Non-critical issues, retries

- **ERROR**: Failed operations, API errors

### Metrics Tracked

- Total records fetched from Buildium
- Number of new records synced
- Number of existing records updated
- Number of failed operations
- Sync duration
- Error rates

## Security Considerations

1. **API Key Protection**
   - Store Buildium client ID and secret in environment variables
   - Use service role key for database operations
   - Never expose credentials in client-side code
   - See [Buildium Authentication Guide](../buildium-authentication-guide.md) for
     details

2. **Data Privacy**
   - Account numbers may be masked in Buildium responses
   - Store only necessary information locally
   - Implement proper access controls

3. **Rate Limiting**
   - Respect Buildium API rate limits
   - Implement exponential backoff for retries
   - Monitor API usage

## Troubleshooting

### Sync Not Working

1. Check Buildium client ID and secret are valid and have proper permissions
2. Verify database connection and permissions
3. Check logs for specific error messages
4. Ensure Buildium API is accessible from your environment
5. See [Buildium Authentication Guide](../buildium-authentication-guide.md) for
   troubleshooting

### Missing Records

1. Verify Buildium has the expected bank accounts
2. Check if records are filtered by `IsActive` status
3. Review error logs for failed operations
4. Use `forceSync: true` to re-sync all records

### Performance Issues

1. Monitor API response times
2. Check database query performance
3. Consider implementing batch operations for large datasets
4. Review network connectivity to Buildium

## Future Enhancements

1. **Incremental Sync**: Only sync changed records since last sync

2. **Webhook Integration**: Real-time updates from Buildium

3. **Conflict Resolution**: Handle conflicts between local and Buildium data

4. **Bulk Operations**: Optimize for large datasets

5. **Sync Scheduling**: Automated periodic syncs
