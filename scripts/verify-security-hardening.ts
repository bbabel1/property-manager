#!/usr/bin/env tsx
/**
 * Verification script for security hardening migrations
 * Provides SQL query to verify search_path is set on target functions/procedures
 * 
 * Note: This script provides the SQL query to run manually since Supabase
 * doesn't expose a direct way to run arbitrary SQL via the client.
 */

async function main() {
  console.log('🔒 Security Hardening Verification\n');
  console.log('='.repeat(50) + '\n');

  console.log('📋 To verify search_path configuration, run this SQL in Supabase SQL Editor:\n');
  
  const verificationQuery = `-- Verify search_path on target functions/procedures
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
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);`;

  console.log(verificationQuery);
  console.log('\n✅ Expected results:');
  console.log('   - refresh_gl_account_balances(uuid, date) → ✓ Has search_path');
  console.log('   - fn_units_copy_address_from_property() → ✓ Has search_path\n');

  console.log('📝 Remaining tasks (see docs/security/complete-security-hardening-steps.md):');
  console.log('   1. Enable HIBP password protection in Dashboard');
  console.log('   2. Re-run Security Advisor in Dashboard');
  console.log('   3. Schedule and execute Postgres patch upgrade\n');
  
  console.log('📍 Quick links:');
  console.log('   - Dashboard: https://app.supabase.com');
  console.log('   - Auth Settings: Dashboard → Authentication → Settings');
  console.log('   - Security Advisor: Dashboard → Settings → Security');
  console.log('   - Database Upgrade: Dashboard → Settings → Database → Maintenance/Upgrades\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
