# Buildium Integration Setup Guide

## 🚀 **Getting Started with Buildium Integration**

### **Step 1: Get Buildium API Credentials**

1. **Log into your Buildium account**

2. **Navigate to Settings → API**

3. **Generate a new API key** (Client ID and Client Secret)

4. **Note your credentials** - you'll enter them in the UI

### **Step 2: Configure Buildium Integration via UI**

1. **Navigate to Settings → Integrations (org)**

2. **Click "Connect" on the Buildium card**

3. **Enter your Buildium credentials:**
   - **Base URL**: `https://apisandbox.buildium.com/v1` (sandbox) or `https://api.buildium.com/v1` (production)
   - **Client ID**: Your Buildium Client ID
   - **Client Secret**: Your Buildium Client Secret
   - **Webhook Secret**: Your Buildium webhook secret

4. **Click "Test Connection"** to verify your credentials

5. **Enable the integration** using the toggle switch

6. **Click "Save"** to store your credentials

### **Step 3: Configure Webhook Endpoint**

1. **In your Buildium dashboard, go to Settings → Webhooks**

2. **Add a new webhook endpoint:**

   - **URL**: `https://yourdomain.com/api/webhooks/buildium`

   - **Events**: Select all property management events

   - **Secret**: Generate and save a webhook secret (enter this in the UI)

3. **Update the webhook secret in the UI** if you change it later

### **Step 4: Environment Variables (Optional - Fallback)**

For backward compatibility and system jobs without org context, you can still use environment variables:

```bash

# Buildium API Configuration (Optional - used as fallback)

BUILDIUM_CLIENT_ID="your-client-id"
BUILDIUM_CLIENT_SECRET="your-client-secret"
BUILDIUM_BASE_URL="https://apisandbox.buildium.com/v1"
BUILDIUM_WEBHOOK_SECRET="your-webhook-secret-key-here"

```

**Note**: Database-stored credentials take precedence over environment variables. Environment variables are only used when no org-scoped credentials exist in the database.

### **Step 4: Test the Integration**

#### **Test Property Creation with Buildium Sync:**

```bash

# Create a property via API

curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Property",
    "addressLine1": "123 Test St",
    "city": "Test City",
    "state": "CA",
    "postalCode": "90210",
    "country": "US",
    "rentalSubType": "Office",
    "status": "Active"
  }'

```

#### **Check Sync Status:**

```bash

# Get sync status for a property

curl -X GET "http://localhost:3000/api/buildium/sync?entityType=property&entityId=PROPERTY_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

```

#### **Retry Failed Syncs:**

```bash

# Retry failed syncs for properties

curl -X POST http://localhost:3000/api/buildium/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "entityType": "property"
  }'

```

### **Step 5: Monitor Integration**

#### **Check Sync Status Dashboard:**

Visit: `http://localhost:3000/api/buildium/sync`

#### **Monitor Webhook Events:**

Check your application logs for webhook processing events.

#### **View Failed Syncs:**

```bash

curl -X GET "http://localhost:3000/api/buildium/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

```

#### **Inspect Error Tracking Table:**

- Failed and retried sync attempts are persisted in `public.sync_operations`.
- Query this table to audit errors and drive retry workflows.

## 🔧 **Configuration Options**

### **Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BUILDIUM_CLIENT_ID` | Yes | - | Your Buildium client ID |
| `BUILDIUM_CLIENT_SECRET` | Yes | - | Your Buildium client secret |
| `BUILDIUM_BASE_URL` | Yes | `https://apisandbox.buildium.com/v1` | Buildium API base URL |
| `BUILDIUM_SYNC_ENABLED` | No | `true` | Enable/disable Buildium sync |
| `BUILDIUM_RETRY_ATTEMPTS` | No | `3` | Number of retry attempts for failed API calls |
| `BUILDIUM_RETRY_DELAY` | No | `1000` | Delay between retry attempts (ms) |
| `BUILDIUM_TIMEOUT` | No | `30000` | API request timeout (ms) |
| `BUILDIUM_WEBHOOK_SECRET` | Yes | - | Webhook signature verification secret |
| `BUILDIUM_WEBHOOK_URL` | No | - | Your webhook endpoint URL |

### **API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/properties` | POST | Create property with Buildium sync |
| `/api/owners` | POST | Create owner with Buildium sync |
| `/api/buildium/sync` | GET | Get sync status or failed syncs |
| `/api/buildium/sync` | POST | Retry failed syncs |
| `/api/webhooks/buildium` | POST | Process Buildium webhook events |

## 🛡️ **Security Considerations**

1. **API Key Security**: Never commit API keys to version control

2. **Webhook Verification**: Always verify webhook signatures

3. **Rate Limiting**: Respect Buildium API rate limits

4. **Error Handling**: Monitor and handle sync failures appropriately

## 📊 **Monitoring & Troubleshooting**

### **Common Issues:**

1. **API Key Invalid**: Check your Buildium API key

2. **Webhook Not Receiving Events**: Verify webhook URL and secret

3. **Sync Failures**: Check sync status and retry failed operations

4. **Rate Limiting**: Implement proper rate limiting handling

### **Debug Commands:**

```bash

# Check if Buildium sync is enabled

echo $BUILDIUM_SYNC_ENABLED

# Test Buildium API connectivity

curl -H "x-buildium-client-id: $BUILDIUM_CLIENT_ID" \
     -H "x-buildium-client-secret: $BUILDIUM_CLIENT_SECRET" \
  "$BUILDIUM_BASE_URL/properties"

# Check webhook endpoint

curl -X POST http://localhost:3000/api/webhooks/buildium \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

```

## 🎉 **Success Indicators**

✅ **Properties sync to Buildium automatically**

✅ **Owners sync to Buildium automatically**

✅ **Webhook events are processed correctly**

✅ **Sync status is tracked in database**

✅ **Failed syncs can be retried**

✅ **API responses include sync information**

Your Buildium integration is now fully operational! 🚀
