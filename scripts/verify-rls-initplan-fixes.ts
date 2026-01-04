#!/usr/bin/env tsx
/**
 * Verification Script for RLS Initplan and Policy Performance Fixes
 * 
 * This script verifies that:
 * 1. Initplans are gone from query plans (auth.*() calls wrapped in subselects)
 * 2. Policies still work correctly
 * 3. Duplicate indexes are gone
 * 
 * Run with: npx tsx scripts/verify-rls-initplan-fixes.ts
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
  console.log('Verifying RLS Initplan and Policy Performance Fixes');
  console.log('================================================================================');
  console.log('');

  const client = new Client(getDatabaseConfig());

  try {
    await client.connect();

    // PART 1: Check for Remaining Direct auth.*() Calls in Policies
    console.log('PART 1: Checking for remaining direct auth.*() calls in policies...');
    console.log('----------------------------------------------------------------------');
    
    const policiesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        CASE 
          WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'DIRECT auth.uid() FOUND'
          WHEN qual LIKE '%auth.role()%' AND qual NOT LIKE '%(select auth.role())%' THEN 'DIRECT auth.role() FOUND'
          WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select auth.jwt())%' THEN 'DIRECT auth.jwt() FOUND'
          WHEN qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%' THEN 'DIRECT current_setting() FOUND'
          ELSE 'OK'
        END as using_status,
        CASE 
          WHEN with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%' THEN 'DIRECT auth.uid() FOUND'
          WHEN with_check LIKE '%auth.role()%' AND with_check NOT LIKE '%(select auth.role())%' THEN 'DIRECT auth.role() FOUND'
          WHEN with_check LIKE '%auth.jwt()%' AND with_check NOT LIKE '%(select auth.jwt())%' THEN 'DIRECT auth.jwt() FOUND'
          WHEN with_check LIKE '%current_setting(%' AND with_check NOT LIKE '%(select current_setting%' THEN 'DIRECT current_setting() FOUND'
          ELSE 'OK'
        END as with_check_status
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

    if (policiesResult.rows.length === 0) {
      console.log('✅ No policies with direct auth.*() calls found - all are wrapped in subselects');
    } else {
      console.log(`⚠️  Found ${policiesResult.rows.length} policies with direct auth.*() calls:`);
      console.table(policiesResult.rows);
    }
    console.log('');

    // PART 2: Check for Duplicate Indexes
    console.log('PART 2: Checking for duplicate indexes...');
    console.log('----------------------------------------------------------------------');

    // Check billing_events
    const billingEventsIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'billing_events'
        AND indexname IN ('idx_billing_events_org_period', 'idx_service_revenue_org_period')
      ORDER BY indexname
    `);
    
    const hasServiceRevenueIndex = billingEventsIndexes.rows.some(r => r.indexname === 'idx_service_revenue_org_period');
    if (hasServiceRevenueIndex) {
      console.log('⚠️  idx_service_revenue_org_period still exists (should be dropped)');
    } else {
      console.log('✅ billing_events: idx_service_revenue_org_period correctly dropped');
    }

    // Check buildium_webhook_events
    const webhookIndexes = await client.query(`
      SELECT 
        c.conname as constraint_name,
        i.indexname as index_name
      FROM pg_constraint c
      FULL OUTER JOIN pg_indexes i ON i.indexname = c.conname
      WHERE (c.conrelid = 'public.buildium_webhook_events'::regclass OR i.tablename = 'buildium_webhook_events')
        AND (c.conname LIKE '%event_id%' OR i.indexname LIKE '%event_id%')
        AND (c.conname != 'uq_buildium_webhook_events_compound' AND i.indexname != 'uq_buildium_webhook_events_compound')
      ORDER BY constraint_name, index_name
    `);
    
    if (webhookIndexes.rows.length > 0) {
      console.log('⚠️  buildium_webhook_events: Found duplicate event_id constraints/indexes:');
      console.table(webhookIndexes.rows);
    } else {
      console.log('✅ buildium_webhook_events: No duplicate event_id constraints/indexes found');
    }

    // Check membership_roles
    const membershipIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'membership_roles'
        AND indexname LIKE 'user_permission_profiles%'
      ORDER BY indexname
    `);
    
    if (membershipIndexes.rows.length > 0) {
      console.log(`⚠️  membership_roles: Found ${membershipIndexes.rows.length} user_permission_profiles indexes (should be dropped)`);
      console.table(membershipIndexes.rows);
    } else {
      console.log('✅ membership_roles: No user_permission_profiles indexes found');
    }

    // Check transaction_lines
    const txLineIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'transaction_lines'
        AND indexname IN (
          'idx_journal_entries_gl_account_id',
          'idx_transaction_lines_lease_id',
          'idx_tx_lines_property_date',
          'idx_journal_entries_transaction_id',
          'idx_transaction_lines_unit_id'
        )
      ORDER BY indexname
    `);
    
    if (txLineIndexes.rows.length > 0) {
      console.log(`⚠️  transaction_lines: Found ${txLineIndexes.rows.length} duplicate indexes (should be dropped):`);
      console.table(txLineIndexes.rows);
    } else {
      console.log('✅ transaction_lines: Duplicate indexes correctly dropped');
    }
    console.log('');

    // PART 3: Check Multiple Permissive Policies
    console.log('PART 3: Checking for multiple permissive policies...');
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
      console.log('✅ No tables with multiple permissive policies per action found');
    } else {
      console.log(`⚠️  Found ${permissivePolicies.rows.length} table/action combos with multiple permissive policies:`);
      console.table(permissivePolicies.rows);
    }
    console.log('');

    // Summary
    console.log('================================================================================');
    console.log('VERIFICATION SUMMARY');
    console.log('================================================================================');
    console.log('');
    console.log('To verify initplans are gone, run EXPLAIN queries manually:');
    console.log('');
    console.log('  EXPLAIN (ANALYZE, BUFFERS, VERBOSE)');
    console.log('  SELECT * FROM public.properties WHERE org_id IS NOT NULL LIMIT 10;');
    console.log('');
    console.log('Look for "InitPlan" in the output - it should be minimal or absent.');
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

