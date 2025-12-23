import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const bankId = '2a4f9f50-fe28-49d4-afc3-3bc6fa4e9175';
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id,date,transaction_type,total_amount,paid_by_label,paid_to_name,memo,bank_gl_account_id')
    .eq('bank_gl_account_id', bankId)
    .eq('transaction_type', 'Deposit')
    .eq('date', '2025-12-22')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log({error, data});
}
run();
