export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Fragment } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import BillRowActions from '@/components/financials/BillRowActions';
import AddLink from '@/components/ui/AddLink';
import { PropertyService } from '@/lib/property-service';
import { supabase as supaClient, supabaseAdmin } from '@/lib/db';
import { rollupFinances, signedAmountFromTransaction } from '@/lib/finance/model';
import UnitDetailsCard from '@/components/unit/UnitDetailsCard';
import UnitFinancialServicesCard from '@/components/unit/UnitFinancialServicesCard';
import UnitServicesTab from '@/components/unit/UnitServicesTab';
import LeaseSection from '@/components/units/LeaseSection';
import UnitBillsFilters from '@/components/unit/UnitBillsFilters';
import CreateMonthlyLogButton from '@/components/monthly-logs/CreateMonthlyLogButton';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import {
  MONTHLY_LOG_STAGES,
  MONTHLY_LOG_STATUSES,
  type MonthlyLogStage,
  type MonthlyLogStatus,
} from '@/components/monthly-logs/types';
import type { Tables } from '@/types/database';
import { logDebug } from '@/shared/lib/logger';
import { buildLedgerGroups, mapTransactionLine, type LedgerLine } from '@/server/financials/ledger-utils';

type UnitSubNavKey = 'details' | 'services' | 'ledger' | 'bills' | 'monthly_logs';
type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';
type MonthlyLogListRow = {
  id: string;
  periodStart: string;
  status: MonthlyLogStatus;
  stage: MonthlyLogStage;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatSignedCurrency = (value: number) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return currencyFormatter.format(0);
  const formatted = currencyFormatter.format(Math.abs(amount));
  return amount < 0 ? `(${formatted})` : formatted;
};

const formatDateString = (value?: string | null) => {
  if (!value) return '—';
  const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '—';
  return shortDateFormatter.format(date);
};

const formatPeriodStartLabel = (value?: string | null) => {
  if (!value) return '—';
  const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '—';
  return monthLabelFormatter.format(date);
};

const normalizeMonthlyLogStage = (value: unknown): MonthlyLogStage => {
  const normalized = String(value ?? '').toLowerCase();
  return MONTHLY_LOG_STAGES.includes(normalized as MonthlyLogStage)
    ? (normalized as MonthlyLogStage)
    : 'charges';
};

const normalizeMonthlyLogStatus = (value: unknown): MonthlyLogStatus => {
  const normalized = String(value ?? '').toLowerCase();
  return MONTHLY_LOG_STATUSES.includes(normalized as MonthlyLogStatus)
    ? (normalized as MonthlyLogStatus)
    : 'pending';
};

const monthlyLogStageLabels: Record<MonthlyLogStage, string> = {
  charges: 'Charges',
  payments: 'Payments',
  bills: 'Bills',
  escrow: 'Escrow',
  management_fees: 'Management fees',
  owner_statements: 'Owner statements',
  owner_distributions: 'Owner distributions',
};

const monthlyLogStatusLabels: Record<MonthlyLogStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
};

const monthlyLogStatusVariant = (status: MonthlyLogStatus): 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'complete':
      return 'secondary';
    case 'in_progress':
      return 'default';
    case 'pending':
    default:
      return 'outline';
  }
};

const normalizeBillStatus = (value: unknown): BillStatusLabel => {
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
};

const deriveBillStatusFromDates = (
  currentStatus: BillStatusLabel,
  dueDateIso: string | null,
  paidDateIso: string | null,
): BillStatusLabel => {
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
      if (due < todayUtc) return 'Overdue';
    }
  }

  return 'Due';
};

const statusToVariant = (
  status: BillStatusLabel,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Paid':
      return 'secondary';
    case 'Partially paid':
      return 'outline';
    case 'Overdue':
      return 'destructive';
    case 'Due':
      return 'default';
    case 'Cancelled':
      return 'outline';
    default:
      return 'outline';
  }
};

type BillStatusSlug = 'overdue' | 'due' | 'partially-paid' | 'paid' | 'cancelled';

