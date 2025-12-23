# Scripts Organization Guide

> **Last Updated**: 2025-08-25
>
> This guide provides a comprehensive overview of the scripts directory structure, organization, and usage instructions.

## 📁 Current Scripts Directory Structure

```
scripts/
├── README.md                        # Main scripts documentation
├── buildium/                       # Buildium integration (create/sync)
├── cron/                           # Scheduled job runners
├── database/                       # Schema helpers and tooling
├── db/                             # Local DB backup/reset helpers
├── diagnostics/                    # Read-only checks, verifications, debug utilities
├── maintenance/                    # Mutating fixes, seeds, sync helpers
├── migrations/                     # Migration utilities
├── setup/                          # Environment setup/validation
├── sql/                            # SQL utilities and raw scripts
├── utils/                          # Shared helpers
└── workflows/                      # End-to-end workflows
```

## 🎯 Script Categories and Usage

### 1. **Setup Scripts** (`scripts/setup/`)

**Purpose**: Initial setup and configuration scripts

**When to Use**:

- First-time project setup
- Environment configuration
- Connectivity checks

**Key Scripts**:

- `setup-environment.ts` - Configure environment variables
- `setup-buildium-connection.ts` - Test Buildium API connection

### 2. **Buildium Integration Scripts** (`scripts/buildium/`)

**Purpose**: Buildium API integration and data synchronization

**When to Use**:

- Adding properties/leases/units to Buildium
- Importing or syncing Buildium data into Supabase
- Reconciling Buildium records

**Key Paths**:

- `create/` - Creation helpers (e.g., `add-buildium-property.ts`, `create-buildium-lease-records.ts`)
- `sync/` - Sync helpers (e.g., `sync-buildium-bank-accounts.ts`, `fetch-all-lease-transactions.ts`, `populate-relationships.ts`)
- Root helpers (e.g., `fetch-and-insert-bill.ts`, `ingest-lease-transactions.ts`)

### 3. **Diagnostics Scripts** (`scripts/diagnostics/`)

**Purpose**: Read-only checks, verifications, performance analysis, debugging

**When to Use**:

- Investigations and audits
- Validating migrations or data changes
- Troubleshooting production issues

**Examples**:

- `check-unit-balances.ts`, `check-bank-gl-transactions.ts`
- `debug-monthly-log-structure.ts`, `debug-api-endpoint.ts`
- `verify-transaction-totals-migration.ts`, `analyze-monthly-log-performance.ts`

### 4. **Maintenance Scripts** (`scripts/maintenance/`)

**Purpose**: Mutating fixes, seeds, and one-off repair/sync jobs

**When to Use**:

- Data fixes or targeted adjustments
- Seeding or resetting environments
- Schema/cache refreshes

**Examples**:

- `fix-monthly-log-schema.ts`, `fix-property-cash-calculation.ts`
- `seed.ts`, `seed_org.ts`, `reset-db.ts`
- `import-buildium.ts`, `manual-lease-sync.ts`, `refresh-schema-cache.ts`

### 5. **Database / DB Scripts** (`scripts/database/`, `scripts/db/`, `scripts/migrations/`)

**Purpose**: Schema helpers, backups, migrations support, and local DB workflows

**When to Use**:

- Inspecting schema snapshots (`database/current-schema.json`, `database/get-table-schema.ts`)
- Local backup/reset workflows (`db/backup-local.ts`, `db/reset-preserve-local.ts`)
- Migration utilities (`migrations/*.sh`, `migrations/*.ts`, `migrations/push-migration.ts`)

### 6. **SQL Scripts** (`scripts/sql/`)

**Purpose**: Direct SQL operations and helpers

**When to Use**:

- Applying SQL files locally or remotely
- Running raw SQL patches

**Key Scripts**:

- `apply_sql.ts` - Apply a SQL file via DSN
- `run-remote-sql.ts` / `.mjs` - Apply SQL against remote Supabase
- SQL patches like `add_bill_id_to_transaction_lines.sql`, `fix_ownerships_triggers.sql`

