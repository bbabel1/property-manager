#!/usr/bin/env npx tsx
/**
 * Re-home Payment/ApplyDeposit transactions (with no bank_gl_account_id) from property bank GLs
 * to the organization's Undeposited Funds GL account.
 *
 * This catches cases where we fell back to a property's operating/deposit-trust account because
 * Buildium did not provide a bank GL. Those should live in Undeposited Funds instead.
 */
import { config } from 'dotenv';
// Prefer `.env` (project convention). Allow override via DOTENV_CONFIG_PATH, and fall back to `.env.local`.
config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
config({ path: '.env.local', override: false });

async function main() {
  const { supabaseAdmin } = await import('../src/lib/db.js');

  console.log('Loading Undeposited Funds accounts by org...');
  const { data: udfRows, error: udfErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, org_id')
    .or('default_account_name.ilike.%Undeposited Funds%,name.ilike.%Undeposited Funds%');
  if (udfErr) {
    console.error('Failed to load Undeposited Funds accounts', udfErr);
    process.exit(1);
  }
  const udfByOrg = new Map<string | null, string>();
  for (const row of udfRows ?? []) {
    udfByOrg.set((row as any)?.org_id ?? null, (row as any)?.id);
  }
  if (!udfByOrg.size) {
    console.error('No Undeposited Funds GL accounts found. Aborting.');
    process.exit(1);
  }

  console.log('Finding payment transactions missing bank_gl_account_id...');
  const { data: txs, error: txErr } = await supabaseAdmin
    .from('transactions')
    .select(
      `
        id,
        transaction_type,
        date,
        total_amount,
        bank_gl_account_id,
        lease_id,
        transaction_lines (
          id,
          gl_account_id,
          amount,
          posting_type,
          property_id
        )
      `,
    )
    .in('transaction_type', ['Payment', 'ApplyDeposit'])
    .is('bank_gl_account_id', null);

  if (txErr) {
    console.error('Failed to load candidate transactions', txErr);
    process.exit(1);
  }

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const tx of txs ?? []) {
    const lines = (tx as any).transaction_lines ?? [];
    const linePropertyIdFromLines =
      (lines.find((l: any) => l?.property_id)?.property_id as string | null) ?? null;

    let linePropertyId = linePropertyIdFromLines;
    const leaseId = (tx as any)?.lease_id ?? null;
    if (!linePropertyId && leaseId != null) {
      const { data: leaseRow, error: leaseErr } = await supabaseAdmin
        .from('lease')
        .select('property_id')
        .eq('id', leaseId)
        .maybeSingle();
      if (leaseErr) {
        console.warn(`Skipping tx ${tx.id} due to lease lookup error`, leaseErr);
      } else {
        linePropertyId = (leaseRow as any)?.property_id ?? null;
      }
    }

    if (!linePropertyId) {
      console.warn(`Skipping tx ${tx.id}: could not resolve property_id (lease_id=${leaseId ?? 'null'})`);
      skipped++;
      continue;
    }

    const { data: property, error: propErr } = await supabaseAdmin
      .from('properties')
      .select('id, org_id, operating_bank_gl_account_id, deposit_trust_gl_account_id')
      .eq('id', linePropertyId)
      .maybeSingle();
    if (propErr) {
      console.warn(`Skipping tx ${tx.id} due to property lookup error`, propErr);
      skipped++;
      continue;
    }

    const orgId = (property as any)?.org_id ?? null;
    const udfGlId = udfByOrg.get(orgId) ?? udfByOrg.get(null);
    if (!udfGlId) {
      console.warn(`No Undeposited Funds account for org ${orgId}; skipping tx ${tx.id}`);
      skipped++;
      continue;
    }

    const propertyBankIds = [
      (property as any)?.operating_bank_gl_account_id ?? null,
      (property as any)?.deposit_trust_gl_account_id ?? null,
    ].filter(Boolean);
    const bankLine = lines.find((l: any) => propertyBankIds.includes(l?.gl_account_id));

    if (!bankLine) {
      skipped++;
      continue;
    }

    const { error: updateLineErr } = await supabaseAdmin
      .from('transaction_lines')
      .update({ gl_account_id: udfGlId, updated_at: new Date().toISOString() })
      .eq('id', (bankLine as any).id);

    if (updateLineErr) {
      console.error(`Failed to move bank line for tx ${tx.id}`, updateLineErr);
      failed++;
      continue;
    }

    const { error: updateTxErr } = await supabaseAdmin
      .from('transactions')
      .update({ bank_gl_account_id: udfGlId, updated_at: new Date().toISOString() })
      .eq('id', (tx as any).id);

    if (updateTxErr) {
      console.error(`Failed to update transaction bank_gl_account_id for tx ${tx.id}`, updateTxErr);
      failed++;
      continue;
    }

    moved++;
    console.log(
      `✓ Moved tx ${tx.id} (${(tx as any).transaction_type} ${tx.date}) bank line to Undeposited Funds ${udfGlId}`,
    );
  }

  console.log('\nSummary');
  console.log(`Moved:   ${moved}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
