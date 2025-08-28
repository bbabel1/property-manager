# Buildium Integration Complete Guide

## Overview

This guide covers the complete Buildium integration for the Property Management
System, including API endpoints, webhook processing, and data synchronization.

## Architecture

### Webhook Flow

```mermaid

Buildium → Next.js API Route (/api/webhooks/buildium) → Supabase Edge Function

```

**Important**: Buildium should send webhooks to your Next.js API route, NOT

directly to the Supabase Edge Function. Direct Edge Function access requires
authentication and will result in 401 errors.

### Data Flow

1. **Buildium** sends webhook events to Next.js API route

2. **Next.js API route** authenticates and forwards to Supabase Edge Function

3. **Edge Function** processes events and updates local database

4. **Database** stores processed events and syncs data

## Environment Variables

### Required Environment Variables

```env

# Buildium Configuration

BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
BUILDIUM_WEBHOOK_SECRET=your_webhook_secret

# Supabase Configuration

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application Configuration

NEXT_PUBLIC_SITE_URL=https://yourdomain.com

```

### Webhook Configuration

- **Webhook URL**: `https://yourdomain.com/api/webhooks/buildium`

- **Event Types**: Configure in Buildium dashboard for the events you want to

  receive
- **Signature Verification**: Implemented using `BUILDIUM_WEBHOOK_SECRET`

## API Endpoints

### Buildium API Routes

All Buildium API routes are located in `/src/app/api/buildium/` and follow
RESTful conventions:

- `GET /api/buildium/properties` - List properties
- `GET /api/buildium/properties/[id]` - Get property details
- `GET /api/buildium/owners` - List owners
- `GET /api/buildium/owners/[id]` - Get owner details
- `GET /api/buildium/leases` - List leases
- `GET /api/buildium/leases/[id]` - Get lease details
- `GET /api/buildium/leases/[id]/transactions` - Get lease transactions

### Webhook Endpoints

- `POST /api/webhooks/buildium` - Main webhook endpoint (receives from Buildium)
- `POST /api/webhooks/buildium/sync` - Manual sync endpoint

## Edge Functions

### buildium-webhook

Main webhook processing function that handles all webhook events:

- Property events (created, updated)
- Owner events (created, updated)
- Lease events (created, updated)
- Transaction events (created, updated, deleted)

### buildium-lease-transactions

Specialized function for lease transaction processing:

- Handles lease payment events
- Updates transaction records
- Manages payment status

### buildium-sync

Manual synchronization function:

- Syncs properties from Buildium
- Syncs owners from Buildium
- Syncs leases from Buildium

## Database Schema

### Core Tables

- `properties` - Property information
- `owners` - Owner information
- `lease` - Lease information (table name is lowercase)
- `lease_transactions` - Transaction records
- `units` - Unit information

### Integration Tables

- `buildium_webhook_events` - Webhook event processing
- `sync_operations` - Error tracking and retry log for Buildium syncs

### Key Fields

All tables include Buildium integration fields:

- `buildium_property_id` / `buildium_owner_id` / etc.
- `buildium_created_at` / `buildium_updated_at`
- `is_active` - Soft delete flag

## Event Types Supported

- `PropertyCreated` / `PropertyUpdated` / `PropertyDeleted`
- `OwnerCreated` / `OwnerUpdated` / `OwnerDeleted`
- `LeaseCreated` / `LeaseUpdated` / `LeaseDeleted`
- `TransactionCreated` / `TransactionUpdated` / `TransactionDeleted`

## Processing Flow

1. **Receive** webhook from Buildium

2. **Validate** signature and authenticate

3. **Store** event in database

4. **Process** event based on type

5. **Update** local data accordingly

6. **Log** processing results

## Error Handling

- Failed events are logged with error details
- Retry mechanism for transient failures
- Dead letter queue for persistent failures
- Monitoring and alerting for error rates

Note: Failed and retried Buildium sync attempts are persisted in `public.sync_operations` for auditing and automated retries.

## Webhook Testing

### Automated Testing

- Unit tests for webhook processing
- Integration tests for full flow
- Mock Buildium API responses
- Error scenario testing

### Manual Testing

- Next.js API route accessibility
- Edge function deployment verification
- Database connection testing
- Webhook signature validation

## Monitoring and Logging

### Webhook Events

- Event reception logging
- Processing status tracking
- Error rate monitoring
- Performance metrics

### Sync Logs

- Manual sync operations
- Data synchronization status
- Conflict resolution tracking
- Performance optimization

### Edge Function Logs

- Function execution logs
- Error stack traces
- Performance metrics
- Resource utilization

## Troubleshooting

### Common Issues

#### 401 Unauthorized Error

- Check service role key configuration
- Verify Edge Function authentication
- Review API route permissions

#### Webhook Not Processing

- Verify webhook URL configuration
- Check signature validation
- Review event type subscriptions

#### Data Not Syncing

- Check database connectivity
- Verify table permissions
- Review sync status logs

### Debug Steps

1. Check webhook event storage
2. Review Edge Function logs
3. Verify database connections
4. Test API endpoints manually
5. Check environment variables

## Security

### Webhook Security

- Signature verification using webhook secret
- HTTPS-only webhook endpoints
- Rate limiting and throttling
- IP whitelist validation

### API Security

- Service role key authentication
- Row Level Security (RLS) policies
- Input validation and sanitization
- Error message sanitization

## Deployment

### Prerequisites

1. Supabase project configured
2. Buildium API credentials obtained
3. Environment variables set
4. Database migrations applied

### Deployment Steps

1. Deploy Edge Functions:

```bash

supabase functions deploy buildium-webhook
supabase functions deploy buildium-lease-transactions
supabase functions deploy buildium-sync

```

1. Configure webhook URL in Buildium:

```bash

# Set webhook URL to your Next.js API route

https://yourdomain.com/api/webhooks/buildium

```

1. Test webhook processing

### Verification

1. Run webhook test script
2. Check database for processed events
3. Verify data synchronization
4. Monitor error rates

## Maintenance

### Regular Tasks

- Monitor webhook processing logs
- Review error rates and patterns
- Update webhook event types as needed
- Optimize database queries

### Backup and Recovery

- Database backups include webhook events
- Edge Function code versioning
- Environment variable backups
- Disaster recovery procedures

## Documentation

- API documentation: `/docs/api/`
- Database schema: `/docs/database/`
- Webhook setup: `/docs/buildium-webhook-setup-guide.md`
- Authentication: `/docs/buildium-authentication-guide.md`

## Logs and Monitoring

- Supabase Dashboard for function logs
- Database query performance monitoring
- Webhook event processing metrics
- Error rate and response time tracking

## Troubleshooting Resources

- Webhook test script
- Database schema documentation
- API endpoint documentation
- Buildium API reference
