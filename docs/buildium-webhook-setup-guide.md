# Buildium Webhook Setup Guide

## Current Issue

Buildium is currently configured to send webhooks directly to the Supabase Edge
Function, which causes 401 Unauthorized errors.

## Solution

### Correct Webhook Flow

```mermaid

Buildium → Next.js API Route → Supabase Edge Function

```

### Current (Broken) Flow

```mermaid

Buildium → Supabase Edge Function (401 Unauthorized)

```

## Setup Instructions

### In Buildium Dashboard

1. Go to **Settings** → **API Access** → **Webhooks**

2. Update the webhook URL to point to your Next.js API route
3. Select the event types you want to receive
4. Save the configuration

### Webhook URL Examples

- **Production**: `https://yourdomain.com/api/webhooks/buildium`

- **Development**: `https://your-dev-domain.com/api/webhooks/buildium`

- **Local Testing**: `https://your-ngrok-url.ngrok.io/api/webhooks/buildium`

## Testing

### Test the Next.js API Route

```bash

curl -X POST https://yourdomain.com/api/webhooks/buildium \
  -H "Content-Type: application/json" \
  -H "x-buildium-signature: test-signature" \
  -d '{
    "Events": [
      {
        "Id": "test-event-123",
        "EventType": "PropertyCreated",
        "EntityId": 12345,
        "EntityType": "Property",
        "EventDate": "2025-01-15T10:30:00Z",
        "Data": {
          "PropertyId": 12345,
          "PropertyName": "Test Property"
        }
      }
    ]
  }'

```

### Expected Response

```json

{
  "success": true,
  "message": "Webhook processed successfully",
  "eventId": "test-event-123"
}

```

## Verification

### Check Webhook Events in Database

```sql

SELECT
  event_id,
  event_type,
  entity_id,
  entity_type,
  processed,
  created_at,
  processed_at,
  error_message
FROM buildium_webhook_events
ORDER BY created_at DESC
LIMIT 10;

```

### Check Supabase Logs

```bash

npx supabase functions logs buildium-webhook --follow

```

## Troubleshooting

### 401 Unauthorized Error

- **Cause**: Buildium sending webhook directly to Edge Function

- **Solution**: Update webhook URL to use Next.js API route

### 404 Not Found Error

- **Cause**: Incorrect webhook URL or API route not deployed

- **Solution**: Verify the webhook URL and ensure the API route is accessible

### 500 Internal Server Error

- **Cause**: Missing environment variables or database connection issues

- **Solution**: Check environment variables and database connectivity

### Webhook Not Processing

- **Cause**: Database connection issues or Edge Function errors

- **Solution**: Check database logs and Edge Function logs

## Security Considerations

- Webhook signature verification is implemented
- HTTPS is required for all webhook URLs
- Rate limiting is applied to prevent abuse
- Error messages don't expose sensitive information

## Monitoring

Monitor webhook processing through:

- Database webhook events table
- Supabase Edge Function logs
- Application error logs
- Buildium webhook delivery status
