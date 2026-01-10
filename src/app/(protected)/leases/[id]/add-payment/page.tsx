import Link from 'next/link';
import { X } from 'lucide-react';

import ReceivePaymentFormShell from './ReceivePaymentFormShell';
import { loadPaymentFormData, type PaymentFormPrefillResult } from '@/server/leases/load-payment-form-data';
import { Button } from '@/components/ui/button';

// Force the Node.js runtime; Supabase server fetching relies on Node APIs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        <h1 className="text-xl font-semibold">Receive payment</h1>
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

export default async function AddPaymentPage({
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

  let result: PaymentFormPrefillResult;
  try {
    result = await loadPaymentFormData(id, { searchParams: sp || {} });
  } catch (err) {
    console.error('add-payment: failed to load form data', err);
    return <ErrorState message="Unable to load payment form" backHref={returnTo} />;
  }
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
            <div className="text-xl font-semibold">Receive payment</div>
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
        <ReceivePaymentFormShell
          leaseId={data.leaseId}
          accounts={data.accountOptions}
          tenants={data.tenantOptions}
          leaseSummary={data.leaseSummary}
          returnTo={returnTo}
          orgId={data.orgId}
          prefillTenantId={data.prefill?.tenantId ?? undefined}
          prefillAccountId={data.prefill?.accountId ?? undefined}
          prefillAmount={data.prefill?.amount ?? undefined}
          prefillMemo={data.prefill?.memo ?? undefined}
          prefillDate={data.prefill?.date ?? undefined}
        />
      </div>
    </div>
  );
}
