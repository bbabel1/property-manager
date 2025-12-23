import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const depositId = '2971e83f-e895-45f3-ae14-d3837d2e09c4';
  const { data: splits, error: splitErr } = await supabaseAdmin
    .from('transaction_payment_transactions')
    .select('buildium_payment_transaction_id, amount')
    .eq('transaction_id', depositId);
  if (splitErr) throw splitErr;
  const total = (splits || []).reduce((s, r) => s + Number(r?.amount ?? 0), 0);
  const buildiumIds = (splits || []).map((s:any)=>s.buildium_payment_transaction_id).filter(Boolean);
  let paidByLabel: string | null = null;
  if (buildiumIds.length > 0) {
    const { data: payments } = await supabaseAdmin
      .from('transactions')
      .select('id, tenant_id, paid_to_tenant_id, memo, transaction_lines(gl_account_id, property_id, unit_id)')
      .in('buildium_transaction_id', buildiumIds);
    const tenantIds = new Set<string>();
    (payments||[]).forEach((p:any)=>{ if(p.tenant_id) tenantIds.add(String(p.tenant_id)); if(p.paid_to_tenant_id) tenantIds.add(String(p.paid_to_tenant_id)); });
    const tenantNameById = new Map<string,string>();
    if(tenantIds.size>0){
      const { data: tenants } = await supabaseAdmin
        .from('tenants')
        .select('id, contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name)')
        .in('id', Array.from(tenantIds));
      (tenants||[]).forEach((t:any)=>{
        const c = t?.contacts || {};
        const name = c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || null;
        if(name && t?.id) tenantNameById.set(String(t.id), name);
      });
    }
    const labels = new Set<string>();
    for(const p of payments||[]){
      const name = (p.tenant_id && tenantNameById.get(String(p.tenant_id))) || (p.paid_to_tenant_id && tenantNameById.get(String(p.paid_to_tenant_id))) || null;
      const propId = (p.transaction_lines||[]).find((l:any)=>l.property_id)?.property_id ?? null;
      if(name) labels.add(name);
      if(propId){
        const { data: prop } = await supabaseAdmin.from('properties').select('id,name,address_line1').eq('id', propId).maybeSingle();
        const label = `${prop?.name || 'Property'}${prop?.address_line1 ? ` • ${prop.address_line1}` : ''}`;
        labels.add(label);
      }
    }
    paidByLabel = labels.size > 1 ? `${Array.from(labels)[0]} +${labels.size-1}` : Array.from(labels)[0] || null;
  }
  const { error: upErr } = await supabaseAdmin
    .from('transactions')
    .update({ total_amount: total, paid_by_label: paidByLabel, updated_at: new Date().toISOString() })
    .eq('id', depositId);
  console.log('updated', { total, paidByLabel, upErr });
}
run();
