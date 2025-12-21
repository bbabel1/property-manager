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

async function reviewTables() {
  const dbUrl = buildRemoteDatabaseUrl();
  if (!dbUrl) {
    console.error('Could not build remote database URL.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log('Reviewing remote database tables...\n');

    // Get all tables with row counts and column info
    const tablesResult = await client.query(`
      SELECT 
        t.table_name,
        t.table_type,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)) as size,
        (SELECT count(*) FROM information_schema.columns c 
         WHERE c.table_schema = 'public' AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY 
        CASE t.table_type 
          WHEN 'BASE TABLE' THEN 1 
          WHEN 'VIEW' THEN 2 
        END,
        t.table_name
    `);

    console.log('=== BASE TABLES ===');
    const baseTables = tablesResult.rows.filter((r) => r.table_type === 'BASE TABLE');
    baseTables.forEach((row) => {
      console.log(`${row.table_name.padEnd(40)} | ${row.column_count} cols | ${row.size}`);
    });
    console.log(`\nTotal base tables: ${baseTables.length}`);

    console.log('\n=== VIEWS ===');
    const views = tablesResult.rows.filter((r) => r.table_type === 'VIEW');
    views.forEach((row) => {
      console.log(`${row.table_name.padEnd(40)} | ${row.column_count} cols`);
    });
    console.log(`\nTotal views: ${views.length}`);

    // Check for cache tables
    console.log('\n=== CACHE TABLES ===');
    const cacheTables = baseTables.filter((r) => r.table_name.includes('cache'));
    cacheTables.forEach((row) => {
      console.log(`${row.table_name.padEnd(40)} | ${row.size}`);
    });

    // Check for sync/log tables
    console.log('\n=== SYNC/LOG TABLES ===');
    const syncTables = baseTables.filter(
      (r) =>
        r.table_name.includes('sync') ||
        r.table_name.includes('log') ||
        r.table_name.includes('audit') ||
        r.table_name.includes('webhook'),
    );
    syncTables.forEach((row) => {
      console.log(`${row.table_name.padEnd(40)} | ${row.size}`);
    });

    // Check for potentially redundant tables
    console.log('\n=== POTENTIAL REDUNDANCIES ===');

    // Check for org_membership_roles (should be replaced by membership_roles)
    const orgMembershipRoles = baseTables.find((r) => r.table_name === 'org_membership_roles');
    if (orgMembershipRoles) {
      console.log('⚠️  org_membership_roles - Should be replaced by membership_roles');
    }

    // Check for old permission tables
    const oldPermTables = baseTables.filter(
      (r) =>
        r.table_name === 'permission_profiles' ||
        r.table_name === 'permission_profile_permissions' ||
        r.table_name === 'user_permission_profiles',
    );
    if (oldPermTables.length > 0) {
      console.log(
        '⚠️  Old permission tables still exist as BASE TABLES (should be views or dropped):',
      );
      oldPermTables.forEach((t) => console.log(`    - ${t.table_name}`));
    }

    // Check for duplicate functionality
    console.log('\n=== CHECKING FOR DUPLICATES ===');

    // Get row counts for cache tables
    for (const table of cacheTables) {
      try {
        const countResult = await client.query(
          `SELECT count(*) as count FROM public.${table.table_name}`,
        );
        console.log(`${table.table_name}: ${countResult.rows[0].count} rows`);
      } catch (e) {
        console.log(`${table.table_name}: (error querying)`);
      }
    }
  } finally {
    await client.end();
  }
}

reviewTables().catch((e) => {
  console.error(e);
  process.exit(1);
});
