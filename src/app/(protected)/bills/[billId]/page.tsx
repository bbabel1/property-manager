import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody, PageColumns, PageHeader, PageShell } from '@/components/layout/page-shell';
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
import type { BillFileRecord } from '@/components/bills/types';

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';

type LineItem = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  unitLabel: string;
  accountLabel: string;
  accountNumber: string | null;
  accountType: string | null;
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

  const billRes = await db
    .from('transactions')
    .select(
      'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id, buildium_bill_id, transaction_type, org_id',
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
    db
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
      ? db
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

  const rawLines = Array.isArray(linesRes?.data)
    ? linesRes.data.filter((line) => String(line?.posting_type || '').toLowerCase() !== 'credit')
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
    const orgId = bill.org_id;
    const billIdForLink = bill.id ? String(bill.id) : null;

    if (orgId && billIdForLink) {
      const { data: filesData, error: filesError } = await db
        .from('files')
        .select('id, title, file_name, created_at, created_by, buildium_file_id, buildium_href')
        .eq('org_id', orgId)
        .ilike('storage_key', `bill/${billIdForLink}/%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Failed to load bill files', filesError);
      } else if (filesData?.length) {
        billFiles = filesData
          .map((file: any) => ({
            id: file.id,
            title: file.title || file.file_name || 'File',
            uploadedAt: file.created_at,
            uploadedBy: file.created_by || null,
            buildiumFileId: file.buildium_file_id || null,
            buildiumHref: file.buildium_href || null,
            buildiumSyncError: null,
          }))
          .filter((file: BillFileRecord) => file.uploadedAt)
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      }
    }
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
  const paidDateLabel = formatDate(bill.paid_date);

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
      const accountType = account?.type || null;
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
          accountNumber: accountNumber ? String(accountNumber) : null,
          accountType: accountType ? String(accountType) : null,
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
    { name: 'Pay to', value: vendorName || '—' },
    { name: 'Memo', value: bill.memo || 'Add a memo', multiline: true },
  ];

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-foreground text-2xl font-semibold">{vendorName}</span>
            {statusLabel ? (
              <Badge
                variant={statusToVariant(statusLabel)}
                className={cn(
                  'uppercase',
                  statusLabel === 'Overdue' && 'border-destructive/40 bg-destructive/10 text-destructive',
                  statusLabel === 'Due' && 'border-amber-300 bg-amber-50 text-amber-700',
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
        }
        description={`Bill ${formatCurrency(lineItemsInitialTotal || billAmount)} | Due: ${billDueLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/bills/${bill.id}/pay`}>Pay bill</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/bills/${bill.id}/edit`}>Enter charges</Link>
            </Button>
            <BillActionsMenu billId={bill.id} />
          </div>
        }
      />
      <PageBody>
        <div className="space-y-6">
          <Link
            href="/bills"
            className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-primary"
          >
            <span aria-hidden>←</span>
            Back to bills
          </Link>
          <PageColumns
            gap="xl"
            className="lg:grid-cols-[minmax(0,2fr)_minmax(480px,1.2fr)]"
            primaryClassName="min-w-0 space-y-6"
            secondaryClassName="space-y-6"
            primary={
              <>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>Bill details</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 py-6">
                    <dl className="grid gap-x-12 gap-y-6 text-sm md:grid-cols-3">
                      {detailEntries.map((entry) => (
                        <div key={entry.name} className="space-y-1.5">
                          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {entry.name}
                          </dt>
                          <dd
                            className={cn(
                              'text-foreground text-sm',
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

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-b">
                    <CardTitle>Item details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                      <Table className="min-w-[720px] text-sm">
                        <TableHeader>
                            <TableRow className="border-border/60 bg-muted/30 sticky top-0 z-10 border-b">
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
                        <TableBody className="divide-border/60 divide-y">
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
                              {debitLineItems.map((item, index) => (
                                <TableRow
                                  key={item.id}
                                  className={cn(
                                    'hover:bg-muted/20 transition-colors',
                                    index % 2 === 1 ? 'bg-muted/10' : undefined,
                                  )}
                                >
                                <TableCell className="text-foreground px-4 py-3">
                                  {item.propertyName}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  {item.unitLabel}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  <div className="font-medium">{item.accountLabel}</div>
                                  {(item.accountNumber || item.accountType) && (
                                    <div className="text-muted-foreground text-xs">
                                      {item.accountNumber ? `#${item.accountNumber}` : ''}
                                      {item.accountNumber && item.accountType ? ' • ' : ''}
                                      {item.accountType
                                        ? item.accountType.replace(/_/g, ' ').toLowerCase()
                                        : ''}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3 whitespace-pre-wrap">
                                  {item.description}
                                </TableCell>
                                <TableCell className="sticky right-0 px-4 py-3 text-right font-semibold backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                  {formatCurrency(item.initialAmount)}
                                </TableCell>
                                </TableRow>
                              ))}
                            </>
                          )}
                        </TableBody>
                        <TableFooter className="bg-background font-semibold">
                          <TableRow className="border-border/60 border-t">
                            <TableCell colSpan={4} className="text-foreground px-4 py-3">
                              Total
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {formatCurrency(lineItemsInitialTotal || billAmount)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                    <div className="border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase tracking-wide">Remaining</span>
                        <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase tracking-wide">Total</span>
                        <span className="font-semibold">
                          {formatCurrency(lineItemsInitialTotal || billAmount)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <BillFileAttachmentsCard
                  billId={bill.id}
                  uploaderName={vendorName}
                  initialFiles={billFiles}
                />
              </>
            }
            secondary={
              <>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>Bill amount</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 py-6">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                      Remaining
                    </div>
                    <div className="text-foreground text-2xl font-semibold">
                      {formatCurrency(remainingAmount)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>
                      Available credits <span className="text-muted-foreground text-xs">(i)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 py-6 text-sm">
                    <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                      <div className="text-foreground text-lg font-semibold">0.00</div>
                      <div className="text-muted-foreground text-xs">No vendor credits</div>
                    </div>
                    <Button type="button" variant="outline" size="sm">
                      Add a credit
                    </Button>
                  </CardContent>
                </Card>
              </>
            }
          />
        </div>
      </PageBody>
    </PageShell>
  );
}
