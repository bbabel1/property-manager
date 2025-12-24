import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const udfId = '29997f39-ad70-46b3-8778-7e4636b4eec3';
  const { data: txs, error } = await supabaseAdmin
    .from('transactions')
    .select('id,date,memo,payee_name,tenant_id,payee_tenant_id,transaction_type,bank_gl_account_id,total_amount')
    .eq('bank_gl_account_id', udfId)
    .in('transaction_type', ['Payment','ElectronicFundsTransfer','ApplyDeposit'])
    .order('date',{ascending:false})
    .limit(10);
  console.log({error});
  for(const tx of txs||[]){
    console.log({
      id: tx.id,
      date: tx.date,
      memo: tx.memo,
      payee_name: (tx as { payee_name?: string | null }).payee_name,
      tenant_id: tx.tenant_id,
      payee_tenant_id: (tx as { payee_tenant_id?: string | number | null }).payee_tenant_id,
      transaction_type: tx.transaction_type,
      bank_gl_account_id: tx.bank_gl_account_id,
      total_amount: tx.total_amount,
    });
  }
}
run();
