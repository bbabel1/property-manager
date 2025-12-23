import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const txId = '8d9a4a48-c6ff-4b4e-a773-61bfcaae176f';
  const { data: lines, error } = await supabaseAdmin
    .from('transaction_lines')
    .select('id,gl_account_id,amount,posting_type,property_id,unit_id')
    .eq('transaction_id', txId);
  console.log('lines', {error, lines});
}
run();
