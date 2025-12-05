import Link from 'next/link';

import BillsFilters from '@/components/financials/BillsFilters';
import BillRowActions from '@/components/financials/BillRowActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowLink } from '@/components/ui/table-row-link';
import { cn } from '@/components/ui/utils';
import { supabase, supabaseAdmin } from '@/lib/db';
import BillsTabSwitcher from '@/components/financials/BillsTabSwitcher';
import { Card, CardContent } from '@/components/ui/card';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';

type Option = { id: string; label: string };
type SearchParams = {
  properties?: string;
  units?: string;
  vendors?: string;
  bstatus?: string;
  tab?: string;
};

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';

const BILL_STATUS_OPTIONS: { slug: string; label: BillStatusLabel }[] = [
  { slug: 'overdue', label: 'Overdue' },
  { slug: 'due', label: 'Due' },
  { slug: 'partially-paid', label: 'Partially paid' },
  { slug: 'paid', label: 'Paid' },
  { slug: 'cancelled', label: 'Cancelled' },
];

const BILL_STATUS_SLUG_TO_LABEL = new Map(BILL_STATUS_OPTIONS.map((opt) => [opt.slug, opt.label]));

type BillRowRecord = {
  id: string;
  status: BillStatusLabel;
  due_date?: string | null;
  paid_date?: string | null;
  total_amount?: number | string | null;
  memo?: string | null;
  reference_number?: string | null;
  vendor_id?: string | null;
  property_id?: string | null;
  [key: string]: unknown;
};

function normalizeBillStatus(value: any): BillStatusLabel {
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
  if (
    currentStatus === 'Cancelled' ||
    currentStatus === 'Partially paid' ||
    currentStatus === 'Paid'
  ) {
    return currentStatus;
  }
  if (paidDateIso) return 'Paid';
  if (dueDateIso) {
    const due = new Date(`${dueDateIso}T00:00:00Z`);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      const todayStart = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      if (due < todayStart) {
        return 'Overdue';
      }
    }
  }
  return 'Due';
}

