#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

function projectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function buildRemoteDatabaseUrl(): string | null {
  const ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) return null;
  return `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function checkUserPermissions() {
  const dbUrl = buildRemoteDatabaseUrl();
  if (!dbUrl) {
    console.error('Could not build remote database URL.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const userEmail = 'brandon@managedbyora.com';
    console.log(`=== ACCESS REPORT FOR ${userEmail} ===\n`);

    // 1. Check if user exists
    const userResult = await client.query(
      `
      SELECT id, email, created_at, email_confirmed_at, last_sign_in_at
      FROM auth.users
      WHERE email = $1
    `,
      [userEmail],
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found in auth.users');
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ USER FOUND');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
    console.log();

    // 2. Check org_memberships
    const orgMembershipsResult = await client.query(
      `
      SELECT om.*, o.name as org_name, o.slug as org_slug
      FROM public.org_memberships om
      LEFT JOIN public.organizations o ON o.id = om.org_id
      WHERE om.user_id = $1
    `,
      [user.id],
    );

    console.log('=== ORG_MEMBERSHIPS ===');
    if (orgMembershipsResult.rows.length === 0) {
      console.log('❌ No org_memberships found');
      console.log('   → User is NOT a member of any organization');
    } else {
      console.log(`✅ Found ${orgMembershipsResult.rows.length} org membership(s):`);
      orgMembershipsResult.rows.forEach((row) => {
        console.log(`   - ${row.org_name} (${row.org_slug})`);
        console.log(`     org_id: ${row.org_id}`);
        console.log(`     created: ${row.created_at}`);
      });
    }
    console.log();

    // 3. Check membership_roles (new RBAC)
    const membershipRolesResult = await client.query(
      `
      SELECT mr.*, r.name as role_name, r.description as role_description, o.name as org_name
      FROM public.membership_roles mr
      LEFT JOIN public.roles r ON r.id = mr.role_id
      LEFT JOIN public.organizations o ON o.id = mr.org_id
      WHERE mr.user_id = $1
    `,
      [user.id],
    );

    console.log('=== MEMBERSHIP_ROLES (New RBAC) ===');
    if (membershipRolesResult.rows.length === 0) {
      console.log('❌ No membership_roles found');
      console.log('   → User has NO roles assigned in the new RBAC system');
    } else {
      console.log(`✅ Found ${membershipRolesResult.rows.length} role assignment(s):`);
      membershipRolesResult.rows.forEach((row) => {
        console.log(`   - ${row.role_name} in ${row.org_name}`);
        console.log(`     Description: ${row.role_description || '(none)'}`);
      });
    }
    console.log();

    // 4. Check legacy profiles table
    const profileResult = await client.query(
      `
      SELECT * FROM public.profiles WHERE user_id = $1
    `,
      [user.id],
    );

    console.log('=== PROFILES (Legacy) ===');
    if (profileResult.rows.length === 0) {
      console.log('❌ No profile found');
    } else {
      const profile = profileResult.rows[0];
      console.log('✅ Profile found:');
      console.log(`   Role: ${profile.role || '(none)'}`);
      console.log(`   Full name: ${profile.full_name || '(none)'}`);
    }
    console.log();

    // 5. Check what organizations exist
    const orgsResult = await client.query(`
      SELECT id, name, slug, buildium_org_id
      FROM public.organizations
      ORDER BY created_at
    `);

    console.log('=== ALL ORGANIZATIONS ===');
    console.log(`Total: ${orgsResult.rows.length}`);
    orgsResult.rows.forEach((row) => {
      console.log(`   - ${row.name} (${row.slug})`);
      console.log(`     ID: ${row.id}`);
      console.log(`     Buildium: ${row.buildium_org_id || 'not linked'}`);
    });
    console.log();

    // 6. Check what roles exist
    const rolesResult = await client.query(`
      SELECT r.*, o.name as org_name
      FROM public.roles r
      LEFT JOIN public.organizations o ON o.id = r.org_id
      ORDER BY r.is_system DESC, r.name
    `);

    console.log('=== ALL ROLES ===');
    console.log(`Total: ${rolesResult.rows.length}`);
    if (rolesResult.rows.length === 0) {
      console.log('❌ No roles defined in the system!');
    } else {
      rolesResult.rows.forEach((row) => {
        console.log(`   - ${row.name}`);
        console.log(`     Scope: ${row.is_system ? 'SYSTEM' : `Org: ${row.org_name}`}`);
        console.log(`     Description: ${row.description || '(none)'}`);
      });
    }
    console.log();

    // 7. Check RLS policies on properties
    const policiesResult = await client.query(`
      SELECT p.polname as policyname, 
             p.polcmd as cmd,
             pg_get_expr(p.polqual, p.polrelid) as using_clause,
             pg_get_expr(p.polwithcheck, p.polrelid) as with_check_clause
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'properties'
      ORDER BY p.polname
    `);

    console.log('=== RLS POLICIES ON PROPERTIES ===');
    console.log(`Total policies: ${policiesResult.rows.length}`);
    policiesResult.rows.forEach((row) => {
      console.log(`\n   Policy: ${row.policyname}`);
      console.log(`   Command: ${row.cmd}`);
      console.log(`   USING: ${row.using_clause || '(none)'}`);
      if (row.with_check_clause) {
        console.log(`   WITH CHECK: ${row.with_check_clause}`);
      }
    });
    console.log();

    // 8. Summary and explanation
    console.log('=== SUMMARY: HOW USER CAN ACCESS PLATFORM ===\n');

    if (policiesResult.rows.some((p) => p.using_clause?.includes('authenticated'))) {
      console.log('✅ PERMISSIVE POLICIES FOUND');
      console.log('   The properties table (and likely other tables) have RLS policies');
      console.log('   that allow ANY authenticated user to access data.');
      console.log();
      console.log('   Example: properties_authenticated_read');
      console.log("   USING: (auth.role() = 'authenticated')");
      console.log();
      console.log('   This means brandon@managedbyora.com can access the platform');
      console.log('   simply by being logged in, WITHOUT needing:');
      console.log('   - org_memberships');
      console.log('   - membership_roles');
      console.log('   - roles or permissions');
      console.log();
    }

    if (orgMembershipsResult.rows.length === 0 && membershipRolesResult.rows.length === 0) {
      console.log('⚠️  RBAC NOT ENFORCED');
      console.log('   The new RBAC system is built but not populated or enforced.');
      console.log('   User access is currently granted by permissive RLS policies,');
      console.log('   not by the RBAC system.');
      console.log();
    }

    if (rolesResult.rows.length === 0) {
      console.log('⚠️  NO ROLES DEFINED');
      console.log('   The roles table is empty. You need to seed default roles:');
      console.log('   - org_admin (full access to organization)');
      console.log('   - org_manager (manage properties, leases, etc.)');
      console.log('   - accountant (financial access)');
      console.log('   - property_manager (property-specific access)');
      console.log('   - member (basic read access)');
      console.log();
    }

    console.log('=== NEXT STEPS ===');
    console.log('1. Seed default roles in the roles table');
    console.log('2. Seed default permissions in the permissions table');
    console.log('3. Map roles to permissions in role_permissions');
    console.log('4. Create org_memberships for existing users');
    console.log('5. Assign membership_roles to users');
    console.log('6. Verify Phase 7 RLS policies are active (or manually update)');
    console.log('7. Test that RBAC enforcement works correctly');
  } finally {
    await client.end();
  }
}

checkUserPermissions().catch((e) => {
  console.error(e);
  process.exit(1);
});
