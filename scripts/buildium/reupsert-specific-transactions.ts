#!/usr/bin/env tsx
/**
 * Re-upsert specific Buildium lease transactions to refresh bank lines/splits.
 *
 * Usage:
 *   npx tsx scripts/buildium/reupsert-specific-transactions.ts 974788,974792,974790,974879
 *   # or provide as env TRANSACTION_IDS=974788,974792
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BUILDIUM_BASE_URL
 *   BUILDIUM_CLIENT_ID
 *   BUILDIUM_CLIENT_SECRET
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers';
import { ensureBuildiumEnabledForScript } from './ensure-enabled';

config({ path: '.env.local' });
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const buildiumBaseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
const buildiumClientId = process.env.BUILDIUM_CLIENT_ID!;
const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseIds(): number[] {
  const raw =
    process.argv[2] ||
    process.env.TRANSACTION_IDS ||
    '974788,974792,974790,974879'; // defaults from audit
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function fetchBuildiumTransaction(leaseId: number, txId: number) {
  const url = `${buildiumBaseUrl}/leases/${leaseId}/transactions/${txId}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': buildiumClientId,
      'x-buildium-client-secret': buildiumClientSecret,
      'x-buildium-egress-allowed': '1',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Buildium API error ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

async function getLeaseIdForTransaction(txId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('buildium_lease_id')
    .eq('buildium_transaction_id', txId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  const leaseId = data?.buildium_lease_id;
  return Number.isFinite(leaseId) ? Number(leaseId) : null;
}

async function checkBalance(txId: number) {
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', txId)
    .maybeSingle();
  if (txErr && txErr.code !== 'PGRST116') {
    console.warn(`⚠️  Balance check failed for ${txId}:`, txErr.message);
    return null;
  }
  if (!tx?.id) return null;

  const { data, error } = await supabase
    .from('transaction_lines')
    .select('amount, posting_type, gl_account_id')
    .eq('transaction_id', tx.id);
  if (error) {
    console.warn(`⚠️  Balance check failed for ${txId}:`, error.message);
    return null;
  }
  if (!data || data.length === 0) return null;
  const debit = data
    .filter((l: any) => l.posting_type === 'Debit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
  const credit = data
    .filter((l: any) => l.posting_type === 'Credit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
  const bankLines = data.filter((l: any) => l.gl_account_id).length;
  return { debit, credit, bankLines };
}

async function main() {
  const ids = parseIds();
  if (!ids.length) {
    console.error('No transaction IDs provided.');
    process.exit(1);
  }
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null);

  for (const txId of ids) {
    try {
      const leaseId = await getLeaseIdForTransaction(txId);
      if (!leaseId) {
        console.warn(`⚠️  Skipping ${txId}: no buildium_lease_id found locally`);
        continue;
      }
      console.log(`🔄 Re-upserting transaction ${txId} (lease ${leaseId}) ...`);
      const fullTx = await fetchBuildiumTransaction(leaseId, txId);
      const { transactionId } = await upsertLeaseTransactionWithLines(fullTx, supabase as any);
      const balance = await checkBalance(txId);
      console.log(
        `✅ Upserted ${txId} → ${transactionId} (balance: debit=${balance?.debit ?? 'n/a'} credit=${balance?.credit ?? 'n/a'} bankLines=${balance?.bankLines ?? 'n/a'})`,
      );
    } catch (err) {
      console.error(`❌ Failed to re-upsert ${txId}:`, (err as any)?.message || err);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
