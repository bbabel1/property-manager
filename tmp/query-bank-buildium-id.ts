import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });
import { supabaseAdmin } from '../src/lib/db';

async function run(){
  const { data, error } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, buildium_gl_account_id, org_id')
    .eq('id','2a4f9f50-fe28-49d4-afc3-3bc6fa4e9175')
    .maybeSingle();
  console.log({data,error});
}
run();
