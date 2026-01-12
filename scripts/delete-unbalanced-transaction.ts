#!/usr/bin/env npx tsx
/**
 * Delete an unbalanced transaction
 * Safely removes transaction and its lines
 * Note: Must delete transaction first to avoid trigger validation on empty transaction
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

config({ path: '.env.local' });
config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey);

function getTransactionIdFromArgs() {
  const args = process.argv.slice(2);
  const explicitFlag = args.find((arg) => arg.startsWith('--id='));
  const valueFromFlag = explicitFlag ? explicitFlag.replace('--id=', '') : undefined;
  const positional = args.find((arg) => !arg.startsWith('-'));
  const candidate = valueFromFlag || positional;

  if (!candidate) {
    console.error('❌ Missing transaction id.\n');
    console.info('Usage: npx tsx scripts/delete-unbalanced-transaction.ts <transaction_id>');
    console.info('   or: npx tsx scripts/delete-unbalanced-transaction.ts --id=<transaction_id>');
    process.exit(1);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(candidate)) {
    console.error('❌ Invalid transaction id format. Expected UUID.');
    process.exit(1);
  }

  return candidate;
}

const transactionId = getTransactionIdFromArgs();

async function deleteTransaction() {
  console.log(`🔍 Checking transaction ${transactionId}...\n`);

  // First, get transaction details
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, date, memo, total_amount, buildium_transaction_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) {
    console.error('❌ Error fetching transaction:', txError);
    process.exit(1);
  }

  if (!transaction) {
    console.log('✅ Transaction not found (may already be deleted)');
    return;
  }

  console.log('Transaction details:');
  console.log(`  Type: ${transaction.transaction_type}`);
  console.log(`  Date: ${transaction.date}`);
  console.log(`  Amount: ${transaction.total_amount}`);
  console.log(`  Memo: ${transaction.memo || '(none)'}`);
  console.log(`  Buildium ID: ${transaction.buildium_transaction_id || '(none)'}\n`);

  // Get transaction lines
  const { data: lines, error: linesError } = await supabaseAdmin
    .from('transaction_lines')
    .select('id, gl_account_id, amount, posting_type, memo')
    .eq('transaction_id', transactionId);

  if (linesError) {
    console.error('❌ Error fetching transaction lines:', linesError);
    process.exit(1);
  }

  console.log(`Transaction lines (${lines?.length || 0}):`);
  lines?.forEach((line, idx) => {
    console.log(`  ${idx + 1}. ${line.posting_type}: $${line.amount} (GL: ${line.gl_account_id})`);
  });
  console.log('');

  // Delete transaction using SQL function that safely handles trigger
  console.log('🗑️  Deleting transaction using safe delete function...');

  const { error: deleteError } = await supabaseAdmin.rpc('delete_transaction_safe', {
    p_transaction_id: transactionId,
  });

  if (deleteError) {
    console.error('❌ Error deleting transaction:', deleteError);
    console.log('\n⚠️  If function does not exist, run the migration first:');
    console.log('   npx supabase db push\n');
    process.exit(1);
  }

  // Verify deletion
  const { data: verifyTx } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .maybeSingle();

  if (verifyTx) {
    console.error('❌ Transaction still exists after deletion');
    process.exit(1);
  }

  const { data: verifyLines } = await supabaseAdmin
    .from('transaction_lines')
    .select('id')
    .eq('transaction_id', transactionId)
    .limit(1);

  if (verifyLines && verifyLines.length > 0) {
    console.error('❌ Transaction lines still exist after deletion');
    process.exit(1);
  }

  console.log('✅ Transaction and lines successfully deleted\n');
  console.log('✅ Verification: Transaction and all lines removed from database');
}

deleteTransaction().catch((error) => {
  console.error('❌ Deletion failed:', error);
  process.exit(1);
});
