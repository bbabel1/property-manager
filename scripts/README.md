# Scripts Index

> This document provides a comprehensive index of all available scripts in the Property Management System.

## Overview

Scripts are organized by category to make them easy to find and understand. Each script includes:

- **Purpose**: What the script does
- **Usage**: How to run it
- **Parameters**: Command line options
- **Examples**: Common usage examples

## Quick Start

```bash
# View all scripts organized by category
npx tsx scripts/utils/show-organization.ts

# View scripts in a specific category
npx tsx scripts/utils/show-organization.ts buildium
npx tsx scripts/utils/show-organization.ts sync
npx tsx scripts/utils/show-organization.ts create

# Run a script with help
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts --help

# Run a script with parameters
npx tsx scripts/buildium/create/add-buildium-property.ts --name "New Property"
```

## Script Categories

### 🏢 **Buildium Integration Scripts**

Scripts for integrating with the Buildium property management platform.

#### Synchronization Scripts

Scripts for syncing data from Buildium to the local database.

| Script | Purpose | Usage |
|--------|---------|-------|
| `buildium/sync/sync-buildium-bank-accounts.ts` | Sync bank accounts from Buildium | `npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts` |
| `buildium/sync/fetch-all-lease-transactions.ts` | Fetch all lease transactions from Buildium | `npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts` |
| `buildium/sync/populate-relationships.ts` | Populate relationships between entities | `npx tsx scripts/buildium/sync/populate-relationships.ts` |
| `buildium/sync/get-buildium-property.ts` | Get property details from Buildium | `npx tsx scripts/buildium/sync/get-buildium-property.ts` |
| `buildium/sync/get-buildium-property-direct.ts` | Get property details directly from API | `npx tsx scripts/buildium/sync/get-buildium-property-direct.ts` |
| `buildium/sync/sync-buildium-units-7647.ts` | Sync units for property 7647 | `npx tsx scripts/buildium/sync/sync-buildium-units-7647.ts` |
| `buildium/sync/fetch-owner-50685.ts` | Fetch owner details from Buildium | `npx tsx scripts/buildium/sync/fetch-owner-50685.ts` |
| `buildium/sync/fetch-units-7647.ts` | Fetch units for property 7647 | `npx tsx scripts/buildium/sync/fetch-units-7647.ts` |
| `buildium/sync/resync-property-7647-fixed.ts` | Resync property 7647 with fixes | `npx tsx scripts/buildium/sync/resync-property-7647-fixed.ts` |
| `buildium/sync/populate-lease-relationship-to-transaction-lines.ts` | Populate lease relationships | `npx tsx scripts/buildium/sync/populate-lease-relationship-to-transaction-lines.ts` |

#### Creation Scripts

Scripts for creating new records in Buildium.

| Script | Purpose | Usage |
|--------|---------|-------|
| `buildium/create/add-buildium-property.ts` | Add a new property to Buildium | `npx tsx scripts/buildium/create/add-buildium-property.ts` |
| `buildium/create/create-buildium-lease-records.ts` | Create lease records in Buildium | `npx tsx scripts/buildium/create/create-buildium-lease-records.ts` |
| `buildium/create/create-buildium-transaction-lines.ts` | Create transaction lines in Buildium | `npx tsx scripts/buildium/create/create-buildium-transaction-lines.ts` |
| `buildium/create/create-buildium-journal-entries.ts` | Create journal entries in Buildium | `npx tsx scripts/buildium/create/create-buildium-journal-entries.ts` |
| `buildium/create/create-buildium-charge-records.ts` | Create charge records in Buildium | `npx tsx scripts/buildium/create/create-buildium-charge-records.ts` |
| `buildium/create/create-buildium-gl-accounts.ts` | Create GL accounts in Buildium | `npx tsx scripts/buildium/create/create-buildium-gl-accounts.ts` |
| `buildium/create/create-buildium-rent-schedule-record.ts` | Create rent schedule records | `npx tsx scripts/buildium/create/create-buildium-rent-schedule-record.ts` |
| `buildium/create/link-property-bank-account.ts` | Link property to bank account | `npx tsx scripts/buildium/create/link-property-bank-account.ts` |
| `buildium/create/link-property-trust-account.ts` | Link property to trust account | `npx tsx scripts/buildium/create/link-property-trust-account.ts` |
| `buildium/create/set-property-trust-account.ts` | Set property trust account | `npx tsx scripts/buildium/create/set-property-trust-account.ts` |
| `buildium/create/update-owner-buildium-id.ts` | Update owner Buildium ID | `npx tsx scripts/buildium/create/update-owner-buildium-id.ts` |

#### Verification Scripts

Scripts for verifying data integrity and relationships.

