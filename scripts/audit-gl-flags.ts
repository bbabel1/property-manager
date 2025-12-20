import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const { data, error } = await db
    .from('gl_accounts')
    .select('id, org_id, name, type, sub_type, gl_account_category ( category ), is_bank_account, is_security_deposit_liability, exclude_from_cash_balances')
    .limit(5000);

  if (error) {
    console.error('Query error', error.message);
    process.exit(1);
  }

  const rows = Array.isArray(data) ? data : [];
  const bankCandidates = rows.filter((r) => {
    const name = (r.name || '').toLowerCase();
    const sub = (r.sub_type || '').toLowerCase();
    const type = (r.type || '').toLowerCase();
    return (
      !r.is_bank_account &&
      (type === 'asset' || sub.includes('cash') || name.includes('bank') || name.includes('checking') || name.includes('operating') || name.includes('trust'))
    );
  });

  const depositCandidates = rows.filter((r) => {
    const name = (r.name || '').toLowerCase();
    const sub = (r.sub_type || '').toLowerCase();
    const cat = (r.gl_account_category as any)?.category?.toLowerCase?.() || '';
    const type = (r.type || '').toLowerCase();
    return (
      type === 'liability' &&
      !r.is_security_deposit_liability &&
      (sub.includes('deposit') || cat.includes('deposit') || name.includes('deposit'))
    );
  });

  const bankExcluded = rows.filter((r) => r.is_bank_account && r.exclude_from_cash_balances);

  console.log('Potential bank GLs missing bank flag:', bankCandidates.length);
  bankCandidates.slice(0, 20).forEach((r) =>
    console.log(`- [${r.org_id}] ${r.name} (${r.type}/${r.sub_type}) id=${r.id}`),
  );

  console.log('Potential deposit GLs missing deposit flag:', depositCandidates.length);
  depositCandidates.slice(0, 20).forEach((r) =>
    console.log(`- [${r.org_id}] ${r.name} (${r.type}/${r.sub_type}) id=${r.id}`),
  );

  console.log('Bank GLs excluded from cash balances:', bankExcluded.length);
  bankExcluded.slice(0, 20).forEach((r) =>
    console.log(`- [${r.org_id}] ${r.name} (${r.type}/${r.sub_type}) id=${r.id}`),
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
