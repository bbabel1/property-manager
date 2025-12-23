import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const tenantId = 'c613f2db-b121-4cd4-81a8-1e4dafd9e48d';
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, org_id, contact:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name)')
    .eq('id', tenantId)
    .maybeSingle();
  console.log({data,error});
}
run();
