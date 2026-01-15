import Link from 'next/link';
import { X } from 'lucide-react';

import EnterChargeFormShell from '../add-charge/EnterChargeFormShell';
import { loadChargeEditData } from '@/server/leases/load-charge-edit-data';
import { Button } from '@/components/ui/button';
import { Body, Heading } from '@/ui/typography';

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
        <Heading as="h1" size="h3">
          Edit charge
        </Heading>
      </div>
      <div className="px-6 py-6">
        <Body
          as="div"
          size="sm"
          className="border-destructive/30 bg-destructive/10 text-destructive max-w-3xl rounded-md border px-4 py-3"
        >
          {message}
        </Body>
        <Body as="div" size="sm" className="mt-4">
          <Link href={backHref} className="text-primary hover:underline">
            Back to lease
          </Link>
        </Body>
      </div>
    </div>
  );
}

export default async function EditChargePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const transactionIdRaw = sp?.transactionId;
  const transactionId =
    typeof transactionIdRaw === 'string' ? transactionIdRaw : Array.isArray(transactionIdRaw) ? transactionIdRaw[0] : undefined;
  const returnTo =
    (sp && typeof sp.returnTo === 'string' && sp.returnTo) || `/leases/${id}?tab=financials`;

  const result = await loadChargeEditData(id, transactionId);
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
            <Heading as="h1" size="h3">
              Edit charge
            </Heading>
            {summary ? (
              <Body tone="muted" size="sm">
                {summary}
              </Body>
            ) : null}
          </div>
          <Link href={returnTo} aria-label="Close">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-md">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <EnterChargeFormShell
          leaseId={data.leaseId}
          accounts={data.accountOptions}
          returnTo={returnTo}
          mode="edit"
          transactionId={data.transactionId}
          initialValues={data.initialValues}
        />
      </div>
    </div>
  );
}
