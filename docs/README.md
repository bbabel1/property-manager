# Documentation Index

> **Last Updated**: 2025-08-28T05:34:42.977Z (Auto-generated)

## Architecture Documentation

- [Current Architecture Analysis](architecture/CURRENT_ARCHITECTURE_ANALYSIS.md) - System state and hybrid architecture
- [Migration Status and Roadmap](architecture/MIGRATION_STATUS_AND_ROADMAP.md) - Conversion progress tracking
- [Business Logic Documentation](architecture/BUSINESS_LOGIC_DOCUMENTATION.md) - Property management business rules
- [Supabase Auth Implementation](architecture/SUPABASE_AUTH_IMPLEMENTATION.md) - Authentication implementation guide

## API Documentation

- [Supabase API Documentation](api/SUPABASE_API_DOCUMENTATION.md) - Complete API reference

## Database Documentation

- [Database Schema](database/DATABASE_SCHEMA.md) - Complete schema overview
- [Supabase Setup Guide](../docs/database/SUPABASE_SETUP.md) - Initial setup instructions

## Migration Guides

- [Prisma to Supabase Migration](architecture/MIGRATION_STATUS_AND_ROADMAP.md) - Step-by-step migration guide
- [NextAuth to Supabase Auth](architecture/SUPABASE_AUTH_IMPLEMENTATION.md) - Authentication migration

## Monitoring

This documentation is automatically updated by the documentation monitoring system. 

**Last automated check**: 2025-08-28T05:34:42.977Z

**Monitoring patterns**:
- API routes (`src/app/api/**/*.ts`)
- Database migrations (`supabase/migrations/*.sql`) 
- Authentication files (`src/lib/auth*`, `src/app/auth*`)
- Business logic (`src/types/*`, `src/lib/*-service.ts`)
- Dependencies (`package.json`)

To run manual documentation updates:
```bash
npm run docs:update
```
