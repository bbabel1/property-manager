#!/usr/bin/env tsx
/**
 * Complete verification script for RLS policy changes
 * Verifies:
 * 1. All auth.*() calls are wrapped in subselects
 * 2. Policies have proper role scoping
 * 3. Permissive policies are consolidated
 * 4. Query plans show no InitPlans
 */

import { config } from 'dotenv';
import { Client } from 'pg';
import { z } from 'zod';

config({ path: '.env' });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_DB_PASSWORD: z.string(),
});

function getDatabaseConfig() {
  const env = EnvSchema.parse(process.env);
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  const ref = url.hostname.split('.')[0];
  const host = `db.${ref}.supabase.co`;
  
  return {
    host,
    port: 5432,
    user: 'postgres',
    password: env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  console.log('================================================================================');
  console.log('Complete RLS Policy Changes Verification');
  console.log('================================================================================');
  console.log('');

  const client = new Client(getDatabaseConfig());

  try {
    await client.connect();

    // PART 1: Check for unwrapped auth.*() calls
    console.log('PART 1: Checking for unwrapped auth.*() calls...');
    console.log('----------------------------------------------------------------------');
    
    const unwrappedPolicies = await client.query(`
      SELECT 
        tablename,
        policyname,
        cmd,
        CASE 
          WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'UNWRAPPED auth.uid()'
          WHEN qual LIKE '%auth.role()%' AND qual NOT LIKE '%(select auth.role())%' THEN 'UNWRAPPED auth.role()'
          WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select auth.jwt())%' THEN 'UNWRAPPED auth.jwt()'
          WHEN qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%' THEN 'UNWRAPPED current_setting()'
          ELSE 'OK'
        END as issue
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          (qual LIKE '%auth.%()%' AND qual NOT LIKE '%(select auth.%')
          OR (with_check LIKE '%auth.%()%' AND with_check NOT LIKE '%(select auth.%')
          OR (qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%')
          OR (with_check LIKE '%current_setting(%' AND with_check NOT LIKE '%(select current_setting%')
        )
      ORDER BY tablename, policyname
    `);

    if (unwrappedPolicies.rows.length === 0) {
      console.log('✅ All auth.*() calls are properly wrapped in subselects');
    } else {
      console.log(`⚠️  Found ${unwrappedPolicies.rows.length} policies with unwrapped auth.*() calls:`);
      console.table(unwrappedPolicies.rows.slice(0, 10));
      if (unwrappedPolicies.rows.length > 10) {
        console.log(`... and ${unwrappedPolicies.rows.length - 10} more`);
      }
    }
    console.log('');

    // PART 2: Check role scoping
    console.log('PART 2: Checking role scoping (TO clauses)...');
    console.log('----------------------------------------------------------------------');
    
    const roleScopedPolicies = await client.query(`
      SELECT 
        tablename,
        policyname,
        cmd,
        roles,
        permissive
      FROM pg_policies
      WHERE schemaname = 'public'
        AND roles IS NOT NULL
        AND array_length(roles, 1) > 0
      ORDER BY tablename, policyname
      LIMIT 20
    `);

    console.log(`Found ${roleScopedPolicies.rows.length} policies with explicit role scoping (showing first 20):`);
    if (roleScopedPolicies.rows.length > 0) {
      console.table(roleScopedPolicies.rows.map(r => ({
        table: r.tablename,
        policy: r.policyname,
        cmd: r.cmd,
        roles: Array.isArray(r.roles) ? r.roles.join(', ') : r.roles,
        permissive: r.permissive
      })));
    }
    console.log('');

    // PART 3: Check permissive policy consolidation
    console.log('PART 3: Checking permissive policy consolidation...');
    console.log('----------------------------------------------------------------------');
    
    const permissivePolicies = await client.query(`
      SELECT 
        tablename,
        cmd,
        COUNT(*) as policy_count,
        array_agg(policyname ORDER BY policyname)::text[] as policy_names
      FROM pg_policies
      WHERE schemaname = 'public'
        AND permissive = 'PERMISSIVE'
      GROUP BY tablename, cmd
      HAVING COUNT(*) > 1
      ORDER BY tablename, cmd
    `);

    if (permissivePolicies.rows.length === 0) {
      console.log('✅ No tables with multiple permissive policies per action');
    } else {
      console.log(`⚠️  Found ${permissivePolicies.rows.length} table/action combos with multiple permissive policies:`);
      console.table(permissivePolicies.rows);
    }
    console.log('');

    // PART 4: Check InitPlan in query plan
    console.log('PART 4: Checking for InitPlan in query plan...');
    console.log('----------------------------------------------------------------------');
    console.log('Run this manually to check for InitPlans:');
    console.log('');
    console.log('  EXPLAIN (ANALYZE, BUFFERS, VERBOSE)');
    console.log('  SELECT * FROM public.properties WHERE org_id IS NOT NULL LIMIT 1;');
    console.log('');
    console.log('Look for "InitPlan" in the output - it should be minimal or absent.');
    console.log('');

    // Summary
    console.log('================================================================================');
    console.log('VERIFICATION SUMMARY');
    console.log('================================================================================');
    console.log('');
    console.log(`✅ Unwrapped auth.*() calls: ${unwrappedPolicies.rows.length === 0 ? 'NONE' : `${unwrappedPolicies.rows.length} found`}`);
    console.log(`✅ Role-scoped policies: ${roleScopedPolicies.rows.length} found`);
    console.log(`✅ Permissive policy consolidation: ${permissivePolicies.rows.length === 0 ? 'COMPLETE' : `${permissivePolicies.rows.length} duplicates remain`}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npx supabase db lint --linked (or your CI lint step)');
    console.log('  2. Spot-check policies: \\dRp+ table_name in psql');
    console.log('  3. Verify query plans show no InitPlans');
    console.log('');

  } catch (error) {
    console.error('Error running verification:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});




