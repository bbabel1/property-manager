import { Fragment } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import DateRangeControls from '@/components/DateRangeControls';
import LedgerFilters from '@/components/financials/LedgerFilters';
import BillsFilters from '@/components/financials/BillsFilters';
import ClearFiltersButton from '@/components/financials/ClearFiltersButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowLink } from '@/components/ui/table-row-link';
import { Button } from '@/components/ui/button';
import BillRowActions from '@/components/financials/BillRowActions';
import { supabase, supabaseAdmin } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';
import RecordGeneralJournalEntryButton from '@/components/financials/RecordGeneralJournalEntryButton';

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';

const BILL_STATUS_OPTIONS: { slug: string; label: BillStatusLabel }[] = [
  { slug: 'overdue', label: 'Overdue' },
  { slug: 'due', label: 'Due' },
  { slug: 'partially-paid', label: 'Partially paid' },
  { slug: 'paid', label: 'Paid' },
  { slug: 'cancelled', label: 'Cancelled' },
];

const BILL_STATUS_SLUG_TO_LABEL = new Map(BILL_STATUS_OPTIONS.map((opt) => [opt.slug, opt.label]));

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
    case '':
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

const billDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});

const billCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBillDate(value?: string | null): string {
  if (!value) return '—';
  const isoLike = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '—';
  return billDateFormatter.format(date);
}

