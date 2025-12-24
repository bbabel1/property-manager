# Workflow Scripts

> **Purpose**: Complete workflow scripts that demonstrate proper sequences of operations

## Overview

This directory contains comprehensive workflow scripts that demonstrate the correct sequence of operations for common
tasks in the Property Management System.

## Scripts

### `add-new-property-workflow.ts`

**Purpose**: Complete workflow for adding a new property with all related entities
**When to Use**: Reference for proper sequence of operations when adding new properties
**Demonstrates**:

- Property creation
- Unit creation
- Owner creation
- Ownership relationship creation
- Tenant creation
- Lease creation
- Lease contact linking
- Rent schedule creation

**Usage**:

```bash
# Run the complete workflow (for demonstration)
npx tsx scripts/workflows/add-new-property-workflow.ts

# Or use as reference for manual operations
```

## Workflow Patterns

### **Property Addition Pattern**

1. Create Property
2. Add Units
3. Create Owners
4. Create Ownership Relationships
5. Create Tenants
6. Create Leases
7. Link Tenants to Leases
8. Create Rent Schedules

### **Data Synchronization Pattern**

1. Sync Bank Accounts
2. Fetch Lease Transactions
3. Verify Relationships
4. Check Data Integrity

### **Troubleshooting Pattern**

1. Check Property Data
2. Verify Relationships
3. Check Transaction Lines
4. Validate Data Integrity

## Usage Guidelines

### **For New Users**

- Use these workflows as reference for proper operation sequences
- Follow the patterns demonstrated in the scripts
- Adapt the data to your specific needs

### **For Development**

- Use these scripts as templates for new workflows
- Ensure proper error handling and validation
- Add appropriate logging and status updates

### **For Testing**

- Use these scripts to test complete workflows
- Verify data integrity after workflow completion
- Check Buildium sync status

## Notes

- These scripts are designed for demonstration and reference
- Modify data values to match your specific requirements
- Always verify results after running workflows
- Check Buildium sync status for integrated operations
