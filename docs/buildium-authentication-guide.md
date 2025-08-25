# Buildium Authentication Guide

This guide explains how to set up and use Buildium API authentication in the
Property Management System.

## Overview

Buildium uses OAuth 2.0 Client Credentials flow for API authentication. This
requires a client ID and client secret that you obtain from Buildium.

## Environment Setup

### Sandbox (Testing)

- **Base URL**: `https://apisandbox.buildium.com/v1`

- **Purpose**: Testing and development

- **Data**: Sample/test data only

### Production (Live)

- **Base URL**: `https://api.buildium.com/v1`

- **Purpose**: Live production data

- **Data**: Real customer and property data

## Authentication Flow

1. **Obtain Credentials**: Get client ID and secret from Buildium

2. **Request Token**: Exchange credentials for access token

3. **Use Token**: Include token in API request headers

4. **Refresh Token**: Automatically refresh when expired

## Implementation

The authentication is handled by the `BuildiumClient` class in
`src/lib/buildium-client.ts`:

```typescript

import { BuildiumClient } from '@/lib/buildium-client'

const client = new BuildiumClient({
  clientId: process.env.BUILDIUM_CLIENT_ID!,
  clientSecret: process.env.BUILDIUM_CLIENT_SECRET!,
  baseUrl: process.env.BUILDIUM_BASE_URL!
})

// Get access token
const token = await client.getAccessToken()

// Make API request
const properties = await client.getProperties()

```

## Error Handling

### Common HTTP Errors

### 401 Unauthorized

- **Cause**: Missing or incorrect authentication

- **Solution**: Check client ID and secret are correct

### 403 Forbidden

- **Cause**: Insufficient permissions for the requested resource

- **Solution**: Verify your Buildium account has the required permissions

### 404 Not Found

- **Cause**: Incorrect API endpoint or resource doesn't exist

- **Solution**: Check the API endpoint URL and resource ID

## Troubleshooting

### "Missing BUILDIUM_CLIENT_ID or BUILDIUM_CLIENT_SECRET"

- Check your `.env` file has the required environment variables
- Verify the variable names are exactly as expected
- Restart your development server after adding environment variables

### "Token request failed: 404 Not Found"

- You're using OAuth endpoints for the wrong environment
- Check `BUILDIUM_BASE_URL` is set correctly
- Verify you're using the correct Buildium environment (sandbox vs production)

### "Buildium API error: 401"

- Verify your client ID and secret are correct
- Check that your Buildium account is active
- Ensure you're using the correct environment (sandbox vs production)

## Security Best Practices

1. **Environment Variables**: Never hardcode credentials in your code

2. **Secret Management**: Use secure secret management in production

3. **Token Storage**: Don't store access tokens in databases or logs

4. **HTTPS Only**: Always use HTTPS for API requests

5. **Error Handling**: Don't expose sensitive information in error messages

## Environment Configuration

### `.env` (Development)

```bash

# Buildium API Configuration

BUILDIUM_CLIENT_ID=your_sandbox_client_id
BUILDIUM_CLIENT_SECRET=your_sandbox_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1

```

### `.env.production` (Production)

```bash

# Buildium API Configuration

BUILDIUM_CLIENT_ID=your_production_client_id
BUILDIUM_CLIENT_SECRET=your_production_client_secret
BUILDIUM_BASE_URL=https://api.buildium.com/v1

```

## Testing Authentication

You can test your authentication setup using the provided test script:

```bash

npx tsx scripts/test-buildium-auth.ts

```

This script will:

1. Test token acquisition
2. Verify API connectivity
3. Check basic API endpoints
4. Report any authentication issues

## Getting Buildium Credentials

1. **Contact Buildium**: Reach out to your Buildium account manager

2. **Request API Access**: Ask for API client credentials

3. **Specify Environment**: Request both sandbox and production credentials

4. **Set Permissions**: Ensure your account has the required API permissions

5. **Documentation**: Request API documentation and rate limits

## Rate Limits

Buildium API has rate limits to prevent abuse:

- **Requests per minute**: Varies by endpoint

- **Daily limits**: Check with Buildium for your specific limits

- **Handling**: The client automatically handles rate limiting with retries

## Support

If you encounter authentication issues:

1. Check this troubleshooting guide
2. Verify your Buildium account status
3. Contact Buildium support with your client ID
4. Review the Buildium API documentation