const statusSlugToLabel: Record<BillStatusSlug, BillStatusLabel> = {
  overdue: 'Overdue',
  due: 'Due',
  'partially-paid': 'Partially paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const isBillStatusSlug = (value: string): value is BillStatusSlug =>
  value === 'overdue' ||
  value === 'due' ||
  value === 'partially-paid' ||
  value === 'paid' ||
  value === 'cancelled';

type UnitRecord = Pick<
  Tables<'units'>,
  | 'id'
  | 'org_id'
  | 'unit_number'
  | 'unit_name'
  | 'balance'
  | 'deposits_held_balance'
  | 'prepayments_balance'
>;
type PropertyRecord = Pick<Tables<'properties'>, 'id' | 'org_id' | 'name' | 'status' | 'reserve'> & {
  units?: UnitRecord[] | null;
};
type LeaseRow = Pick<
  Tables<'lease'>,
  | 'id'
  | 'lease_from_date'
  | 'lease_to_date'
  | 'status'
  | 'rent_amount'
  | 'buildium_lease_id'
>;
type LeaseContactRow = {
  lease_id: number | string;
  tenants: {
    contact: Pick<
      Tables<'contacts'>,
      'display_name' | 'first_name' | 'last_name' | 'company_name' | 'is_company'
    > | null;
  } | null;
};
type ApplianceRow = Pick<Tables<'appliances'>, 'id' | 'name' | 'type' | 'installation_date'>;
type TransactionLineRow = Pick<
  Tables<'transaction_lines'>,
  | 'id'
  | 'transaction_id'
  | 'memo'
  | 'amount'
  | 'posting_type'
  | 'gl_account_id'
  | 'date'
  | 'created_at'
  | 'property_id'
  | 'unit_id'
  | 'lease_id'
  | 'buildium_lease_id'
> & {
  gl_accounts?: Pick<
    Tables<'gl_accounts'>,
    | 'name'
    | 'type'
    | 'sub_type'
    | 'account_number'
    | 'is_bank_account'
    | 'is_security_deposit_liability'
    | 'exclude_from_cash_balances'
  > | null;
  units?: Pick<Tables<'units'>, 'unit_number' | 'unit_name'> | null;
  transactions?: Pick<
    Tables<'transactions'>,
    'id' | 'transaction_type' | 'memo' | 'reference_number'
  > | null;
};
type TransactionRow = Pick<
  Tables<'transactions'>,
  | 'id'
  | 'date'
  | 'due_date'
  | 'paid_date'
  | 'total_amount'
  | 'memo'
  | 'transaction_type'
  | 'buildium_transaction_id'
  | 'buildium_lease_id'
  | 'lease_id'
  | 'status'
  | 'reference_number'
  | 'vendor_id'
>;
type VendorRow = {
  id: string;
  contact: Pick<Tables<'contacts'>, 'display_name' | 'company_name' | 'first_name' | 'last_name'> | null;
};

export default async function UnitDetailsNested({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams?: Promise<{ tab?: string; billsView?: string; vendors?: string; bstatus?: string }>;
}) {
  const { id: propertySlug, unitId } = await params;
  const { internalId: propertyId, publicId: propertyPublicId } = await resolvePropertyIdentifier(propertySlug);
  const sp = searchParams ? await searchParams : undefined;
  const normalizedTab = typeof sp?.tab === 'string' ? sp.tab.toLowerCase() : undefined;
  const normalizedBillsView =
    typeof sp?.billsView === 'string' ? sp.billsView.toLowerCase() : undefined;
  const activeBillsView: 'unpaid' | 'paid' = normalizedBillsView === 'paid' ? 'paid' : 'unpaid';
  const parseListParam = (raw?: string) =>
    typeof raw === 'string'
      ? raw
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  const vendorFilterParam = parseListParam(sp?.vendors);
  const statusFilterParam = parseListParam(sp?.bstatus).map((entry) => entry.toLowerCase());
  const subNavItems: { key: UnitSubNavKey; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'services', label: 'Services' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'bills', label: 'Bills' },
    { key: 'monthly_logs', label: 'Monthly Logs' },
  ];
  const activeTab: UnitSubNavKey =
    normalizedTab && subNavItems.some((item) => item.key === normalizedTab)
      ? (normalizedTab as UnitSubNavKey)
      : 'details';
  const basePath = `/properties/${propertyPublicId}/units/${unitId}`;
  const searchParamEntries: [string, string][] = [];
  if (sp) {
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === 'string') {
        searchParamEntries.push([key, value]);
      }
    }
  }
  const buildBillsViewHref = (view: 'unpaid' | 'paid') => {
    const params = new URLSearchParams(searchParamEntries);
    params.set('tab', 'bills');
    if (view === 'paid') {
      params.set('billsView', 'paid');
      params.set('bstatus', 'paid');
    } else {
      params.delete('billsView');
      params.delete('bstatus');
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Fetch property shell + units (server-side, cached by PropertyService)
  const property = (await PropertyService.getPropertyById(propertyId)) as
    | (PropertyRecord & { units?: UnitRecord[] | null })
    | null;

  // Try to find unit from property details; fallback to API
  const units = property?.units ?? [];
  let unit = units.find((u) => String(u?.id ?? '') === String(unitId));
  if (!unit) {
    try {
      const res = await fetch(`/api/units/${unitId}`, { cache: 'no-store' });
      if (res.ok) unit = (await res.json()) as UnitRecord;
    } catch {}
  }

  const propertyIdString = property?.id != null ? String(property.id) : '';
  const unitIdString = unit?.id != null ? String(unit.id) : '';
  const orgIdString =
    property?.org_id != null ? String(property.org_id) : unit?.org_id != null ? String(unit.org_id) : '';

  // Load live leases and join tenant names (local DB)
  const db = supabaseAdmin || supaClient;
  let leases: LeaseRow[] = [];
  const tenantNamesByLease: Record<string, string[]> = {};
  if (unit?.id) {
    try {
      const { data: leaseRows } = await db
        .from('lease')
        .select(
          'id, lease_from_date, lease_to_date, status, rent_amount, buildium_lease_id',
        )
        .eq('unit_id', unit.id)
        .order('lease_from_date', { ascending: false });
      leases = Array.isArray(leaseRows) ? (leaseRows as LeaseRow[]) : [];
      const ids = leases.map((l) => l.id);
      if (ids.length) {
        const { data: lcs } = await db
          .from('lease_contacts')
          .select(
            'lease_id, tenants( id, contact:contacts(display_name, first_name, last_name, company_name, is_company) )',
          )
          .in('lease_id', ids);
        if (Array.isArray(lcs)) {
          for (const row of lcs as LeaseContactRow[]) {
            const contact = row?.tenants?.contact;
            const name =
              contact?.display_name ||
              contact?.company_name ||
              [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
              'Tenant';
            const key = String(row.lease_id);
            tenantNamesByLease[key] = [...(tenantNamesByLease[key] || []), name];
          }
        }
      }
    } catch {}
  }

  // Load locally stored appliances for this unit
  let appliances: ApplianceRow[] = [];
  if (unit?.id) {
    try {
      const { data: appRows } = await db
        .from('appliances')
        .select('id, name, type, installation_date')
        .eq('unit_id', unit.id)
        .order('name');
      appliances = Array.isArray(appRows) ? (appRows as ApplianceRow[]) : [];
    } catch {}
  }

  // Load monthly logs for this unit
  let monthlyLogs: MonthlyLogListRow[] = [];
  if (unit?.id) {
    try {
      const { data: logRows } = await db
        .from('monthly_logs')
        .select('id, period_start, status, stage, sort_index, created_at')
        .eq('unit_id', unit.id)
        .order('period_start', { ascending: false })
        .order('stage', { ascending: true })
        .order('sort_index', { ascending: true })
        .order('created_at', { ascending: true });

      monthlyLogs = Array.isArray(logRows)
        ? (logRows as Tables<'monthly_logs'>[])
            .map((row) => ({
              id: String(row.id),
              periodStart: typeof row?.period_start === 'string' ? row.period_start : '',
              status: normalizeMonthlyLogStatus(row?.status),
              stage: normalizeMonthlyLogStage(row?.stage),
            }))
            .filter((row) => row.id && row.periodStart)
        : [];
    } catch {}
  }

  // Load all transaction lines associated with this unit or its leases (used for balances and filtering)
  let transactionLines: TransactionLineRow[] = [];
  const tlCounts = { unit: 0, lease: 0, buildiumLease: 0 };
  const transactionLineMap = new Map<string, TransactionLineRow>();
  const collectLines = (rows?: TransactionLineRow[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row?.gl_accounts?.exclude_from_cash_balances === true) continue;
      const key = row?.id ? String(row.id) : `${row?.transaction_id ?? ''}:${row?.gl_account_id ?? ''}:${row?.memo ?? ''}:${row?.amount ?? ''}:${row?.posting_type ?? ''}`;
      if (!transactionLineMap.has(key)) transactionLineMap.set(key, row);
    }
  };

  const lineSelect =
    'id, transaction_id, property_id, unit_id, lease_id, buildium_lease_id, date, created_at, memo, amount, posting_type, gl_account_id, gl_accounts(name, account_number, type, sub_type, is_bank_account, is_security_deposit_liability, exclude_from_cash_balances), units(unit_number, unit_name), transactions(id, transaction_type, memo, reference_number)';
  if (unit?.id) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .eq('unit_id', unit.id);
      collectLines(lines as TransactionLineRow[] | null);
      tlCounts.unit = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  const leaseIdsForLines = Array.isArray(leases)
    ? leases
        .map((l) => {
          const parsed = Number(l?.id);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((id): id is number => id != null)
    : [];

  const buildiumLeaseIdsForLines = Array.isArray(leases)
    ? leases
        .map((l) => {
          const parsed = Number(l?.buildium_lease_id);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((id): id is number => id != null)
    : [];

  if (leaseIdsForLines.length) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .in('lease_id', leaseIdsForLines);
      collectLines(lines as TransactionLineRow[] | null);
      tlCounts.lease = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  if (buildiumLeaseIdsForLines.length) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .in('buildium_lease_id', buildiumLeaseIdsForLines);
      collectLines(lines as TransactionLineRow[] | null);
      tlCounts.buildiumLease = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  transactionLines = Array.from(transactionLineMap.values());

  // Fetch transactions tied to this unit's leases or referenced by transaction lines
  const transactionMap = new Map<string, TransactionRow>();
  let tempTransactionKey = 0;
  const addTransaction = (row: TransactionRow | null | undefined) => {
    if (!row) return;
    const hasId = row?.id != null && row.id !== '';
    const key = hasId
      ? `id:${String(row.id)}`
      : row?.buildium_transaction_id != null
        ? `buildium:${String(row.buildium_transaction_id)}`
        : `tmp:${tempTransactionKey++}`;
    if (!transactionMap.has(key)) transactionMap.set(key, row);
  };
  const collectTransactions = (rows?: TransactionRow[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) addTransaction(row);
  };

  let transactions: TransactionRow[] = [];
  if (leases.length) {
    const leaseIds = leases
      .map((l) => {
        const parsed = Number(l?.id);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((id): id is number => id != null);

    const buildiumLeaseIds = leases
      .map((l) => Number(l?.buildium_lease_id))
      .filter((id): id is number => Number.isFinite(id));

    try {
      if (leaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select(
            'id, date, due_date, paid_date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, status, reference_number, vendor_id',
          )
          .in('lease_id', leaseIds);
        collectTransactions(data as TransactionRow[] | null);
      }
    } catch {}

    try {
      if (buildiumLeaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select(
            'id, date, due_date, paid_date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, status, reference_number, vendor_id',
          )
          .in('buildium_lease_id', buildiumLeaseIds);
        collectTransactions(data as TransactionRow[] | null);
      }
    } catch {}

    transactions = Array.from(transactionMap.values());
  }

  const lineTransactionIds = Array.from(
    new Set(
      transactionLines
        .map((line) => {
          const raw = line?.transaction_id;
          if (raw == null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
          if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
          return null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const lineTransactionIdSet = new Set(lineTransactionIds);

  if (lineTransactionIds.length) {
    const existingIds = new Set(
      Array.from(transactionMap.values())
        .map((tx) => (tx?.id != null ? String(tx.id) : null))
        .filter((id): id is string => Boolean(id)),
    );
    const missingIds = lineTransactionIds.filter((id) => !existingIds.has(id));
    if (missingIds.length) {
      try {
        const { data: extra } = await db
          .from('transactions')
          .select(
            'id, date, due_date, paid_date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, status, reference_number, vendor_id',
          )
          .in('id', missingIds);
        collectTransactions(extra as TransactionRow[] | null);
      } catch {}
    }
  }

  transactions = Array.from(transactionMap.values());

  // Calculate unit-specific balance from the active lease
  // Prefer DB-maintained columns on the unit when present
  let unitBalance = typeof unit?.balance === 'number' ? Number(unit.balance) : 0;
  let activeLeaseId: string | null = null;
  const depositsHeld =
    typeof unit?.deposits_held_balance === 'number'
      ? Number(unit.deposits_held_balance)
      : 0;
  const prepayments =
    typeof unit?.prepayments_balance === 'number'
      ? Number(unit.prepayments_balance)
      : 0;

  if (leases.length > 0) {
    // Get the most recent active lease
    const activeLease =
      leases.find(
        (l) => l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'current',
      ) || leases[0];
    activeLeaseId = activeLease?.id != null ? String(activeLease.id) : null;

    const relevantTransactions = Array.isArray(transactions)
      ? transactions.filter((tx) => {
          const leaseIdMatches =
            activeLease?.id != null &&
            tx?.lease_id != null &&
            String(tx.lease_id) === String(activeLease.id);
          const buildiumLeaseMatches =
            activeLease?.buildium_lease_id != null &&
            tx?.buildium_lease_id != null &&
            Number(tx.buildium_lease_id) === Number(activeLease.buildium_lease_id);
          return leaseIdMatches || buildiumLeaseMatches;
        })
      : [];

    const localBalance = relevantTransactions.length
      ? relevantTransactions.reduce((sum, tx) => sum + signedAmountFromTransaction(tx), 0)
      : 0;

    // Only override DB-maintained balance if it is missing (zero) and we have a local non-zero calculation
    if (!unitBalance && localBalance) unitBalance = localBalance;
  }

  const memoByTransactionId = new Map<string, string>();
  for (const line of transactionLines) {
    const txIdValue = line?.transaction_id;
    if (txIdValue == null) continue;
    const txId = String(txIdValue);
    if (!txId) continue;
    const memo = typeof line?.memo === 'string' ? line.memo.trim() : '';
    if (memo && !memoByTransactionId.has(txId)) {
      memoByTransactionId.set(txId, memo);
    }
  }

  const propertyReserveRaw =
    typeof property?.reserve === 'number' ? property.reserve : property?.reserve ?? 0;
  const propertyReserve = Number(propertyReserveRaw) || 0;

  const { fin: unitFin, debug: unitFinanceDebug } = rollupFinances({
    transactionLines,
    transactions,
    unitBalances: {
      balance: unitBalance,
      deposits_held_balance: depositsHeld,
      prepayments_balance: prepayments,
    },
    propertyReserve,
    today: new Date(),
  });

  const shouldLogFinanceDebug =
    process.env.DEBUG_FINANCE === 'true' || process.env.NODE_ENV !== 'production';
  if (shouldLogFinanceDebug) {
    logDebug(
      '[unit-finance] summary',
      {
        unitId: unitIdString,
        leaseId: activeLeaseId,
        counts: {
          transactionLines: transactionLines.length,
          transactions: transactions.length,
          tlBySource: tlCounts,
        },
        debug: unitFinanceDebug,
        fin: unitFin,
      },
      { force: true },
    );
  }

  type LeaseSectionProps = Parameters<typeof LeaseSection>[0];
  const leaseItems: LeaseSectionProps['leases'] = (leases as unknown as LeaseSectionProps['leases']).map(
    (l) => ({
      ...l,
      tenant_name: (tenantNamesByLease[String((l as { id: string | number }).id)] || []).join(', '),
    }),
  );

  if (!property || !unit) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            {!property ? 'Property not found.' : 'Unit not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const propertyNameLabel = typeof property?.name === 'string' ? property.name : null;
  const unitLabel =
    typeof unit?.unit_number === 'string' && unit.unit_number
      ? unit.unit_number
      : typeof unit?.unit_name === 'string' && unit.unit_name
        ? unit.unit_name
        : null;
  const leaseSectionProperty = property as LeaseSectionProps['property'];
  const leaseSectionUnit = unit as LeaseSectionProps['unit'];

  const ledgerLineUnitLabel = unitLabel || 'Unit';
  const ledgerLines = transactionLines
    .map((line): LedgerLine | null => {
      const mapped = mapTransactionLine(line);
      if (!mapped) return null;
      return {
        ...mapped,
        propertyId: mapped.propertyId ?? propertyIdString,
        propertyLabel: mapped.propertyLabel ?? propertyNameLabel ?? 'Property',
        unitId: mapped.unitId ?? unitIdString,
        unitLabel: mapped.unitLabel ?? ledgerLineUnitLabel,
      };
    })
    .filter((line): line is LedgerLine => Boolean(line));
  const ledgerGroups = buildLedgerGroups([], ledgerLines);

  let billRows: {
    id: string;
    dueDateLabel: string;
    status: BillStatusLabel;
    vendorLabel: string;
    vendorId: string | null;
    memo: string;
    referenceNumber: string;
    amount: number;
    amountLabel: string;
  }[] = [];

  const leaseIdSet = new Set(
    leases
      .map((l) => (l?.id != null ? String(l.id) : null))
      .filter((id): id is string => Boolean(id)),
  );
  const buildiumLeaseIdSet = new Set(
    leases
      .map((l) => (l?.buildium_lease_id != null ? String(l.buildium_lease_id) : null))
      .filter((id): id is string => Boolean(id)),
  );

  const billTransactionIdSet = new Set<string>();
  for (const tx of transactions) {
    const type = String(tx?.transaction_type ?? '').toLowerCase();
    if (type !== 'bill') continue;
    const idValue = tx?.id;
    if (idValue == null) continue;
    const idStr = String(idValue);
    const leaseMatch = tx?.lease_id != null && leaseIdSet.has(String(tx.lease_id));
    const buildiumLeaseMatch =
      tx?.buildium_lease_id != null && buildiumLeaseIdSet.has(String(tx.buildium_lease_id));
    if (lineTransactionIdSet.has(idStr) || leaseMatch || buildiumLeaseMatch) {
      billTransactionIdSet.add(idStr);
    }
  }
  const billTransactionIds = Array.from(billTransactionIdSet);
  const vendorNames = new Map<string, string>();

  if (billTransactionIds.length) {
    try {
      const { data: billData } = await db
        .from('transactions')
        .select(
          'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id',
        )
        .in('id', billTransactionIds)
        .eq('transaction_type', 'Bill')
        .order('due_date', { ascending: true });

      const bills = Array.isArray(billData) ? billData : [];
      if (bills.length) {
        const vendorIds = Array.from(
          new Set(
            bills
              .map((row) => (row?.vendor_id != null ? String(row.vendor_id) : null))
              .filter((id): id is string => Boolean(id)),
          ),
        );

        vendorNames.clear();
        if (vendorIds.length) {
          try {
            const { data: vendorsData } = await db
              .from('vendors')
              .select(
                'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
              )
              .in('id', vendorIds);

            for (const vendor of vendorsData || []) {
              const vendorId = vendor?.id != null ? String(vendor.id) : null;
              if (!vendorId) continue;
              const contact = (vendor as VendorRow)?.contact;
              const label =
                contact?.display_name ||
                contact?.company_name ||
                [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
                'Vendor';
              vendorNames.set(vendorId, label);
            }
          } catch {}
        }

        billRows = bills
          .map((row) => {
            const txIdValue = row?.id != null ? String(row.id) : '';
            if (!txIdValue) return null;
            const currentStatus = normalizeBillStatus(row?.status);
            const derivedStatus = deriveBillStatusFromDates(
              currentStatus,
              row?.due_date ?? null,
              row?.paid_date ?? null,
            );
            const memo =
              typeof row?.memo === 'string' && row.memo.trim()
                ? row.memo.trim()
                : memoByTransactionId.get(txIdValue) || '';
            const amount = Number(row?.total_amount ?? 0) || 0;
            const vendorId = row?.vendor_id != null ? String(row.vendor_id) : null;

            return {
              id: txIdValue,
              dueDateLabel: formatDateString(row?.due_date ?? row?.date ?? null),
              status: derivedStatus,
              vendorId,
              vendorLabel:
                vendorNames.get(row?.vendor_id != null ? String(row.vendor_id) : '') || '—',
              memo: memo || '—',
              referenceNumber: row?.reference_number || '—',
              amount,
              amountLabel: currencyFormatter.format(amount),
            };
          })
          .filter(
            (
              row,
            ): row is {
              id: string;
              dueDateLabel: string;
              status: BillStatusLabel;
              vendorId: string | null;
              vendorLabel: string;
              memo: string;
              referenceNumber: string;
              amount: number;
              amountLabel: string;
            } => Boolean(row),
          );
      }
    } catch {}
  }

  const vendorOptions = Array.from(vendorNames.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const vendorFilterIds = vendorFilterParam.filter((id) => vendorNames.has(id));
  const vendorFilterSet = vendorFilterIds.length ? new Set(vendorFilterIds) : null;

  const statusOptionsForView: { slug: BillStatusSlug; label: BillStatusLabel }[] =
    activeBillsView === 'paid'
      ? [{ slug: 'paid', label: 'Paid' }]
      : [
          { slug: 'overdue', label: 'Overdue' },
          { slug: 'due', label: 'Due' },
          { slug: 'partially-paid', label: 'Partially paid' },
          { slug: 'cancelled', label: 'Cancelled' },
        ];
  const allowedStatusSlugs = new Set(statusOptionsForView.map((option) => option.slug));
  const explicitStatusSlugs = statusFilterParam
    .filter(isBillStatusSlug)
    .filter((slug) => allowedStatusSlugs.has(slug));
  const selectedStatusSlugs: BillStatusSlug[] =
    explicitStatusSlugs.length > 0
      ? explicitStatusSlugs
      : activeBillsView === 'paid'
        ? ['paid']
        : [];
  const statusFilterSet =
    selectedStatusSlugs.length > 0
      ? new Set(selectedStatusSlugs.map((slug) => statusSlugToLabel[slug]))
      : null;

  const rowsMatchingView =
    activeBillsView === 'paid'
      ? billRows.filter((row) => row.status === 'Paid')
      : billRows.filter((row) => row.status !== 'Paid');
  const visibleBillRows = rowsMatchingView.filter((row) => {
    const vendorMatches = !vendorFilterSet || (row.vendorId && vendorFilterSet.has(row.vendorId));
    const statusMatches = !statusFilterSet || statusFilterSet.has(row.status);
    return vendorMatches && statusMatches;
  });

  const billCountLabel = `${visibleBillRows.length} match${visibleBillRows.length === 1 ? '' : 'es'}`;
  const ledgerCountLabel = `${ledgerLines.length} entr${ledgerLines.length === 1 ? 'y' : 'ies'}`;

  return (
    <div className="space-y-6">
      <div>
        <nav className="-mb-px flex flex-wrap gap-6" aria-label="Unit sections">
          {subNavItems.map((item) => {
            const isActive = item.key === activeTab;
            const href = item.key === 'details' ? basePath : `${basePath}?tab=${item.key}`;
            return (
              <Link
                key={item.key}
                href={href}
                scroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center border-b-2 border-transparent px-1 pb-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {activeTab === 'services' ? (
        <UnitServicesTab
          propertyId={propertyIdString}
          unitId={unitIdString}
          unit={unit}
          property={property}
        />
      ) : activeTab === 'details' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column mirrors property summary */}
          <div className="space-y-6 lg:col-span-2">
            <UnitDetailsCard property={property} unit={unit} />

            <LeaseSection leases={leaseItems} unit={leaseSectionUnit} property={leaseSectionProperty} />

            <div className="space-y-6">
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-base font-semibold">Appliances</h3>
                  <AddLink aria-label="Add appliance" />
                </div>
                <Card>
                  <CardContent className="p-4">
                    <div className="rounded-md border">
                      {appliances.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between px-4 py-3">
                            <Link href="#" className="text-primary hover:underline">
                              {appliances[0]?.name || appliances[0]?.type || 'Appliance'}
                            </Link>
                            <span className="text-muted-foreground text-xs">
                              {(() => {
                                const d = appliances[0]?.installation_date;
                                return d ? `Installed ${new Date(d).toLocaleDateString()}` : '';
                              })()}
                            </span>
                          </div>
                          <div className="text-muted-foreground border-t px-4 py-6 text-sm">
                            {appliances.length > 1
                              ? `+ ${appliances.length - 1} more appliances`
                              : 'No other appliances have been added to this unit.'}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground px-4 py-6 text-sm">
                          No appliances found for this unit.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-foreground text-base font-semibold">Monthly Logs</h3>
                  <AddLink aria-label="Add monthly log" />
                </div>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground text-sm">
                            No monthly logs have been recorded for this unit.
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyLogs.map((log) => (
                          <TableRowLink key={log.id} href={`/monthly-logs/${log.id}`}>
                            <TableCell className="text-foreground">
                              {formatPeriodStartLabel(log.periodStart)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={monthlyLogStatusVariant(log.status)}>
                                  {monthlyLogStatusLabels[log.status]}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {monthlyLogStageLabels[log.stage]}
                                </span>
                              </div>
                            </TableCell>
                          </TableRowLink>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-foreground text-base font-semibold">Files</h3>
                  <AddLink aria-label="Add file" />
                </div>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-sm">
                          No files have been uploaded for this unit.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              </section>
            </div>
          </div>

          {/* Right rail: combined financial and services card */}
          <div className="space-y-6">
            <UnitFinancialServicesCard
              fin={unitFin}
              property={property}
            />
          </div>
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">{ledgerCountLabel}</span>
          </div>
          <div className="border-border overflow-hidden rounded-lg border shadow-sm">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border border-b">
                  <TableHead className="text-muted-foreground w-[12rem]">Date</TableHead>
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
                {ledgerGroups.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-6 text-center text-sm"
                    >
                      No ledger activity found for this unit.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerGroups.map((group) => {
                    const detailChrono = [...group.lines].sort((a, b) => {
                      const dateCmp = a.line.date.localeCompare(b.line.date);
                      if (dateCmp !== 0) return dateCmp;
                      return (a.line.createdAt || '').localeCompare(b.line.createdAt || '');
                    });

                    let running = group.prior;
                    const detailDisplay = detailChrono.map(({ line, signed }) => {
                      running += signed;
                      return { line, signed, runningAfter: running };
                    });

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
                            {formatSignedCurrency(group.prior)}
                          </TableCell>
                        </TableRow>
                        {detailDisplay.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-muted-foreground py-4 text-center text-sm"
                            >
                              No activity in selected period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailDisplay.map(({ line, signed, runningAfter }, idx) => {
                            const txnLabel = [
                              line.transactionType || 'Transaction',
                              line.transactionReference ? `#${line.transactionReference}` : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            const memo = line.memo || line.transactionMemo || '—';
                            const unitDisplay = line.unitLabel || ledgerLineUnitLabel;

                            return (
                              <TableRow key={`${group.id}-${line.date}-${idx}`}>
                                <TableCell>{formatDateString(line.date)}</TableCell>
                                <TableCell>{unitDisplay}</TableCell>
                                <TableCell>{txnLabel || '—'}</TableCell>
                                <TableCell>{memo}</TableCell>
                                <TableCell
                                  className={cn('text-right', signed < 0 ? 'text-destructive' : '')}
                                >
                                  {formatSignedCurrency(signed)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatSignedCurrency(runningAfter)}
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
                            {formatSignedCurrency(group.net)}
                          </TableCell>
                          <TableCell className="text-foreground text-right font-semibold">
                            {formatSignedCurrency(group.prior + group.net)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : activeTab === 'bills' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex items-center gap-4 text-sm" aria-label="Bills filters">
              <Link
                href={buildBillsViewHref('unpaid')}
                scroll={false}
                aria-current={activeBillsView === 'unpaid' ? 'page' : undefined}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors',
                  activeBillsView === 'unpaid' &&
                    'text-foreground font-medium underline decoration-2 underline-offset-4',
                )}
              >
                Unpaid bills
              </Link>
              <Link
                href={buildBillsViewHref('paid')}
                scroll={false}
                aria-current={activeBillsView === 'paid' ? 'page' : undefined}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors',
                  activeBillsView === 'paid' &&
                    'text-foreground font-medium underline decoration-2 underline-offset-4',
                )}
              >
                Paid bills
              </Link>
            </nav>
            <div className="text-muted-foreground text-sm">{billCountLabel}</div>
            <div className="ml-auto flex gap-2">
              <Button type="button">Record bill</Button>
              <Button type="button" variant="outline">
                Pay bills
              </Button>
            </div>
          </div>
          <UnitBillsFilters
            vendorOptions={vendorOptions}
            selectedVendorIds={vendorFilterIds}
            statusOptions={statusOptionsForView.map((option) => ({
              value: option.slug,
              label: option.label,
            }))}
            selectedStatusIds={selectedStatusSlugs}
          />
          <div className="border-border overflow-hidden rounded-lg border shadow-sm">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border border-b">
                  <TableHead className="w-[12rem]">Due date</TableHead>
                  <TableHead className="w-[10rem]">Status</TableHead>
                  <TableHead className="w-[16rem]">Vendor</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-[10rem]">Ref No.</TableHead>
                  <TableHead className="w-[10rem] text-right">Amount</TableHead>
                  <TableHead className="w-[3rem]" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border divide-y">
                {visibleBillRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-6 text-center text-sm"
                    >
                      No bills found for this unit.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleBillRows.map((row) => (
                    <TableRowLink key={row.id} href={`/bills/${row.id}`}>
                      <TableCell>{row.dueDateLabel}</TableCell>
                      <TableCell className="text-foreground">
                        {row.status ? (
                          <Badge
                            variant={statusToVariant(row.status)}
                            className={cn(
                              'uppercase',
                              row.status === 'Overdue' && 'bg-destructive/10 text-destructive',
                            )}
                          >
                            {row.status}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">{row.vendorLabel}</TableCell>
                      <TableCell className="text-foreground">{row.memo}</TableCell>
                      <TableCell>{row.referenceNumber}</TableCell>
                      <TableCell className="text-right">{row.amountLabel}</TableCell>
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
      ) : (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-foreground text-base font-semibold">Monthly Logs</h3>
                <p className="text-muted-foreground text-sm">
                  Monthly logs for this unit will be organized here.
                </p>
              </div>
              <CreateMonthlyLogButton
                propertyId={propertyIdString}
                unitId={unitIdString}
                orgId={orgIdString}
                propertyName={propertyNameLabel}
                unitLabel={unitLabel}
              />
            </div>
            {monthlyLogs.length === 0 ? (
              <div className="border-muted-foreground/40 text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                No monthly logs have been created for this unit yet.
              </div>
            ) : (
              <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[14rem]">Month</TableHead>
                      <TableHead className="w-[12rem]">Status</TableHead>
                      <TableHead>Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyLogs.map((log) => (
                      <TableRowLink key={log.id} href={`/monthly-logs/${log.id}`}>
                        <TableCell className="text-foreground">
                          {formatPeriodStartLabel(log.periodStart)}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <Badge variant={monthlyLogStatusVariant(log.status)}>
                            {monthlyLogStatusLabels[log.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {monthlyLogStageLabels[log.stage]}
                        </TableCell>
                      </TableRowLink>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
