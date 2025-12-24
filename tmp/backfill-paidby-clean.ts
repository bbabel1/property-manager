import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run(){
  const { supabaseAdmin } = await import('../src/lib/db');
  const depositId = '2971e83f-e895-45f3-ae14-d3837d2e09c4';

  // Find linked payment rows for this deposit via transaction_payment_transactions
  const { data: splits, error: splitErr } = await supabaseAdmin
    .from('transaction_payment_transactions')
    .select('buildium_payment_transaction_id')
    .eq('transaction_id', depositId);
  if (splitErr) throw splitErr;
  const buildiumIds = (splits || []).map((s)=>s.buildium_payment_transaction_id).filter(Boolean);

  const tenantIds = new Set<string>();
  const propIds = new Set<string>();
  const unitIds = new Set<string>();
  if (buildiumIds.length > 0) {
  const { data: payments, error: payErr } = await supabaseAdmin
      .from('transactions')
      .select('tenant_id, payee_tenant_id, transaction_lines(property_id, unit_id)')
      .in('buildium_transaction_id', buildiumIds);
  if (payErr) throw payErr;
    type PaymentRow = {
      tenant_id?: string | null
      payee_tenant_id?: number | null
      transaction_lines?: { property_id?: string | null; unit_id?: string | null }[]
    }
    (payments as PaymentRow[] | null | undefined)?.forEach((p)=>{
      if (p?.tenant_id) tenantIds.add(String(p.tenant_id));
      if (p?.payee_tenant_id != null) tenantIds.add(String(p.payee_tenant_id));
      (p?.transaction_lines || []).forEach((l)=>{
        if (l?.property_id) propIds.add(String(l.property_id));
        if (l?.unit_id) unitIds.add(String(l.unit_id));
      });
    });
  }

  const tenantNameById = new Map<string,string>();
  if (tenantIds.size > 0) {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name)')
      .in('id', Array.from(tenantIds));
    (tenants || []).forEach((t)=>{
      const c = t?.contacts || {};
      const name = c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || null;
      if (name && t?.id) tenantNameById.set(String(t.id), name);
    });
  }

  const labels = new Set<string>();
  tenantIds.forEach((tid)=>{ const name = tenantNameById.get(tid); if (name) labels.add(name); });

  if (labels.size === 0 && propIds.size > 0) {
    const { data: props } = await supabaseAdmin
      .from('properties')
      .select('id, name, address_line1')
      .in('id', Array.from(propIds));
    (props || []).forEach((p)=>{
      const label = `${p?.name || 'Property'}${p?.address_line1 ? ` • ${p.address_line1}` : ''}`;
      if (p?.id && label) labels.add(label);
    });
  }

  const paidByLabel = labels.size > 1 ? `${Array.from(labels)[0]} +${labels.size-1}` : Array.from(labels)[0] || null;

  const { error: upErr } = await supabaseAdmin
    .from('transactions')
    .update({ paid_by_label: paidByLabel, updated_at: new Date().toISOString() })
    .eq('id', depositId);
  console.log({ paidByLabel, upErr });
}

run();
