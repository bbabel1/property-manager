import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import { supabase, supabaseAdmin } from '@/lib/db';
import BillFileAttachmentsCard from '@/components/bills/BillFileAttachmentsCard';
import BillActionsMenu from '@/components/bills/BillActionsMenu';
import { listFilesForEntity } from '@/lib/files';
import type { BillFileRecord } from '@/components/bills/types';

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';

type LineItem = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  unitLabel: string;
  accountLabel: string;
  description: string;
  initialAmount: number;
  remainingAmount: number;
};

type DetailEntry = {
  name: string;
  value: string;
  multiline?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const isoLike = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

function formatCurrency(value?: number | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
}

function normalizeBillStatus(value: unknown): BillStatusLabel {
  switch (String(value ?? '').toLowerCase()) {
    case 'overdue':
      return 'Overdue';
    case 'due':
    case 'pending':
      return 'Due';
    case 'partiallypaid':
    case 'partially_paid':
    case 'partially paid':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

function deriveBillStatusFromDates(
  currentStatus: BillStatusLabel,
  dueDateIso: string | null,
  paidDateIso: string | null,
): BillStatusLabel {
  if (currentStatus === 'Cancelled') return 'Cancelled';
  if (currentStatus === 'Partially paid') return 'Partially paid';
  if (currentStatus === 'Paid') return 'Paid';
  if (paidDateIso) return 'Paid';

  if (dueDateIso) {
    const due = new Date(`${dueDateIso}T00:00:00Z`);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      const todayUtc = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      if (due < todayUtc) {
        return 'Overdue';
      }
    }
  }

  return 'Due';
}

function statusToVariant(
  status: BillStatusLabel,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Paid':
      return 'secondary';
    case 'Overdue':
      return 'destructive';
    case 'Partially paid':
      return 'default';
    case 'Cancelled':
      return 'outline';
    default:
      return 'outline';
  }
}

export default async function BillDetailsPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;

  const db = supabaseAdmin || supabase;
  if (!db) {
    throw new Error('Database client is unavailable');
  }

  const billRes = await (db as any)
    .from('transactions')
    .select(
      'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id, buildium_bill_id, transaction_type',
    )
    .eq('id', billId)
    .maybeSingle();

  const bill = billRes?.data;

  if (billRes?.error) {
    console.error('Failed to load bill', billRes.error);
  }

  if (!bill || bill.transaction_type !== 'Bill') {
    notFound();
  }

  const [linesRes, vendorRes] = await Promise.all([
    (db as any)
      .from('transaction_lines')
      .select(
        `id,
         amount,
         memo,
         posting_type,
         property_id,
         unit_id,
         date,
         created_at,
         gl_accounts(name, account_number, type),
         units(unit_number, unit_name),
         properties(name)`,
      )
      .eq('transaction_id', bill.id)
      .order('created_at', { ascending: true }),
    bill.vendor_id
      ? (db as any)
          .from('vendors')
          .select('id, contacts(display_name, company_name)')
          .eq('id', bill.vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (linesRes?.error) {
    console.error('Failed to load bill lines', linesRes.error);
  }

  if (vendorRes?.error) {
    console.error('Failed to load vendor for bill', vendorRes.error);
  }

  const rawLines: any[] = Array.isArray(linesRes?.data)
    ? (linesRes.data as any[]).filter(
        (line) => String(line?.posting_type || '').toLowerCase() !== 'credit',
      )
    : [];
  const vendor = vendorRes?.data as
    | (Record<string, unknown> & {
        contacts?: { display_name?: string | null; company_name?: string | null } | null;
      })
    | null;

  const vendorContact = vendor && typeof vendor.contacts === 'object' ? vendor.contacts : null;
  const vendorName =
    (vendorContact?.display_name as string | undefined) ||
    (vendorContact?.company_name as string | undefined) ||
    'Vendor';

  let billFiles: BillFileRecord[] = [];
  try {
    const { files: linkedFiles, links } = await listFilesForEntity(db as any, {
      type: 'bill',
      id: bill.id,
    });
    const filesById = new Map<string, any>(linkedFiles.map((file: any) => [file.id, file]));
    billFiles = links
      .map((link: any) => {
        const file = filesById.get(link.file_id);
        if (!file) return null;
        const uploadedAt =
          typeof link?.added_at === 'string'
            ? link.added_at
            : typeof file?.created_at === 'string'
              ? file.created_at
              : null;
        if (!uploadedAt) return null;
        const uploadedBy = links?.length ? ((link?.added_by as string | null) ?? null) : null;
        const fileRecord: BillFileRecord = {
          id: file.id as string,
          title: (file.file_name as string) || 'File',
          uploadedAt,
          uploadedBy,
          buildiumFileId: typeof file?.buildium_file_id === 'number' ? file.buildium_file_id : null,
          buildiumHref: typeof file?.buildium_href === 'string' ? file.buildium_href : null,
          buildiumSyncError: null,
        };
        return fileRecord;
      })
      .filter(Boolean) as BillFileRecord[];
    billFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (error) {
    console.error('Failed to load bill file attachments', error);
  }

  const billAmount = Number(bill.total_amount ?? 0) || 0;
  const billDateLabel = formatDate(bill.date);
  const billDueLabel = formatDate(bill.due_date);
  const statusNormalized = normalizeBillStatus(bill.status);
  const statusLabel = deriveBillStatusFromDates(
    statusNormalized,
    bill.due_date ?? null,
    bill.paid_date ?? null,
  );

  // First, calculate line items and totals
  const mappedLineItems = rawLines
    .map((line, index) => {
      const propertyName =
        (line?.properties && typeof line.properties === 'object' && 'name' in line.properties
          ? (line.properties as { name?: string | null }).name
          : undefined) || '—';
      const unitNumber =
        line?.units && typeof line.units === 'object'
          ? (line.units as { unit_number?: string | null; unit_name?: string | null })
              .unit_number ||
            (line.units as { unit_number?: string | null; unit_name?: string | null }).unit_name
          : null;
      const account =
        line?.gl_accounts && typeof line.gl_accounts === 'object'
          ? (line.gl_accounts as {
              name?: string | null;
              account_number?: string | number | null;
              type?: string | null;
            })
          : null;
      const accountName = account?.name || null;
      const accountNumber = account?.account_number || null;
      const normalizedAccountName = (accountName || '').trim().toLowerCase();

      const amountRaw = Number(line?.amount ?? 0);
      const initialAmount = Math.abs(amountRaw) || 0;
      const remainingAmount = statusLabel === 'Paid' ? 0 : initialAmount;

      return {
        item: {
          id: line?.id ? String(line.id) : `${bill.id}-line-${index}`,
          propertyId: line?.property_id ? String(line.property_id) : null,
          propertyName,
          unitLabel: unitNumber ? String(unitNumber) : 'Property level',
          accountLabel: accountName || (accountNumber ? String(accountNumber) : 'Account'),
          description: line?.memo || bill.memo || '—',
          initialAmount,
          remainingAmount,
        } satisfies LineItem,
        initialAmount,
        normalizedAccountName,
      };
    })
    .filter(({ initialAmount }) => initialAmount > 0);

  const withoutAccountsPayable = mappedLineItems.filter(
    ({ normalizedAccountName }) => !normalizedAccountName.startsWith('accounts payable'),
  );

  const debitLineItems = (
    withoutAccountsPayable.length ? withoutAccountsPayable : mappedLineItems
  ).map(({ item }) => item);

  // Calculate totals immediately after debitLineItems is defined
  const lineItemsInitialTotal = debitLineItems.reduce(
    (sum, item) => sum + (item.initialAmount || 0),
    0,
  );
  const lineItemsRemainingTotal = debitLineItems.reduce(
    (sum, item) => sum + (item.remainingAmount || 0),
    0,
  );

  // Now calculate derived values that depend on the totals
  const remainingAmount = statusLabel === 'Paid' ? 0 : lineItemsRemainingTotal;

  const detailEntries: DetailEntry[] = [
    { name: 'Date', value: billDateLabel },
    { name: 'Due', value: billDueLabel },
    { name: 'Reference number', value: bill.reference_number || '—' },
    { name: 'Work order', value: '—' },
    { name: 'Memo', value: bill.memo || '—', multiline: true },
    { name: 'Pay to', value: vendorName || '—' },
  ];

  const headerMetaParts = [
    `Bill ${formatCurrency(lineItemsInitialTotal || billAmount)}`,
    `Remaining: ${formatCurrency(lineItemsRemainingTotal)}`,
    `Due: ${billDueLabel}`,
  ];
  if (bill.reference_number) headerMetaParts.push(`Ref: ${bill.reference_number}`);

  return (
    <div className="space-y-8">
      <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-foreground text-2xl font-semibold">{vendorName}</h1>
            {statusLabel ? (
              <Badge variant={statusToVariant(statusLabel)}>{statusLabel}</Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{headerMetaParts.join(' • ')}</span>
            <Link
              href={`/bills/${bill.id}/edit`}
              className="text-primary px-0 text-sm font-medium hover:underline"
            >
              Edit
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link href={`/bills/${bill.id}/pay`}>Pay bill</Link>
          </Button>
          <BillActionsMenu billId={bill.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border bg-muted/40 flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>Bill details</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <dl className="grid gap-x-12 gap-y-6 text-sm md:grid-cols-2">
                {detailEntries.map((entry) => (
                  <div key={entry.name} className="space-y-1">
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {entry.name}
                    </dt>
                    <dd
                      className={cn(
                        'text-foreground',
                        entry.multiline ? 'whitespace-pre-wrap' : undefined,
                      )}
                    >
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border bg-muted/40 flex items-center justify-between border-b px-4 !pt-4 !pb-4">
              <CardTitle>Approval</CardTitle>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="!h-auto !min-h-0 px-0 !py-0 text-sm font-medium"
                disabled
                title="Coming soon"
              >
                Add approval
              </Button>
            </CardHeader>
            <CardContent className="text-muted-foreground px-6 py-8 text-sm">
              This bill does not have a recorded approval.
            </CardContent>
          </Card>

          <Card className="border-border gap-0 border shadow-sm">
            <CardHeader className="border-border bg-muted/40 flex items-center justify-between border-b px-4 !pt-4 !pb-4">
              <CardTitle>Item details</CardTitle>
            </CardHeader>
            <CardContent className="![&:last-child]:pb-0 overflow-hidden p-0">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 border-b">
                    <TableHead className="text-foreground w-[18rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Property or company
                    </TableHead>
                    <TableHead className="text-foreground w-[12rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Unit
                    </TableHead>
                    <TableHead className="text-foreground w-[18rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Account
                    </TableHead>
                    <TableHead className="text-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Description
                    </TableHead>
                    <TableHead className="text-foreground w-[10rem] px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-border divide-y">
                  {debitLineItems.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground bg-background px-4 py-8 text-center text-sm"
                      >
                        No itemized charges recorded for this bill.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {debitLineItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-transparent">
                          <TableCell className="text-foreground border-border/60 border-r border-dashed px-4 py-3">
                            {item.propertyName}
                          </TableCell>
                          <TableCell className="text-foreground border-border/60 border-r border-dashed px-4 py-3">
                            {item.unitLabel}
                          </TableCell>
                          <TableCell className="text-foreground border-border/60 border-r border-dashed px-4 py-3">
                            {item.accountLabel}
                          </TableCell>
                          <TableCell className="text-foreground border-border/60 border-r border-dashed px-4 py-3 whitespace-pre-wrap">
                            {item.description}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-medium">
                            {formatCurrency(item.initialAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
                <TableFooter className="bg-background font-semibold">
                  <TableRow className="border-border border-t">
                    <TableCell colSpan={4} className="text-foreground px-4 py-3">
                      Total
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {formatCurrency(lineItemsInitialTotal || billAmount)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <BillFileAttachmentsCard
            billId={bill.id}
            uploaderName={vendorName}
            initialFiles={billFiles}
          />
        </div>

        <div className="w-full space-y-6 lg:ml-auto lg:max-w-sm">
          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border bg-muted/40 flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>Bill amount</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Remaining
                </span>
                <span className="text-foreground text-xl font-semibold">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border bg-muted/40 flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>Available credits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="border-border bg-muted/40 rounded-lg border border-dashed p-4 text-center">
                <div className="text-foreground text-xl font-semibold">0.00</div>
                <div className="text-foreground text-xs">No vendor credits</div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled title="Coming soon">
                Add a credit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
