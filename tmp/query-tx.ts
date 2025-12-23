import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const txId = '8d9a4a48-c6ff-4b4e-a773-61bfcaae176f';
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id,property_id,unit_id,org_id,buildium_property_id,buildium_unit_id')
    .eq('id', txId)
    .maybeSingle();
  console.log({data,error});
}
run();
