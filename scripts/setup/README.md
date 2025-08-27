# Setup Scripts

> **Purpose**: Initial setup and configuration scripts for the Property Management System

## Overview

This directory contains scripts for initial project setup, environment configuration, and database initialization.

## Scripts

### `setup-environment.ts`
**Purpose**: Configure environment variables and validate configuration
**When to Use**: First-time project setup or environment changes
**Dependencies**: `.env` file with required variables

### `setup-database.ts`
**Purpose**: Initialize database schema and create required tables
**When to Use**: First-time database setup or schema reset
**Dependencies**: Supabase project linked and configured

### `setup-buildium-connection.ts`
**Purpose**: Test Buildium API connection and validate credentials
**When to Use**: After Buildium credentials are configured
**Dependencies**: Buildium API credentials in environment

## Usage

```bash
# Run all setup scripts in order
npx tsx scripts/setup/setup-environment.ts
npx tsx scripts/setup/setup-database.ts
npx tsx scripts/setup/setup-buildium-connection.ts
```

## Environment Variables Required

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
```

## Notes

- Run setup scripts in order for proper initialization
- Verify all environment variables are set before running
- Check script output for any errors or warnings
- Test Buildium connection before proceeding with data operations
