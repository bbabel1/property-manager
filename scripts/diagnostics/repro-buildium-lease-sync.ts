import 'dotenv/config';
import { buildiumSync } from '@/lib/buildium-sync';
import { supabase, supabaseAdmin } from '@/lib/db';

async function fetchTenantState(leaseId: number) {
  const db = supabaseAdmin || supabase;
  const { data } = await db
    .from('lease_contacts')
    .select(
      `
        role,
        tenant_id,
        tenants:tenants (
          buildium_tenant_id
        )
      `,
    )
    .eq('lease_id', leaseId);

  return (data || []).map((row) => ({
    role: row?.role,
    tenantId: row?.tenant_id,
    buildiumTenantId: Array.isArray(row?.tenants)
      ? (row.tenants[0]?.buildium_tenant_id ?? null)
      : (row as any)?.tenants?.buildium_tenant_id ?? null,
  }));
}

async function run() {
  const leaseIdArg = Number(process.argv[2]);
  const overrideOrgId = process.argv[3];
  if (!Number.isFinite(leaseIdArg)) {
    console.error('Usage: tsx scripts/diagnostics/repro-buildium-lease-sync.ts <leaseId> [orgId]');
    process.exit(1);
  }

  const db = supabaseAdmin || supabase;
  const { data: lease, error } = await db.from('lease').select('*').eq('id', leaseIdArg).maybeSingle();
  if (error) {
    console.error('Failed to load lease', error);
    process.exit(1);
  }
  if (!lease) {
    console.error(`Lease ${leaseIdArg} not found`);
    process.exit(1);
  }

  console.log('=== Before sync: tenant state ===');
  console.table(await fetchTenantState(leaseIdArg));

  console.log('=== Invoking syncLeaseToBuildium ===');
  const syncResult = await buildiumSync.syncLeaseToBuildium(lease as any, overrideOrgId || undefined);
  console.log(syncResult);

  console.log('=== After sync: tenant state ===');
  console.table(await fetchTenantState(leaseIdArg));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
