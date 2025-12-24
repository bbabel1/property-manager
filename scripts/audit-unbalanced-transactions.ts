#!/usr/bin/env npx tsx
/**
 * Audit script to find unbalanced transactions
 * Finds transactions that violate double-entry bookkeeping rules:
 * - Missing debit or credit lines
 * - Unbalanced debits/credits (difference > 0.01)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

config({ path: '.env.local' });
config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey);

interface UnbalancedTransaction {
  id: string;
  transaction_type: string;
  debit_count: number;
  credit_count: number;
  debit_total: number;
  credit_total: number;
  difference: number;
}

async function auditUnbalancedTransactions() {
  console.log('🔍 Auditing transactions for double-entry violations...\n');

  if (!supabaseAdmin) {
    console.error(
      '❌ Supabase admin client not available. Make sure environment variables are set.',
    );
    process.exit(1);
  }

  // Fetch transactions with their lines
  const { data: transactions, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type')
    .limit(10000);

  if (txError) {
    console.error('❌ Error querying transactions:', txError);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log('✅ No transactions found.');
    return;
  }

  console.log(`📊 Checking ${transactions.length} transactions...\n`);

  // Fetch all lines for these transactions
  const transactionIds = transactions.map((t) => t.id);
  const { data: lines, error: linesError } = await supabaseAdmin
    .from('transaction_lines')
    .select('transaction_id, amount, posting_type')
    .in('transaction_id', transactionIds);

  if (linesError) {
    console.error('❌ Error querying transaction lines:', linesError);
    process.exit(1);
  }

  // Process in memory
  const transactionMap = new Map<string, UnbalancedTransaction>();

  transactions.forEach((tx) => {
    const txLines = (lines || []).filter((l) => l.transaction_id === tx.id);
    const debitLines = txLines.filter((l) => l.posting_type === 'Debit');
    const creditLines = txLines.filter((l) => l.posting_type === 'Credit');
    const debitTotal = debitLines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const creditTotal = creditLines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const difference = Math.abs(debitTotal - creditTotal);

    if (debitLines.length === 0 || creditLines.length === 0 || difference > 0.01) {
      transactionMap.set(tx.id, {
        id: tx.id,
        transaction_type: tx.transaction_type || 'Unknown',
        debit_count: debitLines.length,
        credit_count: creditLines.length,
        debit_total: debitTotal,
        credit_total: creditTotal,
        difference,
      });
    }
  });

  const unbalanced = Array.from(transactionMap.values()).sort(
    (a, b) => b.difference - a.difference,
  );

  if (unbalanced.length === 0) {
    console.log('✅ No unbalanced transactions found!');
    return;
  }

  console.log(`⚠️  Found ${unbalanced.length} unbalanced transaction(s):\n`);
  console.table(unbalanced.slice(0, 50)); // Show first 50

  if (unbalanced.length > 50) {
    console.log(`\n... and ${unbalanced.length - 50} more`);
  }

  // Summary
  const oneSided = unbalanced.filter((t) => t.debit_count === 0 || t.credit_count === 0);
  const unbalancedAmount = unbalanced.filter((t) => t.difference > 0.01);

  console.log('\n📊 Summary:');
  console.log(`  - One-sided transactions: ${oneSided.length}`);
  console.log(`  - Unbalanced amounts: ${unbalancedAmount.length}`);
  console.log(`  - Total violations: ${unbalanced.length}`);
}

auditUnbalancedTransactions().catch((error) => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
