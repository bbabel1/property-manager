import { notFound } from 'next/navigation';

import ActionButton from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import { supabase, supabaseAdmin } from '@/lib/db';

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';

type LineItem = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  unitLabel: string;
  accountLabel: string;
  description: string;
  amount: number;
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
         gl_accounts(name, account_number),
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

  const rawLines: any[] = Array.isArray(linesRes?.data) ? linesRes.data : [];
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

  const billAmount = Number(bill.total_amount ?? 0) || 0;
  const billDateLabel = formatDate(bill.date);
  const billDueLabel = formatDate(bill.due_date);
  const statusNormalized = normalizeBillStatus(bill.status);
  const statusLabel = deriveBillStatusFromDates(
    statusNormalized,
    bill.due_date ?? null,
    bill.paid_date ?? null,
  );
  const remainingAmount = statusLabel === 'Paid' ? 0 : billAmount;

  const detailEntries: DetailEntry[] = [
    { name: 'Date', value: billDateLabel },
    { name: 'Due', value: billDueLabel },
    { name: 'Reference number', value: bill.reference_number || '—' },
    { name: 'Work order', value: '—' },
    { name: 'Memo', value: bill.memo || '—', multiline: true },
    { name: 'Pay to', value: vendorName || '—' },
  ];

  const debitLineItems: LineItem[] = rawLines
    .filter((line) => String(line?.posting_type ?? '').toLowerCase() !== 'credit')
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
      const accountName =
        line?.gl_accounts && typeof line.gl_accounts === 'object'
          ? (line.gl_accounts as { name?: string | null }).name
          : null;
      const accountNumber =
        line?.gl_accounts && typeof line.gl_accounts === 'object'
          ? (line.gl_accounts as { account_number?: string | number | null }).account_number
          : null;

      return {
        id: line?.id ? String(line.id) : `${bill.id}-line-${index}`,
        propertyId: line?.property_id ? String(line.property_id) : null,
        propertyName,
        unitLabel: unitNumber ? String(unitNumber) : 'Property level',
        accountLabel: accountNumber
          ? `${accountNumber} · ${accountName || 'Account'}`
          : accountName || 'Account',
        description: line?.memo || bill.memo || '—',
        amount: Math.abs(Number(line?.amount ?? 0)) || 0,
      } satisfies LineItem;
    });

  const lineItemsTotal = debitLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const headerMetaParts = [`Bill ${formatCurrency(billAmount)}`, `Due: ${billDueLabel}`];
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
            <Button type="button" variant="link" size="sm" className="px-0 text-sm font-medium">
              Edit
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Pay bill</Button>
          <Button size="sm" variant="outline">
            Enter charges
          </Button>
          <Button size="sm" variant="outline">
            Request owner contribution
          </Button>
          <Button size="sm" variant="outline">
            Duplicate bill
          </Button>
          <ActionButton type="button" className="border-border border" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border flex items-center border-b px-4 !pt-4 !pb-4">
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
            <CardHeader className="border-border flex items-center justify-between border-b px-4 !pt-4 !pb-4">
              <CardTitle>Approval</CardTitle>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="!h-auto !min-h-0 px-0 !py-0 text-sm font-medium"
              >
                Add approval
              </Button>
            </CardHeader>
            <CardContent className="text-muted-foreground px-6 py-8 text-sm">
              This bill does not have a recorded approval.
            </CardContent>
          </Card>

          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border flex items-center justify-between border-b px-4 !pt-4 !pb-4">
              <CardTitle>Item details</CardTitle>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-muted-foreground hover:text-foreground !h-auto !min-h-0 px-0 !py-0 text-sm font-medium"
              >
                Collapse item details
              </Button>
            </CardHeader>
            <CardContent className="px-0 pt-6 pb-0">
              <div className="px-6 pb-6">
                <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/60">
                      <TableRow className="border-border border-b">
                        <TableHead className="text-muted-foreground w-[18rem]">
                          Property or company
                        </TableHead>
                        <TableHead className="text-muted-foreground w-[12rem]">Unit</TableHead>
                        <TableHead className="text-muted-foreground w-[18rem]">Account</TableHead>
                        <TableHead className="text-muted-foreground">Description</TableHead>
                        <TableHead className="text-muted-foreground w-[10rem] text-right">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-border divide-y">
                      {debitLineItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground py-6 text-center text-sm"
                          >
                            No itemized charges recorded for this bill.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {debitLineItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-foreground">{item.propertyName}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {item.unitLabel}
                              </TableCell>
                              <TableCell className="text-foreground">{item.accountLabel}</TableCell>
                              <TableCell className="text-foreground whitespace-pre-wrap">
                                {item.description}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30">
                            <TableCell
                              colSpan={4}
                              className="text-muted-foreground text-right text-xs font-semibold tracking-wide uppercase"
                            >
                              Total
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(lineItemsTotal || billAmount)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>File attachments</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground flex flex-col items-center justify-center gap-4 px-6 py-10 text-center text-sm">
              <div className="text-foreground text-base font-medium">No files yet</div>
              <p className="max-w-sm">Upload and view your attachments here.</p>
              <Button type="button" variant="outline" size="sm">
                Add files
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>Bill amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-6 py-6">
              <div className="text-muted-foreground flex items-center justify-between text-sm">
                <span>Total</span>
                <span className="text-foreground font-medium">{formatCurrency(billAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Remaining</span>
                <span className="text-foreground text-2xl font-semibold">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border border shadow-sm">
            <CardHeader className="border-border flex items-center border-b px-4 !pt-4 !pb-4">
              <CardTitle>Available credits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="border-border bg-muted/40 rounded-lg border border-dashed p-4 text-center">
                <div className="text-foreground text-2xl font-semibold">0.00</div>
                <div className="text-muted-foreground text-xs">No vendor credits</div>
              </div>
              <Button type="button" variant="outline" size="sm">
                Add a credit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