### 7. **Utility Scripts** (`scripts/utils/`)

**Purpose**: General utilities and documentation helpers

**When to Use**:

- Generating docs (`generate-api-docs.ts`, `generate-db-docs.ts`, `generate-component-docs.ts`)
- Buildium helpers (`buildium-api-reference.ts`, `gl-account-manager.ts`)
- Automation/helpers (`doc-watcher.ts`, `logger.ts`)

### 8. **Cron and Workflows** (`scripts/cron/`, `scripts/workflows/`)

**Purpose**: Scheduled jobs and end-to-end examples

**When to Use**:

- Running scheduled tasks (`cron/late-fees.ts`, `cron/recurring.ts`)
- Following guided flows (`workflows/add-new-property-workflow.ts`)

## 🚀 Common Workflows

### **Adding a New Property (Buildium + Supabase)**

```bash
# 1. Create the property in Buildium
npx tsx scripts/buildium/create/add-buildium-property.ts

# 2. Create lease records (if applicable)
npx tsx scripts/buildium/create/create-buildium-lease-records.ts

# 3. Populate relationships in Supabase
npx tsx scripts/buildium/sync/populate-relationships.ts

# 4. Validate balances and relationships
npx tsx scripts/diagnostics/check-unit-balances.ts
```

### **Data Synchronization**

```bash
# 1. Sync bank accounts
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# 2. Fetch lease transactions
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts

# 3. Rebuild relationships
npx tsx scripts/buildium/sync/populate-relationships.ts

# 4. Run diagnostics
npx tsx scripts/diagnostics/verify-transaction-totals-migration.ts
```

### **Data Verification & Troubleshooting**

- Quick health check: `npx tsx scripts/diagnostics/health-check.ts`
- Monthly log review: `npx tsx scripts/diagnostics/debug-monthly-log-structure.ts`
- GL/transaction validation: `npx tsx scripts/diagnostics/check-bank-gl-transactions.ts`

## 📋 Script Execution Order

- **Environment checks**: `scripts/setup/setup-environment.ts`, `scripts/setup/setup-buildium-connection.ts`
- **Choose a workflow**: run the relevant sequence above (property add, sync, or diagnostics).
- **Post-checks**: rerun targeted diagnostics (balances, GL checks) to confirm expected results.

## 🔧 Script Configuration

### **Environment Variables**

Most scripts require these environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
```

### **Script Parameters**

Many scripts accept parameters for customization:

```bash
# Example: Create property with specific ID
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]

# Example: Sync with specific date range
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts --start-date 2025-01-01 --end-date 2025-12-31
```

## 🚨 Important Notes

### **Script Safety**

- Always backup data before running scripts
- Test scripts on development environment first
- Check script output for errors
- Verify data integrity after script execution

### **Buildium API Limits**

- Respect Buildium API rate limits
- Use appropriate delays between requests
- Handle API errors gracefully
- Log all API interactions

### **Data Consistency**

- Verify relationships after data creation
- Check for orphaned records
- Ensure data integrity constraints
- Monitor sync status

## 📚 Additional Resources

- [Quick Start Guide](./QUICK_START_GUIDE.md)
- [Buildium Integration Guide](./buildium-integration-guide.md)
- [API Documentation](./api/api-documentation.md)
- [Database Schema Documentation](./database/DATABASE_SCHEMA.md)

## 🔄 Script Maintenance

### **Adding New Scripts**

1. Place in appropriate category directory
2. Follow naming convention: `action-entity-description.ts`
3. Add documentation in this guide
4. Update README.md in scripts directory

### **Updating Scripts**

1. Test changes in development environment
2. Update documentation
3. Version control all changes
4. Notify team of breaking changes

### **Deprecating Scripts**

1. Mark as deprecated in documentation
2. Move to a `scripts/deprecated/` directory (create it if needed)
3. Update references in other scripts
4. Remove after appropriate grace period
