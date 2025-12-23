import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const propertyId = 'ac2a17f5-ae71-4066-8568-03bfb8bd505c';
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('id,name,org_id,operating_bank_gl_account_id,deposit_trust_gl_account_id')
    .eq('id', propertyId)
    .maybeSingle();
  console.log({data,error});
}
run();
