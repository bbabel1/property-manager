export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

type Fin = {
  cash_balance?: number;
  security_deposits?: number;
  reserve?: number;
  available_balance?: number;
  as_of?: string;
};
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

const readableTransactionType = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Transaction';
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  const property = await PropertyService.getPropertyById(propertyId);

  // Try to find unit from property details; fallback to API
  let unit = property?.units?.find((u) => String((u as any).id) === String(unitId)) as any;
  if (!unit) {
    try {
      const res = await fetch(`/api/units/${unitId}`, { cache: 'no-store' });
      if (res.ok) unit = await res.json();
    } catch {}
  }

  const propertyIdString = property?.id != null ? String(property.id) : '';
  const unitIdString = unit?.id != null ? String(unit.id) : '';
  const orgIdString =
    (property as any)?.org_id != null
      ? String((property as any).org_id)
      : (unit as any)?.org_id != null
        ? String((unit as any).org_id)
        : '';

  // Load live leases and join tenant names (local DB)
  const db = supabaseAdmin || supaClient;
  let leases: any[] = [];
  const tenantNamesByLease: Record<string, string[]> = {};
  if (unit?.id) {
    try {
      const { data: leaseRows } = await db
        .from('lease')
        .select(
          'id, lease_from_date, lease_to_date, status, rent_amount, buildium_lease_id, sync_status, last_sync_error, last_sync_attempt_at',
        )
        .eq('unit_id', unit.id)
        .order('lease_from_date', { ascending: false });
      leases = Array.isArray(leaseRows) ? leaseRows : [];
      const ids = leases.map((l: any) => l.id);
      if (ids.length) {
        const { data: lcs } = await db
          .from('lease_contacts')
          .select(
            'lease_id, tenants( id, contact:contacts(display_name, first_name, last_name, company_name, is_company) )',
          )
          .in('lease_id', ids as any);
        if (Array.isArray(lcs)) {
          for (const row of lcs) {
            const contact = (row as any)?.tenants?.contact;
            const name =
              contact?.display_name ||
              contact?.company_name ||
              [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
              'Tenant';
            const key = String((row as any).lease_id);
            tenantNamesByLease[key] = [...(tenantNamesByLease[key] || []), name];
          }
        }
      }
    } catch {}
  }

  // Load locally stored appliances for this unit
  let appliances: any[] = [];
  if (unit?.id) {
    try {
      const { data: appRows } = await db
        .from('appliances')
        .select('id, name, type, installation_date')
        .eq('unit_id', unit.id)
        .order('name');
      appliances = Array.isArray(appRows) ? appRows : [];
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
        ? (logRows as any[])
            .map((row) => ({
              id: String(row.id),
              periodStart: typeof row?.period_start === 'string' ? row.period_start : '',
              status: normalizeMonthlyLogStatus((row as any)?.status),
              stage: normalizeMonthlyLogStage((row as any)?.stage),
            }))
            .filter((row) => row.id && row.periodStart)
        : [];
    } catch {}
  }

  // Load all transaction lines associated with this unit or its leases (used for balances and filtering)
  let transactionLines: any[] = [];
  const tlCounts = { unit: 0, lease: 0, buildiumLease: 0 };
  const transactionLineMap = new Map<string, any>();
  const collectLines = (rows?: any[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row?.gl_accounts?.exclude_from_cash_balances === true) continue;
      const key = row?.id ? String(row.id) : `${row?.transaction_id ?? ''}:${row?.gl_account_id ?? ''}:${row?.memo ?? ''}:${row?.amount ?? ''}:${row?.posting_type ?? ''}`;
      if (!transactionLineMap.has(key)) transactionLineMap.set(key, row);
    }
  };

  const lineSelect =
    'id, transaction_id, memo, amount, posting_type, gl_account_id, gl_accounts(name, type, sub_type, is_bank_account, is_security_deposit_liability, exclude_from_cash_balances)';
  if (unit?.id) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .eq('unit_id', unit.id);
      collectLines(lines);
      tlCounts.unit = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  const leaseIdsForLines = Array.isArray(leases)
    ? leases
        .map((l: any) => {
          const raw = l?.id;
          if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
          if (typeof raw === 'string' && raw.trim() !== '') {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return parsed;
          }
          return null;
        })
        .filter((id): id is number => id != null)
    : [];

  const buildiumLeaseIdsForLines = Array.isArray(leases)
    ? leases
        .map((l: any) => {
          const raw = l?.buildium_lease_id;
          if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
          if (typeof raw === 'string' && raw.trim() !== '') {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return parsed;
          }
          return null;
        })
        .filter((id): id is number => id != null)
    : [];

  if (leaseIdsForLines.length) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .in('lease_id', leaseIdsForLines as any);
      collectLines(lines);
      tlCounts.lease = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  if (buildiumLeaseIdsForLines.length) {
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select(lineSelect)
        .in('buildium_lease_id', buildiumLeaseIdsForLines as any);
      collectLines(lines);
      tlCounts.buildiumLease = Array.isArray(lines) ? lines.length : 0;
    } catch {}
  }

  transactionLines = Array.from(transactionLineMap.values());

  // Fetch transactions tied to this unit's leases or referenced by transaction lines
  const transactionMap = new Map<string, any>();
  let tempTransactionKey = 0;
  const addTransaction = (row: any) => {
    if (!row) return;
    const hasId = row?.id != null && row.id !== '';
    const key = hasId
      ? `id:${String(row.id)}`
      : row?.buildium_transaction_id != null
        ? `buildium:${String(row.buildium_transaction_id)}`
        : `tmp:${tempTransactionKey++}`;
    if (!transactionMap.has(key)) transactionMap.set(key, row);
  };
  const collectTransactions = (rows?: any[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) addTransaction(row);
  };

  let transactions: any[] = [];
  if (leases.length) {
    const leaseIds = leases
      .map((l: any) => {
        const raw = l?.id;
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        if (typeof raw === 'string' && raw.trim() !== '') {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })
      .filter((id): id is number => id != null);

    const buildiumLeaseIds = leases
      .map((l: any) => {
        const raw = l?.buildium_lease_id;
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        if (typeof raw === 'string' && raw.trim() !== '') {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })
      .filter((id): id is number => id != null);

    try {
      if (leaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select(
            'id, date, due_date, paid_date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, status, reference_number, vendor_id',
          )
          .in('lease_id', leaseIds as any);
        collectTransactions(data);
      }
    } catch {}

    try {
      if (buildiumLeaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select(
            'id, date, due_date, paid_date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, status, reference_number, vendor_id',
          )
          .in('buildium_lease_id', buildiumLeaseIds as any);
        collectTransactions(data);
      }
    } catch {}

    transactions = Array.from(transactionMap.values());
  }

  const lineTransactionIds = Array.from(
    new Set(
      transactionLines
        .map((line: any) => {
          const raw = (line as any)?.transaction_id;
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
        .map((tx: any) => (tx?.id != null ? String(tx.id) : null))
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
          .in('id', missingIds as any);
        collectTransactions(extra);
      } catch {}
    }
  }

  transactions = Array.from(transactionMap.values());

  // Calculate unit-specific balance from the active lease
  // Prefer DB-maintained columns on the unit when present
  let unitBalance = typeof (unit as any)?.balance === 'number' ? Number((unit as any).balance) : 0;
  let activeLeaseRent: number | null = null;
  let activeLeaseId: string | null = null;
  let depositsHeld =
    typeof (unit as any)?.deposits_held_balance === 'number'
      ? Number((unit as any).deposits_held_balance)
      : 0;
  let prepayments =
    typeof (unit as any)?.prepayments_balance === 'number'
      ? Number((unit as any).prepayments_balance)
      : 0;

  if (leases.length > 0) {
    // Get the most recent active lease
    const activeLease =
      leases.find(
        (l) => l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'current',
      ) || leases[0];
    activeLeaseRent = activeLease?.rent_amount || null;
    activeLeaseId = activeLease?.id || null;

    const relevantTransactions = Array.isArray(transactions)
      ? transactions.filter((tx) => {
          const leaseIdMatches =
            activeLease?.id != null &&
            tx?.lease_id != null &&
            String(tx.lease_id) === String(activeLease.id);
          const buildiumLeaseMatches =
            activeLease?.buildium_lease_id != null &&
            tx?.buildium_lease_id != null &&
            Number(tx.buildium_lease_id) === Number((activeLease as any).buildium_lease_id);
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
  const accountNamesByTransactionId = new Map<string, string>();
  const accountNameSetByTransactionId = new Map<string, Set<string>>();
  for (const line of transactionLines) {
    const txIdValue = (line as any)?.transaction_id;
    if (txIdValue == null) continue;
    const txId = String(txIdValue);
    if (!txId) continue;
    const memo = typeof (line as any)?.memo === 'string' ? (line as any).memo.trim() : '';
    if (memo && !memoByTransactionId.has(txId)) {
      memoByTransactionId.set(txId, memo);
    }
    const accountName =
      typeof (line as any)?.gl_accounts?.name === 'string'
        ? (line as any).gl_accounts.name.trim()
        : typeof (line as any)?.gl_account_id === 'string'
          ? (line as any).gl_account_id
          : '';
    if (accountName) {
      const set = accountNameSetByTransactionId.get(txId) ?? new Set<string>();
      set.add(accountName);
      accountNameSetByTransactionId.set(txId, set);
    }
  }
  for (const [txId, set] of accountNameSetByTransactionId.entries()) {
    accountNamesByTransactionId.set(txId, Array.from(set).join(', '));
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

  console.info('[unit-finance] summary', {
    unitId: unitIdString,
    leaseId: activeLeaseId,
    counts: {
      transactionLines: transactionLines.length,
      transactions: transactions.length,
      tlBySource: tlCounts,
    },
    debug: unitFinanceDebug,
    fin: unitFin,
  });

  const leaseItems = leases.map((l) => ({
    ...l,
    tenant_name: (tenantNamesByLease[String(l.id)] || []).join(', '),
  }));

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
    typeof (unit as any)?.unit_number === 'string' && (unit as any).unit_number
      ? (unit as any).unit_number
      : typeof (unit as any)?.unit_name === 'string' && (unit as any).unit_name
        ? (unit as any).unit_name
        : null;

  const ledgerRows = (() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];

    const entries = transactions
      .map((tx, idx) => {
        const rawId =
          tx?.id != null
            ? String(tx.id)
            : tx?.buildium_transaction_id != null
              ? `buildium:${tx.buildium_transaction_id}`
              : null;
        if (!rawId) return null;
        const rawDate = typeof tx?.date === 'string' ? tx.date : null;
          const memoFromTx = typeof tx?.memo === 'string' ? tx.memo.trim() : '';
          const txIdForMemo = tx?.id != null ? String(tx.id) : null;
          const resolvedMemo =
            memoFromTx || (txIdForMemo ? memoByTransactionId.get(txIdForMemo) || '' : '');
          const accountLabel = txIdForMemo ? accountNamesByTransactionId.get(txIdForMemo) || '' : '';
          const amount = signedAmountFromTransaction(tx);
        const typeRaw = tx?.transaction_type ?? tx?.TransactionType ?? tx?.TransactionTypeEnum;
        const typeNormalized = String(typeRaw ?? '').toLowerCase();
        return {
          id: rawId,
          date: rawDate,
          amount,
          memo: resolvedMemo,
          typeLabel: readableTransactionType(typeRaw),
          typeKey: typeNormalized,
          accountLabel,
          sortIndex: idx,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          id: string;
          date: string | null;
          amount: number;
          memo: string;
          typeLabel: string;
          typeKey: string;
          accountLabel: string;
          sortIndex: number;
        } => Boolean(entry),
      );

    const toTimestamp = (value: string | null) => {
      if (!value) return Number.NaN;
      const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
      const ms = Date.parse(iso);
      return Number.isNaN(ms) ? Number.NaN : ms;
    };

    const typePriority = (typeKey: string) => {
      if (!typeKey) return 2;
      const t = typeKey.toLowerCase();
      if (t.includes('charge') || t.includes('invoice') || t.includes('debit') || t === 'bill') return 0;
      if (t.includes('payment') || t.includes('credit') || t.includes('refund') || t.includes('adjustment')) return 1;
      return 2;
    };

    entries.sort((a, b) => {
      if (!a || !b) return 0;
      const timeA = toTimestamp(a.date);
      const timeB = toTimestamp(b.date);
      const safeA = Number.isNaN(timeA) ? Number.MAX_SAFE_INTEGER : timeA;
      const safeB = Number.isNaN(timeB) ? Number.MAX_SAFE_INTEGER : timeB;
      if (safeA !== safeB) return safeA - safeB;
      const typeA = typePriority(a.typeKey);
      const typeB = typePriority(b.typeKey);
      if (typeA !== typeB) return typeA - typeB;
      if ((a.sortIndex ?? 0) !== (b.sortIndex ?? 0)) {
        return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
      }
      return a.id.localeCompare(b.id);
    });

    let running = 0;
    const withBalances = entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null).map((entry) => {
      running += entry.amount;
      return {
        ...entry,
        typeKey: undefined,
        amountLabel: formatSignedCurrency(entry.amount),
        balanceLabel: formatSignedCurrency(running),
        runningBalance: running,
        dateLabel: formatDateString(entry.date),
      };
    });

    return withBalances;
  })();
  const ledgerRowsDisplay = ledgerRows.slice().reverse();

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
      .map((l: any) => {
        const raw = (l as any)?.id;
        if (raw == null) return null;
        return String(raw);
      })
      .filter((id): id is string => Boolean(id)),
  );
  const buildiumLeaseIdSet = new Set(
    leases
      .map((l: any) => {
        const raw = (l as any)?.buildium_lease_id;
        if (raw == null) return null;
        return String(raw);
      })
      .filter((id): id is string => Boolean(id)),
  );

  const billTransactionIdSet = new Set<string>();
  for (const tx of transactions) {
    const type = String(
      tx?.transaction_type ?? tx?.TransactionType ?? tx?.TransactionTypeEnum ?? '',
    ).toLowerCase();
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
        .in('id', billTransactionIds as any)
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
            const { data: vendorsData } = await (db as any)
              .from('vendors')
              .select(
                'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
              )
              .in('id', vendorIds as any);

            for (const vendor of vendorsData || []) {
              const vendorId = vendor?.id != null ? String(vendor.id) : null;
              if (!vendorId) continue;
              const contact = (vendor as any)?.contact || {};
              const label =
                contact.display_name ||
                contact.company_name ||
                [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
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
  const ledgerCountLabel = `${ledgerRows.length} entr${ledgerRows.length === 1 ? 'y' : 'ies'}`;

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

            <LeaseSection leases={leaseItems} unit={unit} property={property} />

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
                  <TableHead className="w-[9rem]">Date</TableHead>
                  <TableHead className="w-[12rem]">Type</TableHead>
                  <TableHead className="w-[16rem]">Account</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-[10rem] text-right">Amount</TableHead>
                  <TableHead className="w-[10rem] text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border divide-y">
                {ledgerRowsDisplay.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-6 text-center text-sm"
                    >
                      No ledger activity found for this unit.
                    </TableCell>
                  </TableRow>
                ) : (
                    ledgerRowsDisplay.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.dateLabel}</TableCell>
                        <TableCell className="text-foreground">{row.typeLabel}</TableCell>
                        <TableCell className="text-foreground">
                          {row.accountLabel || '—'}
                        </TableCell>
                        <TableCell className="text-foreground">{row.memo || '—'}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right',
                          (row.amount ?? 0) < 0 ? 'text-destructive' : 'text-foreground',
                        )}
                      >
                        {row.amountLabel}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          row.runningBalance < 0 ? 'text-destructive' : 'text-foreground',
                        )}
                      >
                        {row.balanceLabel}
                      </TableCell>
                    </TableRow>
                  ))
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
