#!/usr/bin/env npx tsx
/**
 * Add A/R debits to Charge transactions that lack an Accounts Receivable line.
 * Useful to align accrual basis (charges increase A/R; payments credit A/R).
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const isApply = process.argv.includes('--apply');
const propIdx = process.argv.indexOf('--property');
const propertyId = propIdx !== -1 ? process.argv[propIdx + 1] : null;

async function getArGlId() {
  const { data } = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('name', 'Accounts Receivable')
    .maybeSingle();
  return (data as any)?.id ?? null;
}

async function main() {
  if (!propertyId) {
    console.error('Usage: backfill-accounts-receivable-charges --property <propertyId> [--apply]');
    process.exit(1);
  }
  const arId = await getArGlId();
  if (!arId) {
    console.error('Accounts Receivable GL not found');
    process.exit(1);
  }

  const { data: allLines, error } = await supabase
    .from('transaction_lines')
    .select(
      'id, transaction_id, amount, posting_type, property_id, unit_id, lease_id, date, gl_accounts(name), transactions(transaction_type, total_amount, date)',
    )
    .eq('property_id', propertyId);
  if (error) throw error;

  const chargeLines = (allLines || []).filter((l) => {
    const tt = ((l as any)?.transactions?.transaction_type || '').toString().toLowerCase();
    return tt.includes('charge') || tt.includes('rent') || tt.includes('deposit') || tt.includes('security');
  });

  const byTx = new Map<string, any[]>();
  for (const line of chargeLines || []) {
    const arr = byTx.get(line.transaction_id) || [];
    arr.push(line);
    byTx.set(line.transaction_id, arr);
  }

  let added = 0;
  for (const [txId, lines] of byTx.entries()) {
    const hasAr = lines.some((l) => l.gl_accounts?.name?.toLowerCase().includes('receivable'));
    if (hasAr) continue;
    const credits = lines
      .filter((l) => l.posting_type === 'Credit')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0);
    const debits = lines
      .filter((l) => l.posting_type === 'Debit')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0);
    const amount = credits - debits;
    if (amount <= 0) continue;
    const base = lines[0] || {};
    const lineDate =
      (base as any)?.transactions?.date ?? base.date ?? new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const arLine = {
      transaction_id: txId,
      gl_account_id: arId,
      amount,
      posting_type: 'Debit',
      date: lineDate,
      account_entity_type: 'Rental',
      property_id: propertyId,
      unit_id: base.unit_id ?? null,
      lease_id: base.lease_id ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    if (isApply) {
      const { error: insErr } = await supabase.from('transaction_lines').insert(arLine);
      if (insErr) throw insErr;
    }
    added++;
    console.log(`${isApply ? '[added]' : '[would add]'} A/R debit tx=${txId} amount=${amount}`);
  }

  console.log('Backfill complete. Added:', added);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
