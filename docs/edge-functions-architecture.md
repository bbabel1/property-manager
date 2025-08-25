# Edge Functions Architecture for Buildium Integration

## 🚀 Overview

This document describes the new Edge Functions architecture that replaces direct Buildium API calls with secure,
server-side processing via Supabase Edge Functions.

## 🏗️ Architecture Benefits

### ✅ Security Improvements

- **API Keys Protected**: Buildium credentials never exposed to client-side code

- **Server-Side Processing**: All sensitive operations happen on Supabase servers

- **CORS Protection**: Edge Functions handle cross-origin requests securely

### ✅ Performance Improvements

- **Global Edge Network**: Functions run closer to users worldwide

- **Reduced Latency**: Direct server-to-server communication

- **Better Caching**: Server-side caching capabilities

### ✅ Scalability Improvements

- **Automatic Scaling**: Supabase handles traffic spikes

- **Rate Limiting**: Better control over Buildium API rate limits

- **Error Handling**: Robust retry and fallback mechanisms

## 🔧 Edge Functions Structure

### 1. `buildium-sync` Function

**Purpose**: Handle all Buildium synchronization operations

**Endpoints**:

- `POST /functions/v1/buildium-sync` - Sync entities to/from Buildium
- `GET /functions/v1/buildium-sync` - Retrieve entities from Buildium

**Operations**:

- Create/Update properties in Buildium
- Create/Update owners in Buildium
- Fetch property/owner data from Buildium
- Update sync status in database

**Request Format**:

```json

{
  "entityType": "property|owner",
  "entityData": { /* entity data */ },

  "operation": "create|update"
}

```

**Response Format**:

```json

{
  "success": true,
  "data": { /* Buildium response */ },

  "message": "Entity synced successfully"
}

```

### 2. `buildium-webhook` Function

**Purpose**: Process real-time webhook events from Buildium

**Endpoints**:

- `POST /functions/v1/buildium-webhook` - Process webhook events

**Operations**:

- Validate webhook signatures
- Store webhook events in database
- Process property/owner updates
- Handle data conflicts

**Webhook Events Supported**:

- `PropertyCreated` / `PropertyUpdated`
- `OwnerCreated` / `OwnerUpdated`

### 3. `buildium-status` Function

**Purpose**: Manage sync status and retry failed operations

**Endpoints**:

- `GET /functions/v1/buildium-status` - Get sync status
- `POST /functions/v1/buildium-status` - Retry failed syncs

**Operations**:

- Query sync status for entities
- List failed sync operations
- Retry failed syncs
- Update sync status

## 🔄 Data Flow

### Outbound Sync (Local → Buildium)

```

1. Frontend → API Route (Next.js)
2. API Route → Edge Function (buildium-sync)
3. Edge Function → Buildium API
4. Edge Function → Database (update sync status)
5. Edge Function → API Route (response)
6. API Route → Frontend (success/error)

```

### Inbound Sync (Buildium → Local)

```

1. Buildium → Webhook (buildium-webhook)
2. Edge Function → Database (store event)
3. Edge Function → Buildium API (fetch full data)
4. Edge Function → Database (update local data)
5. Edge Function → Database (mark as processed)

```

## 🔐 Security Features

### Environment Variables

- `BUILDIUM_CLIENT_SECRET`: API key (from MCP)
- `BUILDIUM_BASE_URL`: API base URL
- `BUILDIUM_WEBHOOK_SECRET`: Webhook signature verification
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Database access

### Authentication

- Edge Functions use Supabase service role for database access
- API routes validate user authentication before calling Edge Functions
- Webhook signature verification (when secret is provided)

### Rate Limiting

- Built-in retry logic with exponential backoff
- Respects Buildium API rate limits
- Configurable timeout and retry attempts

## 📊 Error Handling

### Retry Logic

```typescript

// Automatic retry with exponential backoff
for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {

  try {
    const response = await fetch(url, config)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (attempt < this.retryAttempts) {
      await new Promise(resolve =>
        setTimeout(resolve, this.retryDelay * (attempt + 1))

      )
      continue
    }
    throw error
  }
}

```

### Error Categories

- **Network Errors**: Automatic retry with backoff

- **API Errors**: Logged and returned to client

- **Validation Errors**: Immediate failure with details

- **Database Errors**: Logged and handled gracefully

## 📈 Monitoring & Logging

### Logging Strategy

- **Edge Function Logs**: Available in Supabase Dashboard

- **API Route Logs**: Application-level logging

- **Database Logs**: Sync status and webhook events

### Metrics to Monitor

- Sync success/failure rates
- Webhook processing times
- API response times
- Error rates by operation type

## 🚀 Deployment

### Edge Functions

```bash

# Deploy all functions

npx supabase functions deploy buildium-sync
npx supabase functions deploy buildium-webhook
npx supabase functions deploy buildium-status

```

### Environment Variables

```bash

# Set secrets for Edge Functions

npx supabase secrets set BUILDIUM_CLIENT_SECRET="your-secret"
npx supabase secrets set BUILDIUM_BASE_URL="https://apisandbox.buildium.com/v1"
npx supabase secrets set BUILDIUM_WEBHOOK_SECRET="your-webhook-secret"

```

## 🔧 Testing

### Local Testing

```bash

# Test Edge Functions locally

npx supabase functions serve buildium-sync
npx supabase functions serve buildium-webhook
npx supabase functions serve buildium-status

```

### Integration Testing

- Test property creation with sync
- Test owner creation with sync
- Test webhook processing
- Test sync status queries

## 📚 API Reference

### Frontend Client

```typescript

import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

// Sync property to Buildium
const result = await buildiumEdgeClient.syncPropertyToBuildium(propertyData)

// Get sync status
const status = await buildiumEdgeClient.getSyncStatus('property', '123')

// Retry failed syncs
const retryResult = await buildiumEdgeClient.retryFailedSyncs('property')

```

### Direct Edge Function Calls

```typescript

// Call Edge Function directly
const { data, error } = await supabase.functions.invoke('buildium-sync', {
  body: {
    entityType: 'property',
    entityData: propertyData,
    operation: 'create'
  }
})

```

## 🔄 Migration from Direct API Calls

### Before (Direct API)

```typescript

// Direct Buildium API call (insecure)
const response = await fetch('https://api.buildium.com/v1/properties', {
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify(propertyData)
})

```

### After (Edge Function)

```typescript

// Secure Edge Function call
const result = await buildiumEdgeClient.syncPropertyToBuildium(propertyData)

```

## 🎯 Next Steps

1. **Monitor Performance**: Track Edge Function execution times

2. **Add Caching**: Implement server-side caching for Buildium responses

3. **Enhanced Logging**: Add structured logging for better debugging

4. **Webhook Verification**: Implement proper webhook signature verification

5. **Batch Operations**: Add support for batch sync operations

## 📞 Support

For issues with Edge Functions:

1. Check Supabase Dashboard → Functions → Logs
2. Review application logs for API route errors
3. Verify environment variables are set correctly
4. Test Edge Functions locally for debugging
