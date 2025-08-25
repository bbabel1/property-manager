# Supabase Setup Guide

This document provides an overview of the Supabase setup for the Property Management System.

## Overview

This project uses Supabase as the backend database and authentication service. The setup includes:

- **Database**: PostgreSQL database with custom schema for property management
- **Authentication**: Supabase Auth for user management
- **Edge Functions**: Serverless functions for Buildium integration
- **Real-time**: WebSocket connections for live updates

## Quick Start

1. **Environment Variables**: Ensure your `.env` file contains the necessary Supabase credentials
2. **Database Schema**: Run migrations in the `supabase/migrations/` directory
3. **Edge Functions**: Deploy functions from `supabase/functions/`

## Documentation

For detailed information, see the following documentation:

- **Database Schema**: [`docs/database/database-schema.md`](docs/database/database-schema.md)
- **Buildium Integration**: [`docs/buildium-integration-complete.md`](docs/buildium-integration-complete.md)
- **API Documentation**: [`docs/api/api-documentation.md`](docs/api/api-documentation.md)

## Key Components

### Database Tables
- Properties, Units, Owners, Tenants
- Leases, Transactions, Bank Accounts
- Buildium integration tables

### Edge Functions
- `buildium-sync`: Syncs data from Buildium API
- `buildium-webhook`: Handles Buildium webhooks
- `buildium-lease-transactions`: Processes lease transactions
- `buildium-status`: Status monitoring

### Authentication
- Supabase Auth with custom user roles
- Protected routes and API endpoints
- Session management

## Development

To work with the database locally:

1. Install Supabase CLI
2. Run `supabase start` to start local development
3. Run `supabase db reset` to reset with latest migrations
4. Use `supabase db push` to apply schema changes

## Production

The production database is hosted on Supabase Cloud. All migrations are automatically applied through the CI/CD pipeline.

For more detailed setup instructions, refer to the documentation in the `docs/` directory.
