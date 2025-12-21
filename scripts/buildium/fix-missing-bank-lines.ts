#!/usr/bin/env tsx
/**
 * Quick fix for payments that are missing balancing credit lines (e.g., no bank line/A/R credit).
 * Targets specific buildium_transaction_ids and inserts an Accounts Receivable credit line equal to the missing amount.
 *
 * Defaults to the audited transactions: 974788, 974792, 974790, 974879.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_IDS = [974788, 974792, 974790, 974879];
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

async function getArGlId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('name', 'Accounts Receivable')
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return (data as any)?.id ?? null;
}

async function getLeaseContext(leaseId: number | null) {
  if (!leaseId) return { property_id: null, unit_id: null, buildium_property_id: null, buildium_unit_id: null };
  const { data, error } = await supabase
    .from('lease')
    .select('property_id, unit_id, buildium_property_id, buildium_unit_id')
    .eq('id', leaseId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return {
    property_id: (data as any)?.property_id ?? null,
    unit_id: (data as any)?.unit_id ?? null,
    buildium_property_id: (data as any)?.buildium_property_id ?? null,
    buildium_unit_id: (data as any)?.buildium_unit_id ?? null,
  };
}

async function fixTransaction(buildiumTxId: number, arGlId: string) {
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('id, date, total_amount, buildium_lease_id, lease_id, buildium_unit_id, memo')
    .eq('buildium_transaction_id', buildiumTxId)
    .maybeSingle();
  if (txErr && txErr.code !== 'PGRST116') throw txErr;
  if (!tx?.id) {
    console.warn(`⚠️  Skipping ${buildiumTxId}: no local transaction found`);
    return;
  }

  const { data: lines, error: lineErr } = await supabase
    .from('transaction_lines')
    .select('amount, posting_type, gl_account_id, property_id, unit_id, buildium_property_id, buildium_unit_id, date')
    .eq('transaction_id', tx.id);
  if (lineErr) throw lineErr;

  const debit = (lines ?? [])
    .filter((l: any) => l.posting_type === 'Debit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
  const credit = (lines ?? [])
    .filter((l: any) => l.posting_type === 'Credit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);

  const missingCredit = debit - credit;
  if (missingCredit <= 0) {
    console.log(`✓ ${buildiumTxId} already balanced (debit=${debit}, credit=${credit})`);
    return;
  }

  const firstLine = (lines ?? [])[0] || {};
  const leaseCtx = await getLeaseContext((tx as any)?.lease_id ?? null);
  const lineDate =
    (lines ?? []).find((l: any) => l.date)?.date ||
    (tx as any)?.date ||
    new Date().toISOString().slice(0, 10);

  const newLine = {
    transaction_id: tx.id,
    gl_account_id: arGlId,
    amount: missingCredit,
    posting_type: 'Credit',
    memo: (tx as any)?.memo ?? null,
    account_entity_type: 'Rental' as const,
    account_entity_id:
      firstLine?.buildium_property_id ??
      firstLine?.property_id ??
      (tx as any)?.buildium_property_id ??
      leaseCtx.buildium_property_id ??
      null,
    date: lineDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    buildium_property_id:
      firstLine?.buildium_property_id ?? leaseCtx.buildium_property_id ?? null,
    buildium_unit_id:
      firstLine?.buildium_unit_id ?? (tx as any)?.buildium_unit_id ?? leaseCtx.buildium_unit_id ?? null,
    buildium_lease_id: (tx as any)?.buildium_lease_id ?? null,
    lease_id: (tx as any)?.lease_id ?? null,
    property_id: firstLine?.property_id ?? leaseCtx.property_id ?? null,
    unit_id: firstLine?.unit_id ?? leaseCtx.unit_id ?? null,
  };

  if (DRY_RUN) {
    console.log(
      `DRY RUN → would add A/R credit line for ${buildiumTxId} (amount=${missingCredit}, gl_account_id=${arGlId}, transaction_id=${tx.id})`,
    );
    return;
  }

  const { error: insErr } = await supabase.from('transaction_lines').insert(newLine);
  if (insErr) throw insErr;
  console.log(`➕ Added A/R credit line for ${buildiumTxId} (amount=${missingCredit}, gl_account_id=${arGlId})`);
}

async function main() {
  const ids = (process.argv[2] || process.env.TX_IDS || DEFAULT_IDS.join(','))
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    console.error('No transaction IDs provided');
    process.exit(1);
  }

  const arGlId = await getArGlId();
  if (!arGlId) {
    console.error('Accounts Receivable GL account not found');
    process.exit(1);
  }
  console.log(`Using Accounts Receivable gl_account_id=${arGlId}${DRY_RUN ? ' (DRY RUN)' : ''}`);

  for (const id of ids) {
    try {
      await fixTransaction(id, arGlId);
    } catch (err) {
      console.error(`❌ Failed to fix ${id}:`, (err as any)?.message || err);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
