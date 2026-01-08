import Link from 'next/link';
import { X } from 'lucide-react';

import IssueCreditFormShell from './IssueCreditFormShell';
import { loadCreditFormData } from '@/server/leases/load-credit-form-data';
import { Button } from '@/components/ui/button';

function formatSummary(propertyUnit?: string | null, tenants?: string | null) {
  if (propertyUnit && tenants) return `${propertyUnit} • ${tenants}`;
  if (propertyUnit) return propertyUnit;
  if (tenants) return tenants;
  return null;
}

function ErrorState({ message, backHref }: { message: string; backHref: string }) {
  return (
    <div className="bg-background text-foreground min-h-screen w-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Issue credit</h1>
      </div>
      <div className="px-6 py-6">
        <div className="border-destructive/30 bg-destructive/10 text-destructive max-w-3xl rounded-md border px-4 py-3 text-sm">
          {message}
        </div>
        <div className="mt-4">
          <Link href={backHref} className="text-primary hover:underline">
            Back to lease
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function AddCreditPage({
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

  const result = await loadCreditFormData(id, { searchParams: sp || {} });
  if (!result.ok) {
    return <ErrorState message={result.error} backHref={returnTo} />;
  }

  const { data } = result;
  const summary = formatSummary(data.leaseSummary.propertyUnit, data.leaseSummary.tenants);

  return (
    <div className="bg-background text-foreground min-h-screen w-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Issue credit</div>
            {summary ? <div className="text-muted-foreground text-sm">{summary}</div> : null}
          </div>
          <Link href={returnTo} aria-label="Close">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-md">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <IssueCreditFormShell
          leaseId={data.leaseId}
          accounts={data.accountOptions}
          leaseSummary={data.leaseSummary}
          returnTo={returnTo}
          orgId={data.orgId}
          prefillAccountId={data.prefill?.accountId ?? undefined}
          prefillAmount={data.prefill?.amount ?? undefined}
          prefillMemo={data.prefill?.memo ?? undefined}
          prefillDate={data.prefill?.date ?? undefined}
        />
      </div>
    </div>
  );
}
