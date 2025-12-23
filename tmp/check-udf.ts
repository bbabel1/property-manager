import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });
import { supabaseAdmin } from '../src/lib/db';

async function run(){
  const udfId = '29997f39-ad70-46b3-8778-7e4636b4eec3';
  const {data, error} = await supabaseAdmin
    .from('gl_accounts')
    .select('id,name,is_bank_account,default_account_name,bank_balance')
    .eq('id', udfId)
    .maybeSingle();
  console.log({data,error});
}
run();
