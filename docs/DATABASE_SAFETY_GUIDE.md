# Database Safety Guide

## 🚨 CRITICAL: Preventing Database Resets

This guide ensures safe database operations and prevents accidental data loss.

## What Went Wrong

The previous database reset occurred because:

1. **Misguided "checking" approach**: Agent tried to "verify" database state by resetting
2. **Lack of established patterns**: Didn't follow the safe migration workflow
3. **Dangerous assumptions**: Assumed database reset was needed for verification

## 🛡️ Database Safety Rules

### 1. NEVER Reset Databases

```bash
# ❌ BANNED COMMANDS - These destroy data
npx supabase db reset
npx supabase db reset --linked
npx supabase db push  # (without explicit confirmation)
```

### 2. Safe Database Inspection

```bash
# ✅ SAFE - Check database status
npx supabase status

# ✅ SAFE - View applied migrations
npx supabase db diff --schema public

# ✅ SAFE - Check table schema
npx tsx scripts/database/get-table-schema.ts [table_name]

# ✅ SAFE - View migration history
ls -la supabase/migrations/
```

### 3. Safe Migration Application

```bash
# ✅ SAFE - Apply migrations via Supabase Dashboard
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy migration SQL from supabase/migrations/
# 3. Paste and run in dashboard
# 4. Verify with safe queries
```

## 📋 Safe Migration Workflow

### Step 1: Check Current State

```bash
# Check what migrations exist
ls -la supabase/migrations/

# Check what's applied
npx supabase db diff --schema public

# Check current schema
npx tsx scripts/database/get-table-schema.ts [table_name]
```

### Step 2: Create Migration (if needed)

```sql
-- Migration: Add [field_name] to [table_name] table
-- Description: [Clear description of what this field does]

ALTER TABLE "public"."[table_name]"
ADD COLUMN "[field_name]" [data_type] [constraints];

COMMENT ON COLUMN "public"."[table_name]"."[field_name]" IS '[description]';
```

### Step 3: Apply Migration Safely

1. **Copy migration SQL** from `supabase/migrations/`
2. **Go to Supabase Dashboard** → SQL Editor
3. **Paste and run** the migration
4. **Verify success** with safe queries

### Step 4: Update Code

1. **Update TypeScript types** in `src/types/`
2. **Update mappers** if needed in `src/lib/buildium-mappers.ts`
3. **Update documentation** in `docs/database/`

### Step 5: Test Safely

```bash
# Test with safe queries
npx tsx scripts/database/get-table-schema.ts [table_name]

# Check if field exists
npx tsx -e "
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
supabase.from('[table_name]').select('[field_name]').limit(1).then(console.log)
"
```

## 🚨 Emergency Stop Protocol

### If AI Assistant Suggests Database Reset

1. **STOP immediately** - Do not execute the command
2. **Ask for clarification** - Request safe alternatives
3. **Use safe inspection methods** instead
4. **Follow established patterns** from this guide

### Red Flag Commands

- `supabase db reset`
- `supabase db reset --linked`
- `supabase db push` (without explanation)
- Any command that could destroy data

## 🔧 Database Recovery

### If Database is Accidentally Reset

```bash
# 1. Check migration status
npx supabase db diff --schema public

# 2. Apply missing migrations via dashboard
# 3. Check if data needs restoration
npx tsx scripts/database/get-table-schema.ts [table_name]

# 4. Restore from backups if needed
```

### Backup Strategy

- **Regular backups**: Use Supabase dashboard backups
- **Migration files**: Keep all migration files in version control
- **Documentation**: Keep schema documentation updated

## 📚 Safe Database Commands Reference

### Inspection Commands (Safe)

```bash
# Check Supabase status
npx supabase status

# View migration differences
npx supabase db diff --schema public

# Check table schema
npx tsx scripts/database/get-table-schema.ts [table_name]

# List migration files
ls -la supabase/migrations/
```

### Application Commands (Use with Caution)

```bash
# Apply migrations via dashboard (SAFE)
# Copy SQL from supabase/migrations/ and run in Supabase Dashboard

# Start local Supabase (SAFE)
npx supabase start

# Stop local Supabase (SAFE)
npx supabase stop
```

## 🎯 Best Practices

### 1. Always Use Safe Inspection

- Check existing schema before making changes
- Use established patterns from this guide
- Never assume database state

### 2. Follow Migration Workflow

- Create migration files in `supabase/migrations/`
- Apply via Supabase Dashboard SQL Editor
- Update TypeScript types and documentation
- Test with safe queries

### 3. Document Changes

- Update `docs/database/current-schema.md`
- Update TypeScript interfaces
- Update API documentation if needed

### 4. Test Safely

- Use safe queries to verify changes
- Test with small datasets
- Never test with destructive operations

## 📞 Emergency Contacts

If you encounter database issues:

1. **Check this guide first**
2. **Use safe inspection commands**
3. **Follow established patterns**
4. **Ask for clarification before executing any destructive commands**

Remember: **When in doubt, use safe inspection methods instead of destructive operations.**
