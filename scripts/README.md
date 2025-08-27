# Scripts Directory

> **Last Updated**: 2025-08-25
> 
> This directory contains all scripts for the Property Management System, organized by purpose and functionality.

## 📁 Directory Structure

```
scripts/
├── README.md                           # This file - Main documentation
├── doc-monitoring-system.ts            # Documentation monitoring system
├── show-organization.ts                # Shows current organization structure
├── setup/                              # Initial setup and configuration
│   ├── README.md                       # Setup scripts documentation
│   ├── setup-environment.ts            # Environment validation
│   ├── setup-database.ts               # Database initialization
│   └── setup-buildium-connection.ts    # Buildium connection test
├── workflows/                          # Complete workflow demonstrations
│   ├── README.md                       # Workflow scripts documentation
│   └── add-new-property-workflow.ts    # Complete property addition workflow
├── buildium/                           # Buildium integration scripts
│   ├── README.md                       # Buildium scripts documentation
│   ├── create/                         # Entity creation scripts
│   ├── sync/                           # Data synchronization scripts
│   └── verify/                         # Data verification scripts
├── maintenance/                        # Database maintenance and cleanup
│   ├── README.md                       # Maintenance scripts documentation
│   ├── cleanup-orphaned-records.ts     # Clean up orphaned data
│   ├── optimize-database.ts            # Database optimization
│   ├── backup-database.ts              # Database backup
│   ├── restore-database.ts             # Database restore
│   └── verify-data-integrity.ts        # Data integrity verification
├── api/                                # API testing and development
├── database/                           # Database management scripts
├── sql/                                # SQL utility scripts
├── utils/                              # Utility scripts
└── deprecated/                         # Deprecated scripts (for reference)
```

## 🚀 Quick Start for New Users

### **1. Initial Setup**
```bash
# Validate environment configuration
npx tsx scripts/setup/setup-environment.ts

# Test Buildium connection
npx tsx scripts/setup/setup-buildium-connection.ts
```

### **2. Adding a New Property (Complete Workflow)**
```bash
# Run the complete workflow demonstration
npx tsx scripts/workflows/add-new-property-workflow.ts

# Or follow the manual steps in the Quick Start Guide
# See: docs/QUICK_START_GUIDE.md
```

### **3. Data Synchronization**
```bash
# Sync bank accounts from Buildium
npx tsx scripts/buildium/sync/sync-buildium-bank-accounts.ts

# Fetch lease transactions
npx tsx scripts/buildium/sync/fetch-all-lease-transactions.ts

# Verify relationships
npx tsx scripts/buildium/verify/verify-relationships.ts
```

## 📋 Script Categories

### **Setup Scripts** (`setup/`)
- **Purpose**: Initial project setup and configuration
- **When to Use**: First-time setup or environment changes
- **Key Scripts**: Environment validation, database setup, Buildium connection test

### **Workflow Scripts** (`workflows/`)
- **Purpose**: Complete workflow demonstrations
- **When to Use**: Reference for proper operation sequences
- **Key Scripts**: Property addition workflow, data synchronization patterns

### **Buildium Integration Scripts** (`buildium/`)
- **Purpose**: Buildium API integration and data synchronization
- **When to Use**: Adding entities, syncing data, verifying relationships
- **Categories**: Create, Sync, Verify

### **Maintenance Scripts** (`maintenance/`)
- **Purpose**: Database maintenance and optimization
- **When to Use**: Regular maintenance, cleanup, performance optimization
- **Key Scripts**: Data cleanup, database optimization, backup/restore

### **API Scripts** (`api/`)
- **Purpose**: API testing and development
- **When to Use**: Testing endpoints, development, performance testing

### **Database Scripts** (`database/`)
- **Purpose**: Database management operations
- **When to Use**: Schema updates, data migration, database operations

### **SQL Scripts** (`sql/`)
- **Purpose**: Direct SQL operations
- **When to Use**: Complex queries, data analysis, one-time operations

### **Utility Scripts** (`utils/`)
- **Purpose**: General utility functions
- **When to Use**: Data processing, file operations, system utilities

## 🎯 Common Workflows

### **Adding a New Property**
1. Run setup scripts to validate environment
2. Use workflow script as reference or run manually
3. Verify data creation and relationships
4. Check Buildium sync status

### **Data Synchronization**
1. Sync bank accounts from Buildium
2. Fetch lease transactions
3. Verify relationships and data integrity
4. Check for any sync errors

### **Troubleshooting**
1. Check property data integrity
2. Verify entity relationships
3. Check transaction line integrity
4. Validate overall data consistency

## 🔧 Script Configuration

### **Environment Variables**
All scripts require these environment variables:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://apisandbox.buildium.com/v1
```

### **Script Execution**
```bash
# Run any script with tsx
npx tsx scripts/[category]/[script-name].ts

# Example: Run environment setup
npx tsx scripts/setup/setup-environment.ts

# Example: Run property workflow
npx tsx scripts/workflows/add-new-property-workflow.ts
```

## 📚 Documentation

### **Quick Start Guide**
- [Quick Start Guide](../docs/QUICK_START_GUIDE.md) - Step-by-step instructions for new users

### **Script Organization**
- [Scripts Organization Guide](../docs/SCRIPTS_ORGANIZATION.md) - Detailed script organization and usage

### **Buildium Integration**
- [Buildium Integration Guide](../docs/buildium-integration-guide.md) - Complete Buildium integration documentation

### **API Documentation**
- [API Documentation](../docs/api/api-documentation.md) - API endpoints and usage

### **Database Schema**
- [Database Schema](../docs/database/DATABASE_SCHEMA.md) - Database structure and relationships

## 🚨 Important Notes

### **Script Safety**
- Always backup data before running scripts
- Test scripts in development environment first
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

## 🔄 Script Maintenance

### **Adding New Scripts**
1. Place in appropriate category directory
2. Follow naming convention: `action-entity-description.ts`
3. Add documentation in category README
4. Update this main README if needed

### **Updating Scripts**
1. Test changes in development environment
2. Update documentation
3. Version control all changes
4. Notify team of breaking changes

### **Deprecating Scripts**
1. Mark as deprecated in documentation
2. Move to `deprecated/` directory
3. Update references in other scripts
4. Remove after appropriate grace period

## 📞 Getting Help

### **For New Users**
1. Start with the [Quick Start Guide](../docs/QUICK_START_GUIDE.md)
2. Use workflow scripts as reference
3. Check script documentation in each category
4. Verify environment configuration

### **For Developers**
1. Review script organization guide
2. Check Buildium integration documentation
3. Use API documentation for endpoint details
4. Monitor script execution and logs

### **For Troubleshooting**
1. Check script output for error messages
2. Verify data integrity with verification scripts
3. Check Buildium sync status
4. Review database schema documentation
