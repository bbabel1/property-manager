# Buildium Integration Setup Guide

## 🚀 **Getting Started with Buildium Integration**

### **Step 1: Environment Configuration**

Add the following environment variables to your `.env.local` file:

```bash

# Buildium API Configuration

BUILDIUM_API_KEY="your-buildium-api-key-here"
BUILDIUM_BASE_URL="https://apisandbox.buildium.com/v1"
BUILDIUM_SYNC_ENABLED="true"
BUILDIUM_RETRY_ATTEMPTS="3"
BUILDIUM_RETRY_DELAY="1000"
BUILDIUM_TIMEOUT="30000"

# Buildium Webhook Configuration

BUILDIUM_WEBHOOK_SECRET="your-webhook-secret-key-here"
BUILDIUM_WEBHOOK_URL="https://yourdomain.com/api/webhooks/buildium"

```

### **Step 2: Get Buildium API Credentials**

1. **Log into your Buildium account**

2. **Navigate to Settings → API**

3. **Generate a new API key**

4. **Copy the API key to your environment variables**

### **Step 3: Configure Webhook Endpoint**

1. **In your Buildium dashboard, go to Settings → Webhooks**

2. **Add a new webhook endpoint:**

   - **URL**: `https://yourdomain.com/api/webhooks/buildium`

   - **Events**: Select all property management events

   - **Secret**: Generate and save a webhook secret

3. **Copy the webhook secret to your environment variables**

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
| `BUILDIUM_API_KEY` | Yes | - | Your Buildium API key |
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

curl -H "Authorization: Bearer $BUILDIUM_API_KEY" \
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
