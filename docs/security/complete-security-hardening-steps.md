# Complete Security Hardening Steps

This guide provides step-by-step instructions to complete the remaining security hardening tasks.

## ✅ Already Completed

- Migration `20291225000005_harden_remaining_search_paths.sql` has been applied
- Database functions/procedures now have `search_path = public` set

## 📋 Remaining Tasks

### 1. Enable Leaked Password Protection (HIBP)

**Time Required**: 2 minutes  
**Risk Level**: Low (no downtime)

#### Steps:

1. **Log in to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Sign in with your credentials

2. **Navigate to Your Project**
   - Select your project from the project list
   - If you have multiple projects, select the one you're working on

3. **Go to Authentication Settings**
   - In the left sidebar, click **"Authentication"**
   - Click **"Settings"** (under the Authentication section)

4. **Enable HIBP Protection**
   - Scroll down to the **"Password Security"** section
   - Find the toggle for **"Prevent leaked passwords"** or **"Check passwords against HIBP"**
   - Toggle it to **ON/Enabled**
   - The setting should save automatically

**Verification**:
- The toggle should show as enabled/ON
- New user signups will now check passwords against the Have I Been Pwned database

**Note**: This feature is available on Pro Plan and above. If you don't see this option, you may need to upgrade your plan.

---

### 2. Re-run Security Advisor Linter

**Time Required**: 5 minutes  
**Risk Level**: None (read-only operation)

#### Steps:

1. **Navigate to Security Settings**
   - In your Supabase project dashboard
   - In the left sidebar, click **"Project Settings"** (gear icon at the bottom)
   - Click **"Security"** in the settings menu

2. **Run Security Advisor**
   - Look for the **"Security Advisor"** section
   - Click the **"Run Security Advisor"** or **"Scan Now"** button
   - Wait for the scan to complete (usually takes 1-2 minutes)

3. **Review Results**
   - Check that the warnings for:
     - `refresh_gl_account_balances(uuid, date)` missing search_path
     - `fn_units_copy_address_from_property()` missing search_path
   - Should now be **cleared/resolved**

**Verification**:
- The Security Advisor should show 0 warnings for search_path issues on these functions
- All previously flagged functions should show as secure

---

### 3. Postgres Patch Upgrade

**Time Required**: 15-30 minutes (including verification)  
**Risk Level**: Medium (may cause brief downtime)  
**⚠️ IMPORTANT: Schedule a maintenance window**

#### Pre-Upgrade Checklist

- [ ] **Schedule a maintenance window** (recommend off-peak hours)
- [ ] **Verify backups are current**
  - Go to Settings → Database → Backups
  - Confirm latest backup is recent and successful
- [ ] **Notify team/stakeholders** of scheduled maintenance
- [ ] **Document current version**: `supabase-postgres-17.4.1.069`

#### Steps:

1. **Navigate to Database Settings**
   - In your Supabase project dashboard
   - Click **"Project Settings"** (gear icon)
   - Click **"Database"** in the settings menu

2. **Check Current Version**
   - Under **"Infrastructure"** section, note your current PostgreSQL version
   - Current: `supabase-postgres-17.4.1.069`
   - Target: Latest patch release (check what's available)

3. **Initiate Upgrade**
   - Scroll to **"Maintenance/Upgrades"** section
   - Click **"Upgrade project"** or **"Upgrade database"** button
   - Review the upgrade details and estimated downtime
   - Click **"Confirm upgrade"** or **"Start upgrade"**

4. **Monitor Upgrade Progress**
   - The upgrade process will show progress
   - Typical duration: 5-15 minutes
   - Your project will be temporarily unavailable during upgrade

5. **Post-Upgrade Verification**
   - **Check database version**: Should show new patch version
   - **Test critical functionality**:
     - Database connections
     - API endpoints
     - Authentication flows
     - Key queries and operations
   - **Review logs** for any errors or warnings
   - **Monitor application** for unexpected behavior

#### Rollback Plan (if needed)

If issues occur after upgrade:
1. Contact Supabase support immediately
2. Document specific errors or issues
3. Supabase may be able to rollback, but this is not guaranteed
4. Have backup restoration plan ready if needed

#### Reference

- [Supabase Upgrade Guide](https://supabase.com/docs/guides/platform/upgrading)
- [PostgreSQL Release Notes](https://www.postgresql.org/docs/current/release.html)

---

## 📊 Verification Script

You can run a verification script to check the database state:

```bash
# Make sure you have the environment variables set
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the verification script
npx tsx scripts/verify-security-hardening.ts
```

Or verify manually in Supabase SQL Editor:

```sql
-- Check search_path on target functions/procedures
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prokind as kind,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c
      WHERE c LIKE 'search_path=%'
    ) THEN '✓ Has search_path'
    ELSE '✗ Missing search_path'
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    (p.proname = 'refresh_gl_account_balances' AND p.prokind = 'p')
    OR (p.proname = 'fn_units_copy_address_from_property' AND p.prokind = 'f')
  )
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);
```

Expected results:
- Both functions should show `✓ Has search_path`

---

## 🎯 Completion Checklist

- [x] Migration applied: `20291225000005_harden_remaining_search_paths.sql`
- [ ] HIBP password protection enabled
- [ ] Security Advisor re-run and warnings cleared
- [ ] Postgres patch upgrade completed (if applicable)
- [ ] Post-upgrade verification completed

---

## 📞 Support

If you encounter any issues:
1. Check Supabase documentation: https://supabase.com/docs
2. Review Supabase status page: https://status.supabase.com
3. Contact Supabase support via dashboard

