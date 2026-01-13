#!/usr/bin/env -S node --loader tsx
/**
 * Fix GL account flags (bank / deposit liability) based on naming heuristics.
 *
 * - Scans `gl_accounts` and compares `is_bank_account` / `is_security_deposit_liability`
 *   against conservative name/subtype/category heuristics.
 * - By default runs in dry-run mode and prints the changes it *would* make.
 * - With `--apply`, issues `UPDATE` statements to correct obvious mis-flags.
 *
 * Usage:
 *   # Dry run for all orgs
 *   npx tsx scripts/maintenance/fix-gl-account-flags.ts
 *
 *   # Dry run for a single org
 *   npx tsx scripts/maintenance/fix-gl-account-flags.ts --org <org-id>
 *
 *   # Apply fixes for a single org
 *   npx tsx scripts/maintenance/fix-gl-account-flags.ts --org <org-id> --apply
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type GlAccountRow = {
  id: string;
  org_id: string | null;
  name: string | null;
  type: string | null;
  sub_type: string | null;
  gl_account_category: { category?: string | null } | null;
  is_bank_account: boolean | null;
  is_security_deposit_liability: boolean | null;
  exclude_from_cash_balances: boolean | null;
  is_active: boolean | null;
};

type FlagHeuristics = {
  expectedBank: boolean;
  expectedDepositLiability: boolean;
  isArLike: boolean;
  isApLike: boolean;
};

function computeHeuristics(row: GlAccountRow): FlagHeuristics {
  const name = (row.name || '').toLowerCase();
  const sub = (row.sub_type || '').toLowerCase();
  const cat = (row.gl_account_category?.category || '').toLowerCase();
  const type = (row.type || '').toLowerCase();

  const normalizedSub = sub.replace(/[\s_-]+/g, '');
  const normalizedName = name.replace(/[\s_-]+/g, '');

  const isArLike =
    normalizedSub.includes('accountsreceivable') ||
    normalizedName.includes('accountsreceivable') ||
    name.includes('accounts receivable');
  const isApLike =
    normalizedSub.includes('accountspayable') ||
    normalizedName.includes('accountspayable') ||
    name.includes('accounts payable');

  const hasBankKeyword =
    name.includes('bank') ||
    name.includes('checking') ||
    name.includes('operating') ||
    name.includes('trust') ||
    name.includes('undeposited') ||
    sub.includes('cash');

  const expectedBank = type === 'asset' && hasBankKeyword && !isArLike && !isApLike;

  const hasDepositKeyword =
    sub.includes('deposit') || cat.includes('deposit') || name.includes('deposit');

  const expectedDepositLiability = type === 'liability' && hasDepositKeyword;

  return {
    expectedBank,
    expectedDepositLiability,
    isArLike,
    isApLike,
  };
}

async function main() {
  const supabase = getAdmin();

  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const orgIdx = args.indexOf('--org');
  const orgId = orgIdx !== -1 ? args[orgIdx + 1] : undefined;

  if (orgIdx !== -1 && !orgId) {
    console.error('Usage: fix-gl-account-flags --org <org-id> [--apply]');
    process.exit(1);
  }

  console.log(
    `🔍 Scanning gl_accounts for ${orgId ? `org ${orgId}` : 'all orgs'} (${isApply ? 'APPLY' : 'dry run'})`,
  );

  let query = supabase
    .from('gl_accounts')
    .select(
      'id, org_id, name, type, sub_type, gl_account_category ( category ), is_bank_account, is_security_deposit_liability, exclude_from_cash_balances, is_active',
    )
    .order('org_id', { ascending: true } as any)
    .order('type', { ascending: true } as any)
    .order('name', { ascending: true } as any);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  const rows: GlAccountRow[] = Array.isArray(data) ? (data as GlAccountRow[]) : [];
  if (!rows.length) {
    console.log('No GL accounts found for the specified scope.');
    return;
  }

  const fixes: Array<{ row: GlAccountRow; patch: Partial<GlAccountRow> }> = [];
  const suspiciousExclude: GlAccountRow[] = [];

  for (const row of rows) {
    const heuristics = computeHeuristics(row);
    const patch: Partial<GlAccountRow> = {};

    const isBank = Boolean(row.is_bank_account);
    const isDepositLiab = Boolean(row.is_security_deposit_liability);
    const excluded = Boolean(row.exclude_from_cash_balances);

    // Bank flag: set when obviously a bank/undeposited asset, clear when clearly AR/AP.
    if (heuristics.expectedBank && !isBank) {
      patch.is_bank_account = true;
    } else if (!heuristics.expectedBank && isBank && (heuristics.isArLike || heuristics.isApLike)) {
      // Asset AR/AP accounts should not be flagged as bank.
      patch.is_bank_account = false;
    }

    // Deposit liability flag: set when liability with deposit naming but flag is false.
    if (heuristics.expectedDepositLiability && !isDepositLiab) {
      patch.is_security_deposit_liability = true;
    }

    // Exclude-from-cash checks: we do not auto-change this flag, but we flag suspicious combos.
    // - Bank accounts excluded from cash without obvious "legacy/clearing" keywords.
    const name = (row.name || '').toLowerCase();
    const looksLegacy =
      name.includes('legacy') ||
      name.includes('old') ||
      name.includes('closed') ||
      name.includes('clearing') ||
      name.includes('do not use');

    if (isBank && excluded && !looksLegacy) {
      suspiciousExclude.push(row);
    }

    if (Object.keys(patch).length > 0) {
      fixes.push({ row, patch });
    }
  }

  if (!fixes.length && !suspiciousExclude.length) {
    console.log('✅ No obvious flag mismatches found.');
    return;
  }

  console.log(`\nPlanned flag corrections: ${fixes.length}`);
  for (const { row, patch } of fixes) {
    const parts: string[] = [];
    if (patch.is_bank_account !== undefined) {
      parts.push(`is_bank_account: ${row.is_bank_account} -> ${patch.is_bank_account}`);
    }
    if (patch.is_security_deposit_liability !== undefined) {
      parts.push(
        `is_security_deposit_liability: ${row.is_security_deposit_liability} -> ${patch.is_security_deposit_liability}`,
      );
    }
    const orgLabel = row.org_id ? `[${row.org_id}]` : '[no-org]';
    console.log(`- ${orgLabel} "${row.name}" (${row.type}/${row.sub_type}) id=${row.id}`);
    console.log(`    ${parts.join(' | ')}`);
  }

  if (suspiciousExclude.length) {
    console.log(
      `\n⚠️ Bank GLs excluded from cash balances without obvious "legacy/clearing" keywords: ${suspiciousExclude.length}`,
    );
    for (const row of suspiciousExclude.slice(0, 20)) {
      const orgLabel = row.org_id ? `[${row.org_id}]` : '[no-org]';
      console.log(
        `- ${orgLabel} "${row.name}" (${row.type}/${row.sub_type}) id=${row.id} [exclude_from_cash_balances=true]`,
      );
    }
    if (suspiciousExclude.length > 20) {
      console.log(`  ...and ${suspiciousExclude.length - 20} more`);
    }
  }

  if (!isApply) {
    console.log('\nDry run complete. Re-run with --apply to persist these changes.');
    return;
  }

  console.log('\nApplying fixes...');
  let applied = 0;

  for (const { row, patch } of fixes) {
    const { error: updateError } = await supabase
      .from('gl_accounts')
      .update(patch)
      .eq('id', row.id);

    if (updateError) {
      console.error(
        `❌ Failed to update gl_account ${row.id} (${row.name}):`,
        updateError.message,
      );
      continue;
    }

    applied += 1;
  }

  console.log(`\n✅ Applied ${applied} flag update(s).`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