function formatBillCurrency(value?: number | null): string {
  const amount = Math.abs(Number(value ?? 0));
  if (!Number.isFinite(amount)) return billCurrencyFormatter.format(0);
  return billCurrencyFormatter.format(amount);
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

export default async function FinancialsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    from?: string;
    to?: string;
    unit?: string;
    gl?: string;
    range?: string;
  }>;
}) {
  const { id } = await params;
  const sp = (await (searchParams || Promise.resolve({}))) as any;

  const today = new Date();
  const hasRangeParam = typeof sp?.range === 'string';
  const hasExplicitDates = typeof sp?.from === 'string' || typeof sp?.to === 'string';

  const defaultTo = endOfMonth(today);
  const defaultFrom = startOfMonth(today);

  const to = sp?.to ? new Date(sp.to) : defaultTo;
  const from = sp?.from ? new Date(sp.from) : defaultFrom;
  const range = hasRangeParam ? sp.range : hasExplicitDates ? 'custom' : 'currentMonth';
  const db = supabaseAdmin || supabase;

  const unitsParam =
    typeof sp?.units === 'string' ? sp.units : typeof sp?.unit === 'string' ? sp.unit : '';
  const glParam = typeof sp?.gl === 'string' ? sp.gl : '';

  const propertyPromise = (db as any)
    .from('properties')
    .select('org_id, name')
    .eq('id', id)
    .maybeSingle();

  const unitsPromise = (db as any)
    .from('units')
    .select('id, unit_number, unit_name')
    .eq('property_id', id);

  const [{ data: propertyRow }, unitsResponse] = await Promise.all([propertyPromise, unitsPromise]);
  const orgId = propertyRow?.org_id ?? null;
  const propertyLabel = (propertyRow as { name?: string } | null)?.name || 'Property';
  const propertyOptions = [{ id, label: propertyLabel }];

  const accountsPromise = (async () => {
    let query = (db as any)
      .from('gl_accounts')
      .select('id, name, account_number, type')
      .order('type', { ascending: true })
      .order('name', { ascending: true });
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    return await query;
  })();

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  type Line = {
    date: string;
    amount: number;
    posting_type: string;
    memo: string | null;
    gl_account_id: string;
    ga_name: string;
    ga_number: string | null;
    ga_type: string | null;
    unit_label: string | null;
    transaction_type: string | null;
    transaction_memo: string | null;
    transaction_reference: string | null;
    created_at: string | null;
  };

  const qBase = () =>
    (db as any)
      .from('transaction_lines')
      .select(
        `date,
         amount,
         posting_type,
         memo,
         gl_account_id,
         created_at,
         gl_accounts(name, account_number, type),
         units(unit_number, unit_name),
         transactions(transaction_type, memo, reference_number)`,
      )
      .eq('property_id', id);

  const mapRow = (r: any): Line => ({
    date: r.date,
    amount: Number(r.amount || 0),
    posting_type: r.posting_type,
    memo: r.memo || null,
    gl_account_id: String(r.gl_account_id),
    ga_name: r.gl_accounts?.name || 'Unknown account',
    ga_number: r.gl_accounts?.account_number || null,
    ga_type: r.gl_accounts?.type || null,
    unit_label: r.units?.unit_number || r.units?.unit_name || null,
    transaction_type: r.transactions?.transaction_type || null,
    transaction_memo: r.transactions?.memo || null,
    transaction_reference: r.transactions?.reference_number || null,
    created_at: r.created_at || null,
  });

  interface UnitRecord {
    id: string;
    unit_number?: string;
    unit_name?: string;
  }
  interface AccountRecord {
    id: string;
    name: string;
    account_number?: string;
    type?: string;
  }

  const unitsData = (unitsResponse?.data ?? []) as UnitRecord[];
  const unitOptions: { id: string; label: string }[] = unitsData
    .map((u) => ({
      id: String(u.id),
      label: u.unit_number || u.unit_name || 'Unit',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const accountsResponse = await accountsPromise;
  const accountsData = (accountsResponse?.data ?? []) as AccountRecord[];
  const accountOptions = accountsData
    .map((acc) => ({
      value: String(acc.id),
      label: [acc.name, acc.account_number ? `(${acc.account_number})` : '']
        .filter(Boolean)
        .join(' '),
      group: acc.type || 'Other',
      groupLabel: acc.type ? `${acc.type} accounts` : 'Other accounts',
    }))
    .sort(
      (a, b) =>
        (a.group || 'Other').localeCompare(b.group || 'Other') || a.label.localeCompare(b.label),
    );

  const allUnitIds = unitOptions.map((opt) => opt.id);
  const noUnitsSelected = unitsParam === 'none';

  let selectedUnitIds: string[];
  if (noUnitsSelected) {
    selectedUnitIds = [];
  } else if (unitsParam) {
    selectedUnitIds = unitsParam
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => allUnitIds.includes(id));
  } else {
    selectedUnitIds = [...allUnitIds];
  }

  const unitFilterIds = noUnitsSelected
    ? []
    : selectedUnitIds.length === 0 || selectedUnitIds.length === allUnitIds.length
      ? null
      : selectedUnitIds;
  const modalDefaultUnitId =
    !noUnitsSelected && selectedUnitIds.length === 1 ? selectedUnitIds[0] : '';

  const allAccountIds = accountOptions.map((opt) => opt.value);
  let selectedAccountIds = glParam
    ? glParam
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => allAccountIds.includes(id))
    : [...allAccountIds];
  if (selectedAccountIds.length === 0) selectedAccountIds = [...allAccountIds];
  const accountFilterIds =
    selectedAccountIds.length === allAccountIds.length ? null : selectedAccountIds;

  let periodLines: Line[] = [];
  let priorLines: Line[] = [];

  if (!noUnitsSelected) {
    const periodPromise = (async () => {
      let query = qBase().gte('date', fromStr).lte('date', toStr);
      if (unitFilterIds) query = query.in('unit_id', unitFilterIds);
      if (accountFilterIds) query = query.in('gl_account_id', accountFilterIds);
      return await query;
    })();

    const priorPromise = (async () => {
      let query = qBase().lt('date', fromStr);
      if (unitFilterIds) query = query.in('unit_id', unitFilterIds);
      if (accountFilterIds) query = query.in('gl_account_id', accountFilterIds);
      return await query;
    })();

    const [{ data: periodData, error: periodError }, { data: priorData, error: priorError }] =
      await Promise.all([periodPromise, priorPromise]);

    periodLines = periodError ? [] : (periodData || []).map(mapRow);
    priorLines = priorError ? [] : (priorData || []).map(mapRow);
  }

  type Group = {
    id: string;
    name: string;
    number: string | null;
    type: string | null;
    prior: number;
    net: number;
    lines: { line: Line; signed: number }[];
  };

  const groupMap = new Map<string, Group>();
  const ensureGroup = (line: Line): Group => {
    const key = line.gl_account_id;
    const existing = groupMap.get(key);
    if (existing) return existing;
    const created: Group = {
      id: key,
      name: line.ga_name,
      number: line.ga_number,
      type: line.ga_type,
      prior: 0,
      net: 0,
      lines: [],
    };
    groupMap.set(key, created);
    return created;
  };

  const signedAmount = (line: Line) =>
    (line.posting_type || '').toLowerCase() === 'debit' ? line.amount : -line.amount;

  for (const line of priorLines) {
    const group = ensureGroup(line);
    group.prior += signedAmount(line);
  }

  for (const line of periodLines) {
    const group = ensureGroup(line);
    const signed = signedAmount(line);
    group.net += signed;
    group.lines.push({ line, signed });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const typeA = a.type || 'Other';
    const typeB = b.type || 'Other';
    const typeCmp = typeA.localeCompare(typeB);
    if (typeCmp !== 0) return typeCmp;
    return a.name.localeCompare(b.name);
  });

  const fmt = (n: number) =>
    `$${Number(Math.abs(n || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtSigned = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  const emptyStateMessage = noUnitsSelected
    ? 'Select at least one unit to view ledger activity.'
    : 'No activity for the selected period.';

  return (
    <div id="panel-financials" role="tabpanel" aria-labelledby="financials" className="space-y-6">
      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="border-border h-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="ledger"
            className="data-[state=active]:border-primary data-[state=active]:text-primary rounded-none border-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          >
            Ledger
          </TabsTrigger>
          <TabsTrigger
            value="bills"
            className="data-[state=active]:border-primary data-[state=active]:text-primary rounded-none border-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          >
            Bills
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ledger">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <LedgerFilters
              defaultUnitIds={selectedUnitIds}
              defaultGlIds={selectedAccountIds}
              unitOptions={unitOptions}
              accountOptions={accountOptions}
              noUnitsSelected={noUnitsSelected}
            />
            <DateRangeControls defaultFrom={from} defaultTo={to} defaultRange={range} />
            <ClearFiltersButton />
          </div>
          <div className="border-border border-t" />
          <div className="mt-4 flex justify-end">
            <RecordGeneralJournalEntryButton
              propertyOptions={propertyOptions}
              unitOptions={unitOptions}
              accountOptions={accountOptions}
              defaultPropertyId={id}
              defaultUnitId={modalDefaultUnitId}
            />
          </div>
          <div className="border-border mt-4 overflow-hidden rounded-lg border shadow-sm">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border border-b">
                  <TableHead className="text-muted-foreground w-[12rem]">
                    Date (cash basis)
                  </TableHead>
                  <TableHead className="text-muted-foreground w-[8rem]">Unit</TableHead>
                  <TableHead className="text-muted-foreground">Transaction</TableHead>
                  <TableHead className="text-muted-foreground">Memo</TableHead>
                  <TableHead className="text-muted-foreground w-[10rem] text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground w-[10rem] text-right">
                    Balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border divide-y">
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                      {emptyStateMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => {
                    const detail = group.lines.sort((a, b) => {
                      const dateCmp = a.line.date.localeCompare(b.line.date);
                      if (dateCmp !== 0) return dateCmp;
                      return (a.line.created_at || '').localeCompare(b.line.created_at || '');
                    });

                    let running = group.prior;

                    return (
                      <Fragment key={group.id}>
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={6} className="text-primary font-medium">
                            <span className="text-muted-foreground mr-2">—</span>
                            {group.name}
                            {group.number ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                {group.number}
                              </span>
                            ) : null}
                            {group.type ? (
                              <span className="text-muted-foreground ml-3 text-xs uppercase">
                                {group.type}
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-background">
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                          >
                            Prior balance
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right font-semibold">
                            {fmtSigned(group.prior)}
                          </TableCell>
                        </TableRow>
                        {detail.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-muted-foreground py-4 text-center text-sm"
                            >
                              No activity in selected period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.map(({ line, signed }, idx) => {
                            running += signed;
                            const txnLabel = [
                              line.transaction_type || 'Transaction',
                              line.transaction_reference ? `#${line.transaction_reference}` : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            const memo = line.memo || line.transaction_memo || '—';
                            return (
                              <TableRow key={`${group.id}-${line.date}-${idx}`}>
                                <TableCell>{dateFmt.format(new Date(line.date))}</TableCell>
                                <TableCell>{line.unit_label || '—'}</TableCell>
                                <TableCell>{txnLabel || '—'}</TableCell>
                                <TableCell>{memo}</TableCell>
                                <TableCell
                                  className={`text-right font-medium ${signed < 0 ? 'text-destructive' : ''}`}
                                >
                                  {fmtSigned(signed)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {fmtSigned(running)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={4} className="font-semibold">
                            Total {group.name}
                          </TableCell>
                          <TableCell className="text-foreground text-right font-semibold">
                            {fmtSigned(group.net)}
                          </TableCell>
                          <TableCell className="text-foreground text-right font-semibold">
                            {fmtSigned(group.prior + group.net)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="bills" className="space-y-6">
          {/* Bills Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button">Record bill</Button>
            <Button type="button" variant="outline">
              Pay bills
            </Button>
          </div>

          {await (async () => {
            // Units for bills reuse unitOptions
            const unitIdsAll = unitOptions.map((u) => u.id);

            // Vendors options
            let vendorsQuery = (db as any)
              .from('vendors')
              .select(
                'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
              )
              .order('updated_at', { ascending: false })
              .limit(200);
            if (orgId) vendorsQuery = vendorsQuery.eq('org_id', orgId);
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
            const vendorOptions = ((vendorsData || []) as VendorRecord[])
              .map((v) => ({ id: String(v.id), label: nameOfVendor(v) }))
              .sort((a, b) => a.label.localeCompare(b.label));

            const propertyIdsAll = propertyOptions.map((p) => p.id);
            const spProperties = typeof sp?.properties === 'string' ? sp.properties : '';
            let selectedPropertyIds = spProperties
              ? spProperties
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter((s: string) => propertyIdsAll.includes(s))
              : [...propertyIdsAll];
            if (selectedPropertyIds.length === 0) selectedPropertyIds = [...propertyIdsAll];

            // Parse filters
            const spVendors = typeof sp?.vendors === 'string' ? sp.vendors : '';
            const spStatusRaw = typeof sp?.bstatus === 'string' ? sp.bstatus : '';

            let selectedUnitIdsBills: string[];
            if (unitsParam === 'none') selectedUnitIdsBills = [];
            else if (unitsParam)
              selectedUnitIdsBills = unitsParam
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => unitIdsAll.includes(s));
            else selectedUnitIdsBills = [...unitIdsAll];

            const allVendorIds = vendorOptions.map((v) => v.id);
            let selectedVendorIds = spVendors
              ? spVendors
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter((s: string) => allVendorIds.includes(s))
              : [...allVendorIds];
            if (selectedVendorIds.length === 0) selectedVendorIds = [...allVendorIds];
            const statusParamSlugs = spStatusRaw
              ? spStatusRaw
                  .split(',')
                  .map((s: string) => s.trim().toLowerCase())
                  .filter((slug: string) => BILL_STATUS_SLUG_TO_LABEL.has(slug))
              : [];
            const defaultStatusSlugs = statusParamSlugs.length
              ? statusParamSlugs
              : ['overdue', 'due', 'partially-paid'];
            const selectedStatuses = defaultStatusSlugs
              .map((slug: string) => BILL_STATUS_SLUG_TO_LABEL.get(slug))
              .filter((label: BillStatusLabel | undefined): label is BillStatusLabel =>
                Boolean(label),
              );
            let resolvedStatusSlugs = defaultStatusSlugs;
            let resolvedStatusLabels = selectedStatuses;
            if (resolvedStatusLabels.length === 0) {
              resolvedStatusSlugs = BILL_STATUS_OPTIONS.map((opt) => opt.slug);
              resolvedStatusLabels = BILL_STATUS_OPTIONS.map(
                (opt: { label: BillStatusLabel }) => opt.label,
              );
            }
            const statusFilterSet = new Set(resolvedStatusLabels);
            const statusFilterActive =
              statusFilterSet.size > 0 && statusFilterSet.size !== BILL_STATUS_OPTIONS.length;

            const memoByTransactionId = new Map<string, string>();
            let billRows: any[] = [];
            if (selectedPropertyIds.includes(id)) {
              // Fetch matching transaction ids for this property (via lines)
              let qLine = (db as any)
                .from('transaction_lines')
                .select('transaction_id, unit_id, memo')
                .eq('property_id', id);
              if (
                selectedUnitIdsBills.length &&
                selectedUnitIdsBills.length !== unitIdsAll.length
              ) {
                qLine = qLine.in('unit_id', selectedUnitIdsBills);
              }
              const { data: linesData } = await qLine;
              const txIds = Array.from(
                new Set(
                  (linesData || [])
                    .map((r: any) => {
                      const txId = r?.transaction_id ? String(r.transaction_id) : null;
                      if (!txId) return null;
                      const memo = typeof r?.memo === 'string' ? r.memo.trim() : '';
                      if (memo && !memoByTransactionId.has(txId)) {
                        memoByTransactionId.set(txId, memo);
                      }
                      return txId;
                    })
                    .filter(Boolean),
                ),
              );

              if (txIds.length) {
                let qTx = (db as any)
                  .from('transactions')
                  .select(
                    'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id, transaction_type',
                  )
                  .in('id', txIds)
                  .eq('transaction_type', 'Bill')
                  .order('due_date', { ascending: true });

                if (selectedVendorIds.length && selectedVendorIds.length !== allVendorIds.length) {
                  qTx = qTx.in('vendor_id', selectedVendorIds);
                }

                const { data: txData } = await qTx;
                const statusUpdates: { id: string; status: BillStatusLabel }[] = [];
                const enrichedRows = (txData || []).map((row: any) => {
                  const current = normalizeBillStatus(row.status);
                  const derived = deriveBillStatusFromDates(current, row.due_date, row.paid_date);
                  if (derived !== current) {
                    statusUpdates.push({ id: row.id, status: derived });
                  }
                  return { ...row, status: derived };
                });

                if (statusUpdates.length) {
                  try {
                    await Promise.all(
                      statusUpdates.map((update) =>
                        (db as any)
                          .from('transactions')
                          .update({ status: update.status })
                          .eq('id', update.id),
                      ),
                    );
                  } catch (error) {
                    console.error('Failed to update bill transaction status', error);
                  }
                }

                billRows = enrichedRows.filter((row: any) => {
                  if (!statusFilterActive) return true;
                  return statusFilterSet.has(row.status as BillStatusLabel);
                });
              }
            }

            const vendorMap = new Map<string, string>();
            for (const v of vendorOptions) vendorMap.set(v.id, v.label);

            const vendorIdsReferenced = Array.from(
              new Set(
                billRows
                  .map((row) => (row.vendor_id ? String(row.vendor_id) : null))
                  .filter((value): value is string => Boolean(value)),
              ),
            );
            const vendorIdsMissing = vendorIdsReferenced.filter(
              (vendorId) => !vendorMap.has(vendorId),
            );
            if (vendorIdsMissing.length) {
              const { data: extraVendors } = await (db as any)
                .from('vendors')
                .select('id, contacts(display_name, company_name, first_name, last_name)')
                .in('id', vendorIdsMissing);
              for (const vendor of extraVendors || []) {
                const vendorId = vendor?.id ? String(vendor.id) : null;
                if (!vendorId) continue;
                const contact =
                  typeof vendor?.contacts === 'object' && vendor.contacts
                    ? (vendor.contacts as {
                        display_name?: string | null;
                        company_name?: string | null;
                        first_name?: string | null;
                        last_name?: string | null;
                      })
                    : null;
                const fallbackLabel =
                  contact?.display_name ||
                  contact?.company_name ||
                  [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
                  'Vendor';
                vendorMap.set(vendorId, fallbackLabel);
              }
            }

            const countLabel = `${billRows.length} match${billRows.length === 1 ? '' : 'es'}`;

            // Render
            return (
              <div className="space-y-4">
                <div className="mb-2 flex flex-wrap items-end gap-4">
                  <BillsFilters
                    defaultPropertyIds={selectedPropertyIds}
                    defaultUnitIds={selectedUnitIdsBills}
                    defaultVendorIds={selectedVendorIds}
                    defaultStatuses={resolvedStatusSlugs}
                    propertyOptions={propertyOptions}
                    unitOptions={unitOptions}
                    vendorOptions={vendorOptions}
                    showPropertyFilter={false}
                  />
                  <div className="text-muted-foreground ml-auto pb-2 text-sm">{countLabel}</div>
                </div>
                <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow className="border-border border-b">
                        <TableHead className="text-muted-foreground w-[12rem]">Due date</TableHead>
                        <TableHead className="text-muted-foreground w-[10rem]">Status</TableHead>
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
                      {billRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                            We didn't find any bills. Maybe you don't have any or maybe you need to
                            clear your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        billRows.map((row) => (
                          <TableRowLink key={row.id} href={`/bills/${row.id}`}>
                            <TableCell>{formatBillDate(row.due_date)}</TableCell>
                            <TableCell className="text-foreground">
                              {row.status ? (
                                <Badge
                                  variant={statusVariant(row.status)}
                                  className={cn(
                                    'uppercase',
                                    row.status === 'Overdue' &&
                                      'bg-destructive/10 text-destructive',
                                  )}
                                >
                                  {row.status}
                                </Badge>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {vendorMap.get(String(row.vendor_id)) || '—'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {row.memo?.trim()
                                ? row.memo
                                : memoByTransactionId.get(String(row.id)) || '—'}
                            </TableCell>
                            <TableCell>{row.reference_number || '—'}</TableCell>
                            <TableCell className="text-right">
                              {formatBillCurrency(row.total_amount)}
                            </TableCell>
                              <TableCell className="text-right" data-row-link-ignore="true">
                              <BillRowActions billId={String(row.id)} />
                            </TableCell>
                          </TableRowLink>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
