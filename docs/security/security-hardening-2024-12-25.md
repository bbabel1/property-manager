# Security Hardening - December 25, 2024

## Completed Actions

### ✅ Migration Applied: Harden Remaining Search Paths

**File**: `supabase/migrations/20291225000005_harden_remaining_search_paths.sql`

Successfully applied migration that pins `search_path = public` for:
- `public.refresh_gl_account_balances(uuid, date)` (PROCEDURE)
- `public.fn_units_copy_address_from_property()` (FUNCTION)

This completes the security hardening started in migration `20291225000004_secure_search_path_and_permissions.sql`.

**Verification**: Re-run the Supabase Security Advisor linter to confirm warnings are cleared.

## 📖 Complete Instructions

**For detailed step-by-step instructions to complete the remaining tasks, see:**
**[`docs/security/complete-security-hardening-steps.md`](./complete-security-hardening-steps.md)**

This guide includes:
- ✅ Detailed navigation paths
- ✅ Screenshot descriptions
- ✅ Verification steps
- ✅ SQL queries to verify database state
- ✅ Risk assessments and timing estimates

## Manual Actions Required

### 🔒 Enable Leaked Password Protection (HIBP)

**Status**: ⚠️ Requires manual configuration in Supabase Dashboard

**Action Required**:
1. Go to Supabase Dashboard → Your Project
2. Navigate to **Auth** → **Passwords**
3. Toggle **"Check passwords against HIBP"** to enabled

**Alternative (if managing via config)**:
- Set environment variable `ENABLE_LEAKED_PASSWORD_PROTECTION=true` in your project settings
- Redeploy your project

**Note**: This setting checks user passwords against the Have I Been Pwned (HIBP) database to prevent use of compromised passwords.

### ✅ Postgres Patch Upgrade

**Status**: ✅ **COMPLETED** - Successfully upgraded

**Previous Version**: `supabase-postgres-17.4.1.069`
**Current Version**: `supabase-postgres-17.6.1.063` (Postgres 17)

**Completed**: Project successfully upgraded and is now back online with latest security patches.

**Steps**:
1. **Schedule a maintenance window** (upgrade may require brief downtime)
2. **Verify backups** are up-to-date before proceeding
3. **Initiate upgrade**:
   - Go to Supabase Dashboard → Your Project
   - Navigate to **Settings** → **Database** → **Maintenance/Upgrades**
   - Follow the on-screen instructions to upgrade to the latest patch release
4. **Post-upgrade verification**:
   - Test critical application functions
   - Monitor logs for any issues
   - Verify database connectivity and queries

**Reference**: [Supabase Upgrade Guide](https://supabase.com/docs/guides/platform/upgrading)

## Related Migrations

- `20291225000004_secure_search_path_and_permissions.sql` - Initial security hardening
- `20291225000005_harden_remaining_search_paths.sql` - Additional search_path hardening

## Summary

✅ **Completed Tasks:**
- Migration applied: `20291225000005_harden_remaining_search_paths.sql`
- Postgres upgraded: `17.4.1.069` → `17.6.1.063`

⏭️ **Next Steps:**
- Re-run Security Advisor to verify all warnings are cleared

