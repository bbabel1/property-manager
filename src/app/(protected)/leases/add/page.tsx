import Link from 'next/link';
import { X } from 'lucide-react';

import AddLeaseFormShell from './AddLeaseFormShell';
import { loadAddLeaseFormData } from '@/server/leases/load-add-lease-form-data';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';

export default async function AddLeasePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const returnTo = (sp && typeof sp.returnTo === 'string' && sp.returnTo) || '/leases';

  const result = await loadAddLeaseFormData({ searchParams: sp });
  if (!result.ok) {
    return (
      <PageShell>
        <PageHeader title="Add lease" constrain="xl" />
        <PageBody constrain="xl">
          <div className="border-destructive/30 bg-destructive/10 text-destructive max-w-3xl rounded-md border px-4 py-3 text-sm">
            {result.error}
          </div>
          <div className="mt-4">
            <Link href={returnTo} className="text-primary hover:underline">
              Back to leases
            </Link>
          </div>
        </PageBody>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Add lease"
        description="Create a new lease and assign tenants to a unit."
        actions={
          <Link href={returnTo} aria-label="Close">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-md">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        }
        constrain="xl"
      />
      <PageBody constrain="xl">
        <AddLeaseFormShell
          returnTo={returnTo}
          orgId={result.data.orgId}
          data={result.data.prefill}
          propertyOptions={result.data.propertyOptions}
          unitOptions={result.data.unitOptions}
          tenantOptions={result.data.tenantOptions}
        />
      </PageBody>
    </PageShell>
  );
}