function statusVariant(status: BillStatusLabel) {
  switch (status) {
    case 'Paid':
      return 'secondary' as const;
    case 'Overdue':
      return 'destructive' as const;
    case 'Partially paid':
      return 'default' as const;
    case 'Cancelled':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  } catch {
    return '—';
  }
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(amount?: number | null) {
  if (amount == null || Number.isNaN(Number(amount))) return currencyFormatter.format(0);
  return currencyFormatter.format(Number(amount));
}

export default async function BillsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const db = supabaseAdmin || supabase;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | undefined>;

  const tabParam = typeof sp?.tab === 'string' ? sp.tab : undefined;
  const currentTab = tabParam === 'paid' ? 'paid' : 'unpaid';

  const propertiesResponse = await (db as any)
    .from('properties')
    .select('id, name')
    .order('name', { ascending: true });

  const propertyOptions: Option[] = (
    (propertiesResponse?.data ?? []) as Array<{ id: string; name?: string }>
  )
    .map((property) => ({ id: String(property.id), label: property.name || 'Property' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const propertyLabelMap = new Map(propertyOptions.map((opt) => [opt.id, opt.label]));
  const allPropertyIds = propertyOptions.map((opt) => opt.id);

  const spProperties = typeof sp?.properties === 'string' ? sp.properties : '';
  let selectedPropertyIds = spProperties
    ? spProperties
        .split(',')
        .map((value) => value.trim())
        .filter((value) => allPropertyIds.includes(value))
    : [...allPropertyIds];
  if (!selectedPropertyIds.length && allPropertyIds.length) {
    selectedPropertyIds = [...allPropertyIds];
  }

  let unitsData: Array<{
    id: string;
    unit_number?: string | null;
    unit_name?: string | null;
    property_id?: string | null;
  }> = [];
  if (allPropertyIds.length) {
    let unitsQuery = (db as any).from('units').select('id, unit_number, unit_name, property_id');
    if (selectedPropertyIds.length && selectedPropertyIds.length !== allPropertyIds.length) {
      unitsQuery = unitsQuery.in('property_id', selectedPropertyIds);
    }
    const { data: unitsResponse } = await unitsQuery;
    unitsData = (unitsResponse || []) as typeof unitsData;
  }

  const unitOptions: Option[] = unitsData
    .map((unit) => ({
      id: String(unit.id),
      label: unit.unit_number || unit.unit_name || 'Unit',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const allUnitIds = unitOptions.map((opt) => opt.id);

  const unitsParam = typeof sp?.units === 'string' ? sp.units : '';
  const noUnitsSelected = unitsParam === 'none';
  let selectedUnitIds: string[];
  if (noUnitsSelected) {
    selectedUnitIds = [];
  } else if (unitsParam) {
    selectedUnitIds = unitsParam
      .split(',')
      .map((value) => value.trim())
      .filter((value) => allUnitIds.includes(value));
  } else {
    selectedUnitIds = [...allUnitIds];
  }

  const propertyFilterIds =
    !selectedPropertyIds.length || selectedPropertyIds.length === allPropertyIds.length
      ? null
      : selectedPropertyIds;
  const unitFilterIds =
    noUnitsSelected || !selectedUnitIds.length || selectedUnitIds.length === allUnitIds.length
      ? null
      : selectedUnitIds;

  const vendorsQuery = (db as any)
    .from('vendors')
    .select(
      'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  const { data: vendorsData } = await vendorsQuery;
  interface VendorRecord {
    id: string;
    contact?: {
      display_name?: string;
      company_name?: string;
      first_name?: string;
      last_name?: string;
    };
  }
  const nameOfVendor = (v: VendorRecord) =>
    v?.contact?.display_name ||
    v?.contact?.company_name ||
    [v?.contact?.first_name, v?.contact?.last_name].filter(Boolean).join(' ') ||
    'Vendor';
  const vendorOptions: Option[] = ((vendorsData || []) as VendorRecord[])
    .map((v) => ({ id: String(v.id), label: nameOfVendor(v) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const allVendorIds = vendorOptions.map((v) => v.id);

  const spVendors = typeof sp?.vendors === 'string' ? sp.vendors : '';
  const spStatusRaw = typeof sp?.bstatus === 'string' ? sp.bstatus : '';

  let selectedVendorIds = spVendors
    ? spVendors
        .split(',')
        .map((value) => value.trim())
        .filter((value) => allVendorIds.includes(value))
    : [...allVendorIds];
  if (!selectedVendorIds.length) selectedVendorIds = [...allVendorIds];

  const statusParamSlugs = spStatusRaw
    ? spStatusRaw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((slug) => BILL_STATUS_SLUG_TO_LABEL.has(slug))
    : [];

  const unpaidDefaultStatusSlugs = BILL_STATUS_OPTIONS.filter((opt) => opt.slug !== 'paid').map(
    (opt) => opt.slug,
  );
  const paidDefaultStatusSlugs = ['paid'] as const;

  const explicitStatusLabels = statusParamSlugs
    .map((slug) => BILL_STATUS_SLUG_TO_LABEL.get(slug))
    .filter((label): label is BillStatusLabel => Boolean(label));
  const explicitStatusFilterSet = new Set(explicitStatusLabels);
  const hasExplicitStatusFilters = explicitStatusFilterSet.size > 0;

  const defaultStatusSlugsForFilters = statusParamSlugs.length
    ? statusParamSlugs
    : currentTab === 'paid'
      ? [...paidDefaultStatusSlugs]
      : unpaidDefaultStatusSlugs;

  const propertyByTransaction = new Map<string, string>();
  const amountByTransaction = new Map<string, number>();
  const transactionIds: string[] = [];

  if (selectedPropertyIds.length) {
    let qLine = (db as any)
      .from('transaction_lines')
      .select('transaction_id, property_id, unit_id, amount, posting_type');
    if (propertyFilterIds) qLine = qLine.in('property_id', propertyFilterIds);
    if (unitFilterIds) qLine = qLine.in('unit_id', unitFilterIds);

    const { data: linesData } = await qLine;
    const txIdSet = new Set<string>();
    for (const line of linesData || []) {
      const txId = line?.transaction_id ? String(line.transaction_id) : null;
      if (!txId) continue;
      txIdSet.add(txId);
      if (line?.property_id != null && !propertyByTransaction.has(txId)) {
        propertyByTransaction.set(txId, String(line.property_id));
      }
      const postingType = String(line?.posting_type || '').toLowerCase();
      if (postingType === 'credit') continue;
      const rawAmount = Number(line?.amount ?? 0);
      if (!Number.isFinite(rawAmount)) continue;
      const amount = Math.abs(rawAmount);
      amountByTransaction.set(txId, (amountByTransaction.get(txId) ?? 0) + amount);
    }
    transactionIds.push(...txIdSet);
  }

  const statusUpdates: { id: string; status: BillStatusLabel }[] = [];
  let rowsWithProperties: BillRowRecord[] = [];

  if (transactionIds.length) {
    let qTx = (db as any)
      .from('transactions')
      .select(
        'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id, transaction_type',
      )
      .in('id', transactionIds)
      .eq('transaction_type', 'Bill')
      .order('due_date', { ascending: true });

    if (selectedVendorIds.length && selectedVendorIds.length !== allVendorIds.length) {
      qTx = qTx.in('vendor_id', selectedVendorIds);
    }

    const { data: txData } = await qTx;
    const enrichedRows = (txData || []).map((row: any) => {
      const current = normalizeBillStatus(row.status);
      const derived = deriveBillStatusFromDates(current, row.due_date, row.paid_date);
      if (derived !== current) {
        statusUpdates.push({ id: row.id, status: derived });
      }
      const txId = String(row.id);
      const storedAmount = Number(row.total_amount);
      const hasStoredAmount = Number.isFinite(storedAmount) && storedAmount > 0;
      const computedAmount = amountByTransaction.get(txId);
      const finalAmount = hasStoredAmount
        ? storedAmount
        : Number.isFinite(computedAmount) && computedAmount !== undefined
          ? computedAmount
          : 0;
      return { ...row, status: derived, total_amount: finalAmount } as BillRowRecord;
    });

    if (statusUpdates.length) {
      try {
        await Promise.all(
          statusUpdates.map((update) =>
            (db as any).from('transactions').update({ status: update.status }).eq('id', update.id),
          ),
        );
      } catch (error) {
        console.error('Failed to update bill transaction status', error);
      }
    }

    rowsWithProperties = enrichedRows.map((row: BillRowRecord) => {
      const txId = String(row.id);
      return {
        ...row,
        property_id: propertyByTransaction.get(txId) || null,
        total_amount:
          row.total_amount ??
          amountByTransaction.get(txId) ??
          0,
      };
    });
  }

  const filteredRows = hasExplicitStatusFilters
    ? rowsWithProperties.filter((row) => explicitStatusFilterSet.has(row.status))
    : rowsWithProperties;

  const unpaidRows = filteredRows.filter((row) => row.status !== 'Paid');
  const paidRows = filteredRows.filter((row) => row.status === 'Paid');

  const vendorMap = new Map<string, string>();
  for (const vendor of vendorOptions) vendorMap.set(vendor.id, vendor.label);

  const renderTabPanel = (rows: BillRowRecord[]) => (
    <div className="space-y-6">
      <Card className="border-border/70 border shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-4 p-6 pb-4">
            <BillsFilters
              defaultPropertyIds={selectedPropertyIds}
              defaultUnitIds={selectedUnitIds}
              defaultVendorIds={selectedVendorIds}
              defaultStatuses={defaultStatusSlugsForFilters}
              propertyOptions={propertyOptions}
              unitOptions={unitOptions}
              vendorOptions={vendorOptions}
            />
          </div>

          <div className="border-border/70 border-t">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border border-b">
                  <TableHead className="text-muted-foreground w-[12rem]">Due date</TableHead>
                  <TableHead className="text-muted-foreground w-[16rem]">Property</TableHead>
                  <TableHead className="text-muted-foreground w-[16rem]">Vendors</TableHead>
                  <TableHead className="text-muted-foreground">Memo</TableHead>
                  <TableHead className="text-muted-foreground w-[10rem]">Ref No.</TableHead>
                  <TableHead className="text-muted-foreground w-[10rem] text-right">
                    Amount
                  </TableHead>
                  <TableHead className="w-[3rem]" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border divide-y">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                      We didn't find any bills. Maybe you don't have any or maybe you need to clear
                      your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const propertyName = row.property_id
                      ? propertyLabelMap.get(String(row.property_id)) || '—'
                      : '—';
                    const rowKey =
                      row.id ?? row.reference_number ?? `${row.property_id ?? 'row'}-${index}`;
                    return (
                      <TableRowLink key={rowKey} href={`/bills/${row.id}`}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span>{row.due_date ? formatDate(row.due_date) : '—'}</span>
                            {row.status ? (
                              <Badge
                                variant={statusVariant(row.status)}
                                className={cn(
                                  'uppercase',
                                  row.status === 'Overdue' &&
                                    'border-destructive/40 bg-destructive/10 text-destructive',
                                  row.status === 'Due' && 'border-amber-300 bg-amber-50 text-amber-700',
                                )}
                              >
                                {row.status}
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground">{propertyName}</TableCell>
                        <TableCell className="text-foreground">
                          {vendorMap.get(String(row.vendor_id)) || '—'}
                        </TableCell>
                        <TableCell className="text-foreground">{row.memo || '—'}</TableCell>
                        <TableCell>{row.reference_number || '—'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            Number.isFinite(Number(row.total_amount))
                              ? Number(row.total_amount)
                              : 0,
                          )}
                        </TableCell>
                        <TableCell className="text-right" data-row-link-ignore="true">
                          <BillRowActions billId={String(row.id)} />
                        </TableCell>
                      </TableRowLink>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="Bills"
        description="Monitor vendor bills and track outstanding balances."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" asChild>
              <Link href="/bills/new">Record bill</Link>
            </Button>
            <Button type="button" size="sm" variant="outline">
              Pay bills
            </Button>
          </div>
        }
      />
      <PageBody>
        <BillsTabSwitcher
          className="space-y-6"
          initialTab={currentTab}
          unpaidDefaults={unpaidDefaultStatusSlugs}
          paidDefaults={Array.from(paidDefaultStatusSlugs)}
          unpaidContent={renderTabPanel(unpaidRows)}
          paidContent={renderTabPanel(paidRows)}
        />
      </PageBody>
    </PageShell>
  );
}
