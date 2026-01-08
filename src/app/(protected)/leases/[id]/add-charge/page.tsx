import Link from 'next/link';
import { X } from 'lucide-react';

import EnterChargeFormShell from './EnterChargeFormShell';
import { loadChargeFormData } from '@/server/leases/load-charge-form-data';
import { Button } from '@/components/ui/button';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';

function formatSummary(propertyUnit?: string | null, tenants?: string | null) {
  if (propertyUnit && tenants) return `${propertyUnit} • ${tenants}`;
  if (propertyUnit) return propertyUnit;
  if (tenants) return tenants;
  return null;
}

function ErrorState({ message, backHref }: { message: string; backHref: string }) {
  return (
    <PageShell>
      <PageHeader title="Add charge" />
      <PageBody constrain="xl">
        <div className="border-destructive/30 bg-destructive/10 text-destructive max-w-3xl rounded-md border px-4 py-3 text-sm">
          {message}
        </div>
        <div className="mt-4">
          <Link href={backHref} className="text-primary hover:underline">
            Back to lease
          </Link>
        </div>
      </PageBody>
    </PageShell>
  );
}

export default async function AddChargePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const returnTo =
    (sp && typeof sp.returnTo === 'string' && sp.returnTo) || `/leases/${id}?tab=financials`;

  const result = await loadChargeFormData(id, { searchParams: sp || {} });
  if (!result.ok) {
    return <ErrorState message={result.error} backHref={returnTo} />;
  }

  const { data } = result;
  const summary = formatSummary(data.leaseSummary.propertyUnit, data.leaseSummary.tenants);

  return (
    <PageShell>
      <PageHeader
        title="Add charge"
        description={summary || undefined}
        actions={
          <Link href={returnTo} aria-label="Close">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        }
        constrain="xl"
      />

      <PageBody constrain="xl">
        <EnterChargeFormShell
          leaseId={data.leaseId}
          accounts={data.accountOptions}
          returnTo={returnTo}
          orgId={data.orgId}
          prefillAccountId={data.prefill?.accountId ?? undefined}
          prefillAmount={data.prefill?.amount ?? undefined}
          prefillMemo={data.prefill?.memo ?? undefined}
          prefillDate={data.prefill?.date ?? undefined}
          hideTitle
        />
      </PageBody>
    </PageShell>
  );
}
