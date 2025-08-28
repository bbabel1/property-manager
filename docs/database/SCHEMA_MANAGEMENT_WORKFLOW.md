# Database Schema Management Workflow

## Overview

This document explains the database schema management workflow for the property manager project. We use a hybrid approach that combines migration-based version control with auto-generated current schema files.

## The Problem

Traditional migration-only approaches have a key limitation: **it's difficult to see the current state of the database schema**. You have to mentally apply all migrations in sequence to understand what the database actually looks like now.

## Our Solution

We maintain both:
1. **Migration History** (`supabase/migrations/`) - Shows the evolution of changes
2. **Current Schema** (`docs/database/current_schema.sql`) - Shows the current state

## Workflow Commands

### After Making Schema Changes
```bash
# Update all database-related files
npm run db:docs
```

This single command runs:
1. `npm run db:schema` - Generates current schema from database
2. `npm run db:types` - Generates TypeScript types
3. `npm run docs:update` - Updates documentation

### Individual Commands
```bash
# Generate current database schema
npm run db:schema

# Generate TypeScript types from database
npm run db:types

# Update documentation
npm run docs:update
```

## File Structure

### Auto-Generated Files (Do Not Edit Manually)
- `docs/database/current_schema.sql` - Current database schema
- `src/types/database.ts` - TypeScript types matching database
- `docs/database/database-schema.md` - Human-readable schema documentation

### Manual Files (Version Controlled)
- `supabase/migrations/` - Migration history
- `docs/database/SCHEMA_MANAGEMENT_WORKFLOW.md` - This file

## Best Practices

### ✅ Do This
- Run `npm run db:docs` after any schema changes
- Use `docs/database/current_schema.sql` as the authoritative current schema
- Reference `src/types/database.ts` for TypeScript types
- Keep migration files for version control and rollback capability

### ❌ Don't Do This
- Edit auto-generated files manually
- Rely only on migration files to understand current schema
- Forget to run `npm run db:docs` after changes
- Commit auto-generated files without regenerating them

## Why This Approach?

1. **Single Source of Truth**: The database itself is authoritative
2. **Migration History**: Preserved for rollbacks and team collaboration
3. **Auto-generated**: Reduces human error in documentation
4. **Type Safety**: Generated TypeScript types match actual database
5. **Current State**: Easy to see what the database looks like now

## Troubleshooting

### Schema Out of Sync
If you suspect the current schema is outdated:
```bash
npm run db:docs
```

### TypeScript Types Mismatch
If TypeScript complains about database types:
```bash
npm run db:types
```

### Documentation Outdated
If documentation doesn't match reality:
```bash
npm run docs:update
```

## Integration with Development Workflow

### Before Starting Work
```bash
npm run db:schema  # Get latest schema
```

### After Schema Changes
```bash
npm run db:docs    # Update everything
```

### Before Committing
```bash
npm run db:docs    # Ensure everything is current
```

This workflow ensures that your code, documentation, and database schema stay in sync throughout development.
