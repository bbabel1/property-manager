import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const ids = ['2a4f9f50-fe28-49d4-afc3-3bc6fa4e9175','ad225415-df13-4846-9154-cbdc6afd9754','29997f39-ad70-46b3-8778-7e4636b4eec3'];
  const { data, error } = await supabaseAdmin
    .from('gl_accounts')
    .select('id,name,default_account_name,is_bank_account')
    .in('id', ids);
  console.log({data,error});
}
run();
