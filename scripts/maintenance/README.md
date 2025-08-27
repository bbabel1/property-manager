# Maintenance Scripts

> **Purpose**: Database maintenance, cleanup, and optimization scripts

## Overview

This directory contains scripts for ongoing database maintenance, data cleanup, and system optimization.

## Scripts

### `cleanup-orphaned-records.ts`
**Purpose**: Remove orphaned records and fix data integrity issues
**When to Use**: Regular maintenance or after data import operations
**Dependencies**: Database access and proper permissions

### `optimize-database.ts`
**Purpose**: Optimize database performance and update statistics
**When to Use**: After large data operations or performance issues
**Dependencies**: Database admin access

### `backup-database.ts`
**Purpose**: Create database backup for disaster recovery
**When to Use**: Before major changes or regular backup schedule
**Dependencies**: Supabase CLI and project access

### `restore-database.ts`
**Purpose**: Restore database from backup
**When to Use**: Disaster recovery or testing scenarios
**Dependencies**: Valid backup file and admin access

### `verify-data-integrity.ts`
**Purpose**: Comprehensive data integrity verification
**When to Use**: After data operations or troubleshooting
**Dependencies**: Database access

## Usage

```bash
# Regular maintenance workflow
npx tsx scripts/maintenance/cleanup-orphaned-records.ts
npx tsx scripts/maintenance/verify-data-integrity.ts
npx tsx scripts/maintenance/optimize-database.ts

# Backup workflow
npx tsx scripts/maintenance/backup-database.ts
```

## Maintenance Schedule

### Daily
- Check for orphaned records
- Verify critical data integrity

### Weekly
- Full data integrity verification
- Performance optimization

### Monthly
- Complete database backup
- Comprehensive cleanup operations

## Notes

- Always backup before running maintenance scripts
- Test maintenance scripts in development environment first
- Monitor script execution for any errors
- Document any manual interventions required
