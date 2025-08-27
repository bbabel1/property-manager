# Scripts Organization Guide

> **Last Updated**: 2025-08-25
> 
> This guide provides a comprehensive overview of the scripts directory structure, organization, and usage instructions.

## 📁 Current Scripts Directory Structure

```
scripts/
├── README.md                           # Main scripts documentation
├── doc-monitoring-system.ts            # Documentation monitoring system
├── show-organization.ts                # Shows current organization structure
├── api/                                # API-related scripts
├── buildium/                           # Buildium integration scripts
│   ├── create/                         # Entity creation scripts
│   ├── sync/                           # Data synchronization scripts
│   └── verify/                         # Data verification scripts
├── database/                           # Database management scripts
├── sql/                                # SQL utility scripts
└── utils/                              # Utility scripts
```

## 🎯 Script Categories and Usage

### 1. **Setup Scripts** (`scripts/setup/`)
**Purpose**: Initial setup and configuration scripts

**When to Use**:
- First-time project setup
- Environment configuration
- Database initialization

**Key Scripts**:
- `setup-environment.ts` - Configure environment variables
- `setup-database.ts` - Initialize database schema
- `setup-buildium-connection.ts` - Test Buildium API connection

### 2. **Buildium Integration Scripts** (`scripts/buildium/`)

#### **Creation Scripts** (`scripts/buildium/create/`)
**Purpose**: Create entities in Buildium and sync to local database

**When to Use**:
- Adding new properties, units, owners, leases
- Bulk data import from other systems
- Testing Buildium API integration

**Key Scripts**:
- `add-buildium-property.ts` - Create property in Buildium
- `create-buildium-lease-records.ts` - Create lease records
- `create-buildium-charge-records.ts` - Create charge records
- `create-buildium-journal-entries.ts` - Create journal entries
- `create-buildium-transaction-lines.ts` - Create transaction lines
- `create-buildium-rent-schedule-record.ts` - Create rent schedules
- `create-buildium-gl-accounts.ts` - Create general ledger accounts

**Usage Example**:
```bash
# Create a new property in Buildium
npx tsx scripts/buildium/create/add-buildium-property.ts

# Create lease records
npx tsx scripts/buildium/create/create-buildium-lease-records.ts
```

#### **Sync Scripts** (`scripts/buildium/sync/`)
**Purpose**: Synchronize data between Buildium and local database

**When to Use**:
- Initial data import from Buildium
- Regular data synchronization
- Resolving sync conflicts

**Key Scripts**:
- `sync-buildium-bank-accounts.ts` - Sync bank accounts
- `fetch-all-lease-transactions.ts` - Fetch lease transactions
- `fetch-buildium-lease.ts` - Fetch specific lease
- `fetch-buildium-leases-list.ts` - Fetch all leases
- `fetch-buildium-rent-schedule.ts` - Fetch rent schedules
- `fetch-buildium-journal-entry.ts` - Fetch journal entries
- `populate-relationships.ts` - Populate entity relationships
- `populate-lease-relationship-to-transaction-lines.ts` - Link leases to transactions

**Usage Example**:
```bash
# Sync all bank accounts from Buildium
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# Fetch all lease transactions
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts
```

#### **Verification Scripts** (`scripts/buildium/verify/`)
**Purpose**: Verify data integrity and relationships

**When to Use**:
- After data creation or sync operations
- Troubleshooting data issues
- Quality assurance

**Key Scripts**:
- `verify-relationships.ts` - Verify entity relationships
- `verify-buildium-transaction-lines.ts` - Verify transaction lines
- `verify-lease-creation.ts` - Verify lease creation
- `verify-owner-created.ts` - Verify owner creation
- `verify-buildium-charge-records.ts` - Verify charge records
- `verify-rent-schedule-creation.ts` - Verify rent schedule creation
- `verify-complete-relationships-with-transaction-lines.ts` - Verify complete relationships
- `check-property-fields.ts` - Check property field completeness
- `check-local-property.ts` - Check local property data
- `check-charge-data.ts` - Check charge data integrity
- `check-gl-accounts.ts` - Check general ledger accounts
- `check-unit-created.ts` - Check unit creation
- `check-property-unit-exist.ts` - Check property-unit relationships

