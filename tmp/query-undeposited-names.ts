import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const udfId = '29997f39-ad70-46b3-8778-7e4636b4eec3';
  const { data: txs, error } = await supabaseAdmin
    .from('transactions')
    .select('id,date,memo,payee_name,paid_by_label,paid_to_name,tenant_id,paid_to_tenant_id,paid_to_vendor_id,payee_tenant_id,paid_by_accounting_entity_id')
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
      payee_name: tx.payee_name,
      paid_by_label: tx.paid_by_label,
      paid_to_name: tx.paid_to_name,
      tenant_id: tx.tenant_id,
      payee_tenant_id: (tx as any).payee_tenant_id,
      paid_to_tenant_id: (tx as any).paid_to_tenant_id,
      paid_to_vendor_id: (tx as any).paid_to_vendor_id,
      paid_by_accounting_entity_id: (tx as any).paid_by_accounting_entity_id,
    });
  }
}
run();
