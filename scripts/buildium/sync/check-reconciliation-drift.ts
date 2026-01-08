#!/usr/bin/env npx tsx
/**
 * Check reconciliation balance drift using Supabase service role
 * Usage: npx tsx scripts/buildium/sync/check-reconciliation-drift.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Try loading .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔍 Checking reconciliation balance drift...\n');

  // Step 1: Find reconciliations to check
  console.log('📋 Step 1: Finding recent reconciliations...');
  const { data: recs, error: recError } = await admin
    .from('reconciliation_log')
    .select('id, bank_gl_account_id, statement_ending_date, ending_balance, is_finished')
    .not('ending_balance', 'is', null)
    .not('statement_ending_date', 'is', null)
    .order('statement_ending_date', { ascending: false })
    .limit(10);

  if (recError) {
    console.error('❌ Error fetching reconciliations:', recError.message);
    process.exit(1);
  }

  if (!recs || recs.length === 0) {
    console.log('⚠️  No reconciliations found with ending_balance and statement_ending_date set');

    // Check if there are any reconciliations at all
    const { count } = await admin
      .from('reconciliation_log')
      .select('id', { count: 'exact', head: true });

    if (count && count > 0) {
      console.log(
        `\n   Found ${count} reconciliation(s) total, but none have both ending_balance and statement_ending_date set.`,
      );
      console.log('   You may need to run the reconciliation sync first:');
      console.log('   npx tsx scripts/buildium/sync/sync-reconciliations.ts --includeFinished');
    } else {
      console.log('\n   No reconciliations found in the database.');
      console.log('   Run the reconciliation sync to fetch from Buildium:');
      console.log('   npx tsx scripts/buildium/sync/sync-reconciliations.ts --includeFinished');
    }

    process.exit(0);
  }

  console.log(`   Found ${recs.length} reconciliation(s)\n`);

  // Step 2: Check drift for each reconciliation
  console.log('📊 Step 2: Calculating balance drift...\n');
  const driftResults: Array<{
    bank_gl_account_id: string;
    statement_ending_date: string;
    account_name: string | null;
    local_cleared_balance: number | null;
    buildium_ending_balance: number | null;
    drift: number | null;
    is_finished: boolean;
  }> = [];

  for (const rec of recs) {
    if (!rec.bank_gl_account_id || !rec.statement_ending_date) continue;

    // Fetch account details separately
    const { data: account } = await admin
      .from('gl_accounts')
      .select('account_name, account_number')
      .eq('id', rec.bank_gl_account_id)
      .maybeSingle();

    // Call the calculate_book_balance function
    const { data: balanceData, error: balanceError } = await admin.rpc('calculate_book_balance', {
      p_bank_gl_account_id: rec.bank_gl_account_id,
      p_as_of: rec.statement_ending_date,
      p_org_id: null,
    });

    if (balanceError) {
      console.warn(
        `   ⚠️  Error calculating balance for ${rec.bank_gl_account_id} on ${rec.statement_ending_date}:`,
        balanceError.message,
      );
      continue;
    }

    const localBalance = balanceData ? Number(balanceData) : null;
    const buildiumBalance = rec.ending_balance ? Number(rec.ending_balance) : null;
    const drift =
      localBalance !== null && buildiumBalance !== null ? buildiumBalance - localBalance : null;

    driftResults.push({
      bank_gl_account_id: rec.bank_gl_account_id,
      statement_ending_date: rec.statement_ending_date,
      account_name: (account as { account_name?: string } | null)?.account_name ?? null,
      local_cleared_balance: localBalance,
      buildium_ending_balance: buildiumBalance,
      drift,
      is_finished: rec.is_finished ?? false,
    });
  }

  // Display results
  console.log('Results:');
  console.log('='.repeat(100));
  console.log(
    `${'Account Name'.padEnd(30)} ${'Statement Date'.padEnd(15)} ${'Local Balance'.padEnd(15)} ${'Buildium Balance'.padEnd(18)} ${'Drift'.padEnd(12)} ${'Status'}`,
  );
  console.log('-'.repeat(100));

  for (const result of driftResults) {
    const driftStr =
      result.drift !== null ? result.drift.toFixed(2).padStart(12) : 'N/A'.padStart(12);
    const driftAbs = result.drift !== null ? Math.abs(result.drift) : 0;
    const status = result.is_finished ? 'Finished' : 'Open';
    const driftIndicator = driftAbs > 0.01 ? '⚠️' : '✅';

    console.log(
      `${(result.account_name || 'N/A').padEnd(30)} ${result.statement_ending_date.padEnd(15)} ${(result.local_cleared_balance?.toFixed(2) || 'N/A').padEnd(15)} ${(result.buildium_ending_balance?.toFixed(2) || 'N/A').padEnd(18)} ${driftStr} ${driftIndicator} ${status}`,
    );
  }

  console.log('='.repeat(100));
  console.log();

  // Summary
  const significantDrift = driftResults.filter((r) => r.drift !== null && Math.abs(r.drift) > 0.01);
  const totalDrift = driftResults.reduce(
    (sum, r) => sum + (r.drift !== null ? Math.abs(r.drift) : 0),
    0,
  );

  console.log('Summary:');
  console.log(`  Total reconciliations checked: ${driftResults.length}`);
  console.log(`  Reconciliations with drift > $0.01: ${significantDrift.length}`);
  console.log(`  Total absolute drift: $${totalDrift.toFixed(2)}`);

  if (significantDrift.length > 0) {
    console.log('\n⚠️  Reconciliations requiring investigation:');
    for (const drift of significantDrift) {
      console.log(
        `  - ${drift.account_name || drift.bank_gl_account_id} (${drift.statement_ending_date}): $${drift.drift?.toFixed(2)}`,
      );
    }
  } else {
    console.log('\n✅ No significant drift detected (all within $0.01)');
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
