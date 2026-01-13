#!/usr/bin/env -S node --loader tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');
  return createClient(url, key);
}

async function main() {
  const supabase = getAdmin();
  const orgId = process.argv[2];

  if (!orgId) {
    console.error('Usage: npx tsx scripts/maintenance/find-gl-accounts-for-org.ts <org-id>');
    process.exit(1);
  }

  console.log(`🔍 Finding GL accounts for org ${orgId}...\n`);

  // Check if org exists
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) {
    console.error(`❌ Organization ${orgId} not found`);
    process.exit(1);
  }

  console.log(`Organization: ${org.name} (${org.id})\n`);

  // Get all GL accounts for this org
  const { data: accounts, error: accountsError } = await supabase
    .from('gl_accounts')
    .select('id, name, type, sub_type, account_number, is_active')
    .eq('org_id', orgId)
    .order('type')
    .order('name');

  if (accountsError) throw accountsError;

  if (!accounts || accounts.length === 0) {
    console.log('❌ No GL accounts found for this org');
    process.exit(1);
  }

  console.log(`Found ${accounts.length} GL account(s):\n`);

  // Group by type
  const byType: Record<string, typeof accounts> = {};
  for (const acc of accounts) {
    const type = acc.type || 'Unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(acc);
  }

  // Look for AR accounts (asset type)
  console.log('📊 Asset Accounts (potential AR accounts):');
  const assetAccounts = accounts.filter((a) => (a.type || '').toLowerCase() === 'asset');
  if (assetAccounts.length === 0) {
    console.log('  None found\n');
  } else {
    assetAccounts.forEach((acc) => {
      const status = acc.is_active ? '✓' : '✗';
      console.log(`  ${status} ${acc.account_number || 'N/A'} - ${acc.name} (${acc.id})`);
      if (acc.sub_type) console.log(`    Sub-type: ${acc.sub_type}`);
    });
    console.log();
  }

  // Look for income accounts
  console.log('💰 Income Accounts (potential rent income):');
  const incomeAccounts = accounts.filter((a) => (a.type || '').toLowerCase() === 'income');
  if (incomeAccounts.length === 0) {
    console.log('  None found\n');
  } else {
    incomeAccounts.forEach((acc) => {
      const status = acc.is_active ? '✓' : '✗';
      console.log(`  ${status} ${acc.account_number || 'N/A'} - ${acc.name} (${acc.id})`);
      if (acc.sub_type) console.log(`    Sub-type: ${acc.sub_type}`);
    });
    console.log();
  }

  // Recommendations
  console.log('💡 Recommendations for control accounts:');

  // Find best AR account
  const arCandidates = assetAccounts.filter(
    (a) =>
      a.is_active &&
      (a.name?.toLowerCase().includes('receivable') ||
        a.name?.toLowerCase().includes('ar') ||
        a.sub_type?.toLowerCase().includes('receivable')),
  );
  const bestAR = arCandidates[0] || assetAccounts.find((a) => a.is_active) || assetAccounts[0];
  if (bestAR) {
    console.log(`  AR Account: ${bestAR.name} (${bestAR.id})`);
  } else {
    console.log(`  AR Account: ❌ No suitable asset account found`);
  }

  // Find best rent income account (prefer exact "Rent Income" match)
  const rentExact = incomeAccounts.find(
    (a) => a.is_active && a.name?.toLowerCase() === 'rent income',
  );
  const rentCandidates = incomeAccounts.filter(
    (a) => a.is_active && a.name?.toLowerCase().includes('rent'),
  );
  const bestRent =
    rentExact || rentCandidates[0] || incomeAccounts.find((a) => a.is_active) || incomeAccounts[0];
  if (bestRent) {
    console.log(`  Rent Income: ${bestRent.name} (${bestRent.id})`);
  } else {
    console.log(`  Rent Income: ❌ No suitable income account found`);
  }

  // Find late fee income (optional)
  const lateFeeCandidates = incomeAccounts.filter(
    (a) => a.is_active && a.name?.toLowerCase().includes('late'),
  );
  if (lateFeeCandidates.length > 0) {
    console.log(`  Late Fee Income: ${lateFeeCandidates[0].name} (${lateFeeCandidates[0].id})`);
  }

  // Find undeposited funds (optional)
  const undepositedCandidates = assetAccounts.filter(
    (a) =>
      a.is_active &&
      (a.name?.toLowerCase().includes('undeposited') || a.name?.toLowerCase().includes('cash')),
  );
  if (undepositedCandidates.length > 0) {
    console.log(
      `  Undeposited Funds: ${undepositedCandidates[0].name} (${undepositedCandidates[0].id})`,
    );
  }

  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
