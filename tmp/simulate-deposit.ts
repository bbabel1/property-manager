import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const udfGlAccountId = '29997f39-ad70-46b3-8778-7e4636b4eec3';
  const paymentIds = ['8d9a4a48-c6ff-4b4e-a773-61bfcaae176f'];
  const { data: payments, error: payErr } = await supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      total_amount,
      buildium_transaction_id,
      bank_gl_account_id,
      memo,
      transaction_lines!inner(gl_account_id, amount, posting_type, property_id, unit_id)
    `,
    )
    .in('id', paymentIds)
    .eq('transaction_lines.gl_account_id', udfGlAccountId)
    .limit(1000);
  console.log('payErr', payErr);
  console.dir(payments, {depth: null});
}
run();
