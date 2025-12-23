import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function main() {
  const { supabaseAdmin } = await import('../src/lib/db');

  const bankId = 'ad225415-df13-4846-9154-cbdc6afd9754';

  const { data: bank, error: bankErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id,name,org_id')
    .eq('id', bankId)
    .maybeSingle();
  console.log('bank', bank, bankErr);
  const orgId = (bank as any)?.org_id ?? null;
  const { data: udf, error: udfErr } = await supabaseAdmin
    .from('gl_accounts')
    .select('id,name')
    .eq('org_id', orgId)
    .or('default_account_name.ilike.%Undeposited Funds%,name.ilike.%Undeposited Funds%')
    .maybeSingle();
  console.log('udf', udf, udfErr);
  if (!udf) return;
  const { data: txs, error } = await supabaseAdmin
    .from('transactions')
    .select(`id,date,total_amount,memo,transaction_type,bank_gl_account_id,buildium_transaction_id,payee_name,paid_by_label,paid_to_name,units:units(unit_number,unit_name,properties:properties(name)),transaction_lines(id,gl_account_id,amount,posting_type)`)
    .eq('bank_gl_account_id', (udf as any).id)
    .in('transaction_type', ['Payment','ElectronicFundsTransfer','ApplyDeposit'])
    .order('date',{ascending:false})
    .limit(5);
  console.log('tx count', txs?.length, error);
  for (const tx of txs || []) {
    console.log({
      id: (tx as any).id,
      date: (tx as any).date,
      total_amount: (tx as any).total_amount,
      memo: (tx as any).memo,
      paid_by_label: (tx as any).paid_by_label,
      payee_name: (tx as any).payee_name,
      unit: (tx as any).units?.unit_number ?? (tx as any).units?.unit_name,
      property: (tx as any).units?.properties?.name,
      lines: (tx as any).transaction_lines?.map((l:any)=>({amount:l.amount,posting_type:l.posting_type,gl:l.gl_account_id})),
    });
  }
}

main();
