import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const depositId = '2971e83f-e895-45f3-ae14-d3837d2e09c4';
  const { data, error } = await supabaseAdmin
    .from('transaction_payment_transactions')
    .select('*')
    .eq('transaction_id', depositId);
  console.log({error, data});
}
run();