**Usage Example**:
```bash
# Verify all relationships
npx tsx scripts/buildium/verify/verify-relationships.ts

# Check property data integrity
npx tsx scripts/buildium/verify/check-property-fields.ts
```

### 3. **Database Scripts** (`scripts/database/`)
**Purpose**: Database management and maintenance

**When to Use**:
- Database schema updates
- Data migration
- Database maintenance

**Key Scripts**:
- `backup-database.ts` - Create database backup
- `restore-database.ts` - Restore from backup
- `cleanup-orphaned-records.ts` - Clean up orphaned data
- `optimize-database.ts` - Database optimization

### 4. **API Scripts** (`scripts/api/`)
**Purpose**: API testing and development

**When to Use**:
- Testing API endpoints
- API development
- Performance testing

**Key Scripts**:
- `test-api-endpoints.ts` - Test all API endpoints
- `load-test-api.ts` - Load testing
- `api-performance-test.ts` - Performance testing

### 5. **Utility Scripts** (`scripts/utils/`)
**Purpose**: General utility functions

**When to Use**:
- Data processing
- File operations
- System utilities

**Key Scripts**:
- `data-export.ts` - Export data to various formats
- `data-import.ts` - Import data from various formats
- `file-cleanup.ts` - Clean up temporary files
- `log-analysis.ts` - Analyze system logs

### 6. **SQL Scripts** (`scripts/sql/`)
**Purpose**: Direct SQL operations

**When to Use**:
- Complex database queries
- Data analysis
- One-time data operations

**Key Scripts**:
- `add_bill_id_to_transaction_lines.sql` - Add bill IDs to transaction lines
- `fix_generate_display_name.sql` - Fix display name generation
- `fix_ownerships_triggers.sql` - Fix ownership triggers

## 🚀 Common Workflows

### **Workflow 1: Adding a New Property**
```bash
# 1. Create property in Buildium
npx tsx scripts/buildium/create/add-buildium-property.ts

# 2. Verify property creation
npx tsx scripts/buildium/verify/check-local-property.ts

# 3. Add units
npx tsx scripts/buildium/create/add-buildium-property.ts [property-id]

# 4. Verify units
npx tsx scripts/buildium/verify/check-unit-created.ts
```

### **Workflow 2: Data Synchronization**
```bash
# 1. Sync bank accounts
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# 2. Fetch lease transactions
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts

# 3. Verify relationships
npx tsx scripts/buildium/verify/verify-relationships.ts
```

### **Workflow 3: Data Verification**
```bash
# 1. Check property data
npx tsx scripts/buildium/verify/check-property-fields.ts

# 2. Verify relationships
npx tsx scripts/buildium/verify/verify-relationships.ts

# 3. Check transaction lines
npx tsx scripts/buildium/verify/verify-buildium-transaction-lines.ts
```

## 📋 Script Execution Order

### **Initial Setup**
1. `scripts/setup/setup-environment.ts`
2. `scripts/setup/setup-database.ts`
3. `scripts/buildium/create/test-buildium-connection.ts`

### **Adding New Property**
1. `scripts/buildium/create/add-buildium-property.ts`
2. `scripts/buildium/verify/check-local-property.ts`
3. `scripts/buildium/create/add-buildium-property.ts [property-id]`
4. `scripts/buildium/verify/check-unit-created.ts`

### **Data Synchronization**
1. `scripts/buildium/sync/sync-buildium-bank-accounts.ts`
2. `scripts/buildium/sync/fetch-all-lease-transactions.ts`
3. `scripts/buildium/verify/verify-relationships.ts`

### **Troubleshooting**
1. `scripts/buildium/verify/check-property-fields.ts`
2. `scripts/buildium/verify/verify-relationships.ts`
3. `scripts/buildium/verify/verify-buildium-transaction-lines.ts`

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
2. Move to `scripts/deprecated/` directory
3. Update references in other scripts
4. Remove after appropriate grace period
