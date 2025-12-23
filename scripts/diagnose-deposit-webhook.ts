/**
 * Diagnostic script to check why a deposit webhook didn't create/update transaction lines
 *
 * Usage:
 *   ./node_modules/.bin/tsx scripts/diagnose-deposit-webhook.ts <transactionId> [eventName]
 *
 * Examples:
 *   ./node_modules/.bin/tsx scripts/diagnose-deposit-webhook.ts 974934 BankAccount.Transaction.Updated
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const { supabaseAdmin } = await import('../src/lib/db.js');
  const txIdArg = process.argv[2];
  const eventNameArg = process.argv[3];

  const transactionId = Number(txIdArg ?? 974933);
  const eventName = String(eventNameArg ?? 'BankAccount.Transaction.Created');
  if (!Number.isFinite(transactionId)) {
    throw new Error(`Invalid transactionId argument: ${txIdArg}`);
  }

  // Check webhook event processing status
  console.log('\n=== Webhook Event Status ===');
  const { data: webhookEvents, error: webhookErr } = await supabaseAdmin
    .from('buildium_webhook_events')
    .select('id, buildium_webhook_id, event_name, event_created_at, processed, status, error_message, retry_count, event_data')
    .eq('event_name', eventName)
    .order('event_created_at', { ascending: false })
    .limit(10);

  if (webhookErr) {
    console.error('Error fetching webhook events:', webhookErr);
  } else {
    console.log(`Found ${(webhookEvents || []).length} recent ${eventName} events`);
    for (const event of (webhookEvents || [])) {
      const eventData = event.event_data as any;
      const txId = eventData?.TransactionId;
      const bankId = eventData?.BankAccountId;
      if (txId === transactionId || txId === String(transactionId)) {
        console.log(`\nFound matching event for TransactionId ${transactionId}:`);
        console.log(JSON.stringify({
          id: event.id,
          webhook_id: event.buildium_webhook_id,
          event_name: event.event_name,
          created_at: event.event_created_at,
          processed: event.processed,
          status: event.status,
          error_message: event.error_message,
          retry_count: event.retry_count,
          transaction_id: txId,
          bank_account_id: bankId,
        }, null, 2));
      }
    }
  }

  // Check if transaction was created
  console.log('\n=== Transaction Status ===');
  const { data: transaction, error: txErr } = await supabaseAdmin
    .from('transactions')
    .select('id, buildium_transaction_id, transaction_type, total_amount, date, memo, bank_gl_account_id')
    .eq('buildium_transaction_id', transactionId)
    .maybeSingle();

  if (txErr) {
    console.error('Error fetching transaction:', txErr);
  } else if (transaction) {
    console.log('Transaction found:');
    console.log(JSON.stringify(transaction, null, 2));
  } else {
    console.log('No transaction found with buildium_transaction_id = 974933');
  }

  // Check transaction lines
  if (transaction) {
    console.log('\n=== Transaction Lines ===');
    const { data: lines, error: linesErr } = await supabaseAdmin
      .from('transaction_lines')
      .select('id, transaction_id, gl_account_id, posting_type, amount, memo, gl_accounts(name)')
      .eq('transaction_id', transaction.id);
    
    if (linesErr) {
      console.error('Error fetching transaction lines:', linesErr);
    } else {
      console.log(`Found ${(lines || []).length} transaction lines:`);
      for (const line of (lines || [])) {
        const glAccount = (line as any).gl_accounts;
        console.log(JSON.stringify({
          id: line.id,
          gl_account_id: line.gl_account_id,
          gl_account_name: glAccount?.name || null,
          posting_type: line.posting_type,
          amount: line.amount,
          memo: line.memo,
        }, null, 2));
      }
    }
  }

  // Verify bank GL account
  console.log('\n=== Bank GL Account Verification ===');
  const { data: bankGl, error: bankErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, buildium_gl_account_id, is_bank_account, org_id')
    .eq('buildium_gl_account_id', 10407)
    .eq('is_bank_account', true)
    .maybeSingle();

  if (bankErr) {
    console.error('Error fetching bank GL account:', bankErr);
  } else if (bankGl) {
    console.log('Bank GL account found:');
    console.log(JSON.stringify(bankGl, null, 2));
  } else {
    console.log('No bank GL account found with buildium_gl_account_id = 10407 and is_bank_account = true');
    
    // Try without is_bank_account filter
    console.log('\nTrying without is_bank_account filter...');
    const { data: bankGlAlt } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, buildium_gl_account_id, is_bank_account, org_id')
      .eq('buildium_gl_account_id', 10407)
      .maybeSingle();
    if (bankGlAlt) {
      console.log('Found account (may not be marked as bank account):');
      console.log(JSON.stringify(bankGlAlt, null, 2));
    }
  }

  // Verify UDF account
  console.log('\n=== UDF Account Verification ===');
  const { data: udfAccounts, error: udfErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, default_account_name, org_id')
    .or('name.ilike.%undeposited funds%,default_account_name.ilike.%undeposited funds%')
    .limit(5);

  if (udfErr) {
    console.error('Error fetching UDF accounts:', udfErr);
  } else {
    console.log(`Found ${(udfAccounts || []).length} potential UDF accounts:`);
    for (const acc of (udfAccounts || [])) {
      console.log(JSON.stringify(acc, null, 2));
    }
  }

  // Check the specific GL account ID mentioned
  console.log('\n=== Specific GL Account Check ===');
  const { data: specificGl, error: specificErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, buildium_gl_account_id, is_bank_account, org_id')
    .eq('id', '2a4f9f50-fe28-49d4-afc3-3bc6fa4e9175')
    .maybeSingle();

  if (specificErr) {
    console.error('Error fetching specific GL account:', specificErr);
  } else if (specificGl) {
    console.log('Specific GL account details:');
    console.log(JSON.stringify(specificGl, null, 2));
  } else {
    console.log('GL account 2a4f9f50-fe28-49d4-afc3-3bc6fa4e9175 not found');
  }
}

main()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
