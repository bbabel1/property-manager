#!/usr/bin/env tsx
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const txId = '5b63cff3-26b7-4f13-8220-9c98e93c55b2';

  const { data: tx } = await supabase
    .from('transactions')
    .select('id, buildium_transaction_id, transaction_type, total_amount, date')
    .eq('id', txId)
    .single();

  if (!tx) {
    console.log('Transaction not found');
    return;
  }

  console.log(`Transaction ${tx.buildium_transaction_id} (${tx.transaction_type}):`);
  console.log(`Total Amount: $${tx.total_amount}\n`);

  const { data: lines } = await supabase
    .from('transaction_lines')
    .select(
      'id, amount, posting_type, is_cash_posting, gl_account_id, gl_accounts!inner(name, type), created_at',
    )
    .eq('transaction_id', txId)
    .order('created_at', { ascending: true });

  if (!lines || lines.length === 0) {
    console.log('No lines found');
    return;
  }

  console.log('Transaction lines:');
  console.log('─'.repeat(100));
  lines.forEach((line: any, idx: number) => {
    const cashFlag = line.is_cash_posting ? 'CASH' : '     ';
    console.log(
      `${idx + 1}. ${line.gl_accounts.name.padEnd(35)} (${line.gl_accounts.type.padEnd(8)}) | ${line.posting_type.padEnd(6)} | $${Number(line.amount).toFixed(2).padStart(10)} | ${cashFlag} | Created: ${line.created_at}`,
    );
  });

  const debitTotal = lines
    .filter((l: any) => l.posting_type === 'Debit')
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const creditTotal = lines
    .filter((l: any) => l.posting_type === 'Credit')
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const debitCount = lines.filter((l: any) => l.posting_type === 'Debit').length;
  const creditCount = lines.filter((l: any) => l.posting_type === 'Credit').length;

  console.log('\n' + '─'.repeat(100));
  console.log(`Summary: ${debitCount} debits, ${creditCount} credits`);
  console.log(
    `Total: Debits=$${debitTotal.toFixed(2)}, Credits=$${creditTotal.toFixed(2)}, Difference=$${Math.abs(debitTotal - creditTotal).toFixed(2)}`,
  );

  // Check for duplicates
  const lineKeys = lines.map((l: any) => `${l.gl_account_id}-${l.posting_type}-${l.amount}`);
  const duplicates = lineKeys.filter((key, idx) => lineKeys.indexOf(key) !== idx);
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate line(s)!`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