| Script | Purpose | Usage |
|--------|---------|-------|
| `buildium/verify/verify-relationships.ts` | Verify data relationships | `npx tsx scripts/buildium/verify/verify-relationships.ts` |
| `buildium/verify/verify-buildium-transaction-lines.ts` | Verify transaction lines | `npx tsx scripts/buildium/verify/verify-buildium-transaction-lines.ts` |
| `buildium/verify/verify-lease-creation.ts` | Verify lease creation | `npx tsx scripts/buildium/verify/verify-lease-creation.ts` |
| `buildium/verify/verify-buildium-charge-records.ts` | Verify charge records | `npx tsx scripts/buildium/verify/verify-buildium-charge-records.ts` |
| `buildium/verify/verify-rent-schedule-creation.ts` | Verify rent schedule creation | `npx tsx scripts/buildium/verify/verify-rent-schedule-creation.ts` |
| `buildium/verify/verify-all-transactions.ts` | Verify all transactions | `npx tsx scripts/buildium/verify/verify-all-transactions.ts` |
| `buildium/verify/check-property-fields.ts` | Check property fields | `npx tsx scripts/buildium/verify/check-property-fields.ts` |
| `buildium/verify/check-property-unit-exist.ts` | Check if property unit exists | `npx tsx scripts/buildium/verify/check-property-unit-exist.ts` |
| `buildium/verify/check-unit-created.ts` | Check if unit was created | `npx tsx scripts/buildium/verify/check-unit-created.ts` |
| `buildium/verify/check-lease-structure.ts` | Check lease structure | `npx tsx scripts/buildium/verify/check-lease-structure.ts` |
| `buildium/verify/check-gl-accounts.ts` | Check GL accounts | `npx tsx scripts/buildium/verify/check-gl-accounts.ts` |
| `buildium/verify/check-charge-data.ts` | Check charge data | `npx tsx scripts/buildium/verify/check-charge-data.ts` |
| `buildium/verify/check-local-property.ts` | Check local property data | `npx tsx scripts/buildium/verify/check-local-property.ts` |

#### Cleanup Scripts

Scripts for cleaning up duplicate or orphaned data.

| Script | Purpose | Usage |
|--------|---------|-------|
| `buildium/cleanup/cleanup-duplicate-journal-entries.ts` | Clean duplicate journal entries | `npx tsx scripts/buildium/cleanup/cleanup-duplicate-journal-entries.ts` |
| `buildium/cleanup/cleanup-duplicate-transaction-lines.ts` | Clean duplicate transaction lines | `npx tsx scripts/buildium/cleanup/cleanup-duplicate-transaction-lines.ts` |
| `buildium/cleanup/delete-all-properties.ts` | Delete all properties | `npx tsx scripts/buildium/cleanup/delete-all-properties.ts` |

### 🔌 **API Testing Scripts**

Scripts for testing API endpoints and functionality.

| Script | Purpose | Usage |
|--------|---------|-------|
| `api/testing/explore-buildium-rent-endpoints.ts` | Explore Buildium rent endpoints | `npx tsx scripts/api/testing/explore-buildium-rent-endpoints.ts` |
| `api/testing/test-bank-account-sync.ts` | Test bank account synchronization | `npx tsx scripts/api/testing/test-bank-account-sync.ts` |
| `api/testing/test-buildium-direct.js` | Test direct Buildium API calls | `node scripts/api/testing/test-buildium-direct.js` |

### 🗄️ **Database Scripts**

Scripts for database operations and maintenance.

| Script | Purpose | Usage |
|--------|---------|-------|
| `sql/fix_generate_display_name.sql` | Fix display name generation | Run in Supabase SQL editor |
| `sql/fix_ownerships_triggers.sql` | Fix ownership triggers | Run in Supabase SQL editor |
| `sql/run_fix.sql` | Run database fixes | Run in Supabase SQL editor |

### 🛠️ **Utility Scripts**

Scripts for general utilities and helpers.

| Script | Purpose | Usage |
|--------|---------|-------|
| `utils/show-organization.ts` | Show script organization | `npx tsx scripts/utils/show-organization.ts` |
| `utils/buildium-api-reference.ts` | Buildium API reference | `npx tsx scripts/utils/buildium-api-reference.ts` |
| `utils/cursor-ai-agent.ts` | Cursor AI agent utilities | `npx tsx scripts/utils/cursor-ai-agent.ts` |
| `utils/cursor-ai-integration.ts` | Cursor AI integration | `npx tsx scripts/utils/cursor-ai-integration.ts` |
| `utils/database-helpers.ts` | Database helper functions | `npx tsx scripts/utils/database-helpers.ts` |
| `utils/logger.ts` | Logging utilities | `npx tsx scripts/utils/logger.ts` |
| `utils/buildium-client.ts` | Buildium client utilities | `npx tsx scripts/utils/buildium-client.ts` |
| `utils/supabase-helpers.ts` | Supabase helper functions | `npx tsx scripts/utils/supabase-helpers.ts` |

## Common Usage Patterns

### Running Scripts

```bash
# Basic script execution
npx tsx scripts/path/to/script.ts

# With parameters
npx tsx scripts/path/to/script.ts --param value

# With environment variables
BUILDIUM_API_KEY=your_key npx tsx scripts/path/to/script.ts
```

### Error Handling

Most scripts include error handling and will:

- Log errors to the console
- Provide helpful error messages
- Exit with appropriate status codes

### Logging

Scripts use a consistent logging format:

```bash
[INFO] Starting script execution
[DEBUG] Processing data...
[ERROR] An error occurred: details
```

## Troubleshooting

### Common Issues

1. **Script not found**: Ensure you're in the project root directory
2. **Permission denied**: Make sure the script file is executable
3. **Missing dependencies**: Run `npm install` to install dependencies
4. **Environment variables**: Check that required environment variables are set

### Getting Help

- Check the script's help output: `npx tsx scripts/path/to/script.ts --help`
- Review the script's source code for usage examples
- Check the project documentation for detailed guides

## Contributing

When adding new scripts:

1. Follow the existing naming conventions
2. Add proper error handling and logging
3. Include usage examples in comments
4. Update this index with the new script
5. Test the script thoroughly before committing

## Script Development Guidelines

### Best Practices

- Use TypeScript for type safety
- Include comprehensive error handling
- Add logging for debugging
- Follow consistent naming conventions
- Document usage and parameters

### Code Style

- Use consistent indentation (2 spaces)
- Follow TypeScript best practices
- Include JSDoc comments for functions
- Use meaningful variable names

### Testing

- Test scripts with various input scenarios
- Verify error handling works correctly
- Check that logging provides useful information
- Ensure scripts exit with appropriate status codes
