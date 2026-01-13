#!/usr/bin/env tsx
/**
 * Backfill transaction_lines for affected payment transactions using the updated logic.
 * 
 * This script rebuilds transaction_lines for payment transactions that were affected
 * by the accrual-basis payment fix. The new logic:
 * - Reclassifies cash-posting payment lines that hit income/liability to Accounts Receivable (marked non-cash)
 * - Explicitly marks synthesized bank/undeposited-funds lines as cash postings
 * 
 * Usage:
 *   npx tsx scripts/buildium/backfill-payment-transaction-lines.ts 1004745,1005551
 *   # or provide as env TRANSACTION_IDS=1004745,1005551
 *   # optionally: DEFAULT_ORG_ID=<org-id> or pass as second arg
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers';
import { buildiumFetch } from '@/lib/buildium-http';
import { ensureBuildiumEnabledForScript } from './ensure-enabled';

config({ path: '.env.local' });
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseIds(): number[] {
  const raw =
    process.argv[2] ||
    process.env.TRANSACTION_IDS ||
    '1004745,1005551'; // defaults from user request
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function getTransactionContext(txId: number): Promise<{
  orgId: string | null;
  leaseId: number | null;
  localTransactionId: string | null;
}> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, org_id, buildium_lease_id')
    .eq('buildium_transaction_id', txId)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return {
    orgId: data?.org_id ?? null,
    leaseId: data?.buildium_lease_id ? Number(data.buildium_lease_id) : null,
    localTransactionId: data?.id ?? null,
  };
}

async function fetchBuildiumTransaction(
  orgId: string,
  leaseId: number,
  txId: number,
): Promise<any> {
  const response = await buildiumFetch(
    'GET',
    `/leases/${leaseId}/transactions/${txId}`,
    undefined,
    undefined,
    orgId,
  );

  if (!response.ok) {
    throw new Error(
      `Buildium API error ${response.status} ${response.statusText}: ${response.errorText || 'Unknown error'}`,
    );
  }

  return response.json;
}

async function checkBalance(txId: number, localTxId: string) {
  const { data, error } = await supabase
    .from('transaction_lines')
    .select('amount, posting_type, gl_account_id, is_cash_posting')
    .eq('transaction_id', localTxId);
  
  if (error) {
    console.warn(`⚠️  Balance check failed for ${txId}:`, error.message);
    return null;
  }
  
  if (!data || data.length === 0) {
    return { debit: 0, credit: 0, lines: 0, cashPostingLines: 0 };
  }
  
  const debit = data
    .filter((l: any) => l.posting_type === 'Debit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
  const credit = data
    .filter((l: any) => l.posting_type === 'Credit')
    .reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
  const cashPostingLines = data.filter((l: any) => l.is_cash_posting === true).length;
  
  return { debit, credit, lines: data.length, cashPostingLines };
}

async function main() {
  const ids = parseIds();
  if (!ids.length) {
    console.error('No transaction IDs provided.');
    process.exit(1);
  }

  console.log(`🔄 Backfilling ${ids.length} payment transaction(s) with updated logic...\n`);

  for (const txId of ids) {
    try {
      console.log(`📋 Processing transaction ${txId}...`);
      
      // Get transaction context to find orgId and leaseId
      const context = await getTransactionContext(txId);
      
      if (!context.orgId) {
        console.warn(`⚠️  Skipping ${txId}: no org_id found locally`);
        continue;
      }
      
      if (!context.leaseId) {
        console.warn(`⚠️  Skipping ${txId}: no buildium_lease_id found locally`);
        continue;
      }

      // Ensure Buildium is enabled for this org
      await ensureBuildiumEnabledForScript(context.orgId);

      // Fetch full transaction from Buildium
      console.log(`  Fetching from Buildium (lease ${context.leaseId})...`);
      const fullTx = await fetchBuildiumTransaction(context.orgId, context.leaseId, txId);
      
      if (!fullTx) {
        console.warn(`⚠️  Skipping ${txId}: transaction not found in Buildium`);
        continue;
      }

      // Rebuild transaction lines using updated logic
      console.log(`  Rebuilding transaction_lines with updated logic...`);
      console.log(`  Buildium transaction structure:`, {
        hasJournal: !!fullTx?.Journal,
        hasJournalLines: !!fullTx?.Journal?.Lines,
        journalLinesCount: Array.isArray(fullTx?.Journal?.Lines) ? fullTx.Journal.Lines.length : 0,
        hasLines: !!fullTx?.Lines,
        linesCount: Array.isArray(fullTx?.Lines) ? fullTx.Lines.length : 0,
        totalAmount: fullTx?.TotalAmount ?? fullTx?.Amount,
      });
      const beforeBalance = context.localTransactionId
        ? await checkBalance(txId, context.localTransactionId)
        : null;
      
      const { transactionId } = await upsertLeaseTransactionWithLines(fullTx, supabase as any);
      
      const afterBalance = await checkBalance(txId, transactionId);
      
      console.log(`✅ Backfilled ${txId} → ${transactionId}`);
      if (beforeBalance && afterBalance) {
        console.log(`   Before: debit=${beforeBalance.debit} credit=${beforeBalance.credit} lines=${beforeBalance.lines} cash=${beforeBalance.cashPostingLines}`);
        console.log(`   After:  debit=${afterBalance.debit} credit=${afterBalance.credit} lines=${afterBalance.lines} cash=${afterBalance.cashPostingLines}`);
      } else if (afterBalance) {
        console.log(`   Balance: debit=${afterBalance.debit} credit=${afterBalance.credit} lines=${afterBalance.lines} cash=${afterBalance.cashPostingLines}`);
      }
      console.log('');
    } catch (err) {
      console.error(`❌ Failed to backfill ${txId}:`, (err as any)?.message || err);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
      console.log('');
    }
  }

  console.log('✅ Backfill complete');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

