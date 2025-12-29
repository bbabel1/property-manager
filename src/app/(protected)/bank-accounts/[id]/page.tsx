import { endOfMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { supabase, supabaseAdmin } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  NavTabs,
  NavTabsContent,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
} from '@/components/ui/nav-tabs';
import DateRangeControls from '@/components/DateRangeControls';
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
import EditBankAccountLauncher from '@/components/bank-accounts/EditBankAccountLauncher';
import BalanceBreakdownControls from '@/components/bank-accounts/BalanceBreakdownControls';
import { fetchPropertyFinancials } from '@/server/financials/property-finance';
import type { Database } from '@/types/database';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdminMaybe } from '@/lib/db';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';

type SearchParams = {
  from?: string;
  to?: string;
  range?: string;
  balanceAsOf?: string;
  balancePropertyId?: string;
  balanceView?: string;
  tab?: string;
};

type BankAccountDetail = {
  id: string;
  org_id: string | null;
  name: string | null;
  description: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  bank_balance: number | null;
  bank_buildium_balance: number | null;
  buildium_gl_account_id?: number | null;
  is_active: boolean | null;
  bank_country: Database['public']['Enums']['countries'] | null;
  bank_check_printing_info?: Record<string, unknown> | null;
};

type BankTransactionRow = {
  id: string | null;
  date: string | null;
  reference_number: string | null;
  memo: string | null;
  total_amount: number | null;
  transaction_type: string | null;
  vendor_id: string | null;
  bank_gl_account_id: string | null;
  bank_amount: number | null;
  bank_posting_type: string | null;
  paid_by_label: string | null;
  paid_to_name: string | null;
  paid_to_type: string | null;
  paid_to_buildium_id: number | null;
  payee_name: string | null;
  payee_buildium_type: string | null;
  payee_buildium_id: number | null;
  is_transfer: boolean | null;
  transfer_other_bank_gl_account_id: string | null;
};

type VendorRecord = {
  id: string;
  buildium_vendor_id?: number | null;
  contact?:
    | {
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | {
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }[]
    | null;
};

type OwnerRecord = {
  id?: string;
  buildium_owner_id: number | null;
  contacts?: {
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_company?: boolean | null;
  } | null;
};

type LinkedPropertyRecord = {
  id: string;
  name: string | null;
  primary_owner: string | null;
  rental_owner_ids?: number[] | null;
  operating_bank_gl_account_id: string | null;
};

type BalanceBreakdownRow = {
  id: string;
  name: string;
  ownerName: string;
  balance: number;
  pending: number;
  total: number;
  href?: string;
  badge?: string | null;
  hasError?: boolean;
  properties?: string[];
};

type DisplayTransactionRow = {
  id: string;
  dateLabel: string;
  numberLabel: string;
  typeLabel: 'Check' | 'Deposit' | 'Other';
  paidByLabel: string;
  paidToLabel: string;
  memoLabel: string;
  paymentAmount: number;
  depositAmount: number;
  balanceAfter: number;
  transactionType: string;
  isTransfer: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
    const date = new Date(isoLike);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  } catch {
    return '—';
  }
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return currencyFormatter.format(0);
  return currencyFormatter.format(Number(value));
}

function maskAccountNumber(value: string | null) {
  if (!value) return '—';
  const s = String(value);
  if (s.length <= 4) return s;
  return s.replace(/.(?=.{4}$)/g, '•');
}

function formatAccountType(type: string | null) {
  if (!type) return 'Checking';
  const normalized = String(type).toLowerCase().replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeTxType(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function deriveTransactionDisplayType(
  transactionType: unknown,
  referenceNumber: string | null | undefined,
  isTransfer: boolean | null | undefined,
): 'Check' | 'Deposit' | 'Other' {
  if (isTransfer) return 'Other';

  const txType = normalizeTxType(transactionType);
  const hasReferenceNumber = Boolean(referenceNumber && referenceNumber.trim());

  if (txType === 'deposit') return 'Deposit';
  if (txType === 'check' || (txType === 'payment' && hasReferenceNumber)) return 'Check';

  return 'Other';
}

function splitPaymentAndDeposit(
  typeRaw: unknown,
  totalAmount: number | null,
  bankPostingType?: string | null,
  bankAmount?: number | null,
): {
  paymentAmount: number;
  depositAmount: number;
} {
  const bankPosting = normalizeTxType(bankPostingType);
  const bankSideAmount = Number(bankAmount ?? NaN);

  if (
    Number.isFinite(bankSideAmount) &&
    bankSideAmount !== 0 &&
    (bankPosting === 'debit' || bankPosting === 'credit')
  ) {
    const absBankAmount = Math.abs(bankSideAmount);
    if (bankPosting === 'debit') {
      return { paymentAmount: 0, depositAmount: absBankAmount };
    }
    return { paymentAmount: absBankAmount, depositAmount: 0 };
  }

  const amount = Number(totalAmount ?? 0);
  const absAmount = Math.abs(amount);
  if (!Number.isFinite(absAmount) || absAmount === 0) {
    return { paymentAmount: 0, depositAmount: 0 };
  }

  const type = normalizeTxType(typeRaw);

  const depositTypes = new Set([
    'deposit',
    'ownercontribution',
    'unreversedownercontribution',
    'generaljournalentry',
  ]);
  const paymentTypes = new Set([
    'payment',
    'electronicfundstransfer',
    'applydeposit',
    'refund',
    'unreversedpayment',
    'unreversedelectronicfundstransfer',
    'reverseelectronicfundstransfer',
    'reversepayment',
  ]);

  if (depositTypes.has(type)) {
    return { paymentAmount: 0, depositAmount: absAmount };
  }
  if (paymentTypes.has(type)) {
    return { paymentAmount: absAmount, depositAmount: 0 };
  }

  // Default: treat as payment for balance purposes.
  return { paymentAmount: absAmount, depositAmount: 0 };
}

function nameOfVendor(v: VendorRecord) {
  const contact = Array.isArray(v?.contact) ? v.contact[0] : v?.contact;
  return (
    contact?.display_name ||
    contact?.company_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
    'Vendor'
  );
}

function nameOfOwner(o: OwnerRecord) {
  const c = o?.contacts ?? null;
  const display =
    c?.display_name ||
    (c?.is_company ? c?.company_name : null) ||
    [c?.first_name, c?.last_name].filter(Boolean).join(' ');
  return (display || '').trim() || 'Rental owner';
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) return trimmed;
  }
  return null;
}

export default async function BankAccountShow({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | undefined>;

  const today = new Date();
  const hasRangeParam = typeof sp?.range === 'string';
  const hasExplicitDates = typeof sp?.from === 'string' || typeof sp?.to === 'string';

  const balanceAsOfDate = (() => {
    if (typeof sp?.balanceAsOf === 'string') {
      const parsed = new Date(sp.balanceAsOf);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return today;
  })();
  const balanceAsOfStr = balanceAsOfDate.toISOString().slice(0, 10);
  const balanceView = sp?.balanceView === 'owner' ? 'owner' : 'property';
  const balancePropertyIdRaw =
    typeof sp?.balancePropertyId === 'string' ? sp.balancePropertyId.trim() : null;
  const balancePropertyId =
    balancePropertyIdRaw && balancePropertyIdRaw !== 'all' ? balancePropertyIdRaw : null;

  const activeTab = typeof sp?.tab === 'string' ? sp.tab : 'transactions';

  const defaultTo = endOfMonth(today);
  const defaultFrom = startOfMonth(today);

  const to = sp?.to ? new Date(sp.to) : defaultTo;
  const from = sp?.from ? new Date(sp.from) : defaultFrom;
  const range = hasRangeParam ? sp.range! : hasExplicitDates ? 'custom' : 'currentMonth';

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const db = supabaseAdmin || supabase;
  const supabaseAuthed = await getSupabaseServerClient();

  const [
    { data: account, error: accountError },
    { data: txData, error: txError },
    { data: propertiesData, error: propertiesError },
  ] = await Promise.all([
    db
      .from('gl_accounts')
      .select(
        'id, org_id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_balance, bank_buildium_balance, buildium_gl_account_id, is_active, bank_country, bank_check_printing_info',
      )
      .eq('id', id)
      .eq('is_bank_account', true)
      .maybeSingle<BankAccountDetail>(),
    db
      .from('v_bank_register_transactions')
      .select(
        'id, date, reference_number, memo, total_amount, transaction_type, vendor_id, bank_gl_account_id, bank_amount, bank_posting_type, paid_by_label, paid_to_name, paid_to_type, paid_to_buildium_id, payee_name, payee_buildium_type, payee_buildium_id, is_transfer, transfer_other_bank_gl_account_id',
      )
      .eq('bank_gl_account_id', id)
      .gte('date', fromStr)
      .lte('date', toStr)
      .order('date', { ascending: true })
      .range(0, 199),
    db
      .from('properties')
      .select('id, name, primary_owner, rental_owner_ids, operating_bank_gl_account_id')
      .eq('operating_bank_gl_account_id', id)
      .order('name', { ascending: true })
      .limit(500),
  ]);

  if (accountError || !account) {
    return (
      <InfoCard title="Bank account">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    );
  }

  if (txError) {
    console.error('Failed to fetch bank transactions for account page:', txError);
  }

  if (propertiesError) {
    console.error('Failed to fetch linked properties for bank account page:', propertiesError);
  }

  const bankAccount = account as BankAccountDetail;
  const transactions = (txData || []) as BankTransactionRow[];
  const linkedPropertiesRaw = (propertiesData || []) as LinkedPropertyRecord[];

  const vendorIds = Array.from(
    new Set(
      transactions
        .map((row) => (row.vendor_id ? String(row.vendor_id) : null))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const vendorMap = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vendorsData } = await db
      .from('vendors')
      .select(
        'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
      )
      .in('id', vendorIds)
      .order('updated_at', { ascending: false })
      .limit(200);

    (vendorsData || []).forEach((v: VendorRecord) => {
      vendorMap.set(String(v.id), nameOfVendor(v));
    });
  }

  const ownerBuildiumIdSet = new Set<number>();
  transactions.forEach((row) => {
    if (
      row.payee_buildium_type?.toLowerCase() === 'rentalowner' &&
      typeof row.payee_buildium_id === 'number'
    ) {
      ownerBuildiumIdSet.add(row.payee_buildium_id);
    }
    if (
      row.paid_to_type?.toLowerCase() === 'rentalowner' &&
      typeof row.paid_to_buildium_id === 'number'
    ) {
      ownerBuildiumIdSet.add(row.paid_to_buildium_id);
    }
  });

  linkedPropertiesRaw.forEach((p) => {
    const ids = Array.isArray(p.rental_owner_ids) ? p.rental_owner_ids : [];
    ids.forEach((id) => {
      if (Number.isFinite(id)) ownerBuildiumIdSet.add(Number(id));
    });
  });

  const ownerBuildiumIds = Array.from(ownerBuildiumIdSet);

  const ownerMap = new Map<number, string>();
  if (ownerBuildiumIds.length) {
    const { data: ownersData } = await db
      .from('owners')
      .select(
        'id, buildium_owner_id, contacts!owners_contact_fk(display_name, company_name, first_name, last_name, is_company)',
      )
      .in('buildium_owner_id', ownerBuildiumIds)
      .order('updated_at', { ascending: false })
      .limit(500);

    (ownersData || []).forEach((o) => {
      // Transform the query result to match OwnerRecord type
      const ownerRecord: OwnerRecord = {
        id: o.id,
        buildium_owner_id: o.buildium_owner_id,
        contacts: Array.isArray(o.contacts) && o.contacts.length > 0 ? o.contacts[0] : null,
      };
      if (typeof ownerRecord.buildium_owner_id === 'number') {
        ownerMap.set(ownerRecord.buildium_owner_id, nameOfOwner(ownerRecord));
      }
    });
  }

  const linkedProperties = linkedPropertiesRaw.map((p) => {
    const name = (p.name || '').trim() || 'Property';
    const primaryOwner = (p.primary_owner || '').trim();
    const fallbackOwner = (Array.isArray(p.rental_owner_ids) ? p.rental_owner_ids : [])
      .map((id) => (Number.isFinite(id) ? ownerMap.get(Number(id)) : null))
      .find((label) => Boolean(label));
    const ownerLabel = primaryOwner || fallbackOwner || '—';
    const label = ownerLabel ? `${name} | ${ownerLabel}` : name;
    return {
      id: String(p.id),
      name,
      label,
      bankType: 'Operating' as const,
      ownerLabel,
    };
  });

  const selectedPropertiesForBreakdown = (() => {
    if (!balancePropertyId) return linkedProperties;
    const matches = linkedProperties.filter((p) => p.id === balancePropertyId);
    if (matches.length === 0) return linkedProperties;
    return matches;
  })();

  const propertyBreakdownRows: BalanceBreakdownRow[] = await Promise.all(
    selectedPropertiesForBreakdown.map(async (property) => {
      try {
        const { fin } = await fetchPropertyFinancials(property.id, balanceAsOfStr, db);
        const balance = Number(fin?.cash_balance ?? 0);
        const pending = 0;
        return {
          id: property.id,
          name: property.name || property.label,
          ownerName: property.ownerLabel || '—',
          balance,
          pending,
          total: balance + pending,
          href: `/properties/${property.id}`,
          badge: property.bankType === 'Operating' ? 'Default account' : null,
          hasError: false,
        } satisfies BalanceBreakdownRow;
      } catch (error) {
        console.error('Failed to fetch property financials for balance breakdown', {
          propertyId: property.id,
          error,
        });
        return {
          id: property.id,
          name: property.name || property.label,
          ownerName: property.ownerLabel || '—',
          balance: 0,
          pending: 0,
          total: 0,
          href: `/properties/${property.id}`,
          badge: property.bankType === 'Operating' ? 'Default account' : null,
          hasError: true,
        } satisfies BalanceBreakdownRow;
      }
    }),
  );

  const breakdownRows: BalanceBreakdownRow[] =
    balanceView === 'owner'
      ? (() => {
          const grouped = new Map<string, BalanceBreakdownRow>();
          propertyBreakdownRows.forEach((row) => {
            const key = row.ownerName || '—';
            const existing = grouped.get(key) || {
              id: key,
              name: key,
              ownerName: key,
              balance: 0,
              pending: 0,
              total: 0,
              badge: null,
              hasError: false,
              properties: [],
            };
            existing.balance += row.balance;
            existing.pending += row.pending;
            existing.total = existing.balance + existing.pending;
            existing.hasError = existing.hasError || row.hasError;
            existing.properties = [...(existing.properties || []), row.name];
            grouped.set(key, existing);
          });
          return Array.from(grouped.values());
        })()
      : propertyBreakdownRows;

  const breakdownTotals = breakdownRows.reduce(
    (acc, row) => {
      acc.pending += row.pending;
      acc.balance += row.balance;
      return acc;
    },
    { pending: 0, balance: 0 },
  );

  const breakdownMatchLabel = breakdownRows.length === 1 ? 'match' : 'matches';
  const breakdownHasErrors = propertyBreakdownRows.some((row) => row.hasError);
  const propertyFilterApplied = Boolean(balancePropertyId);

  async function computeClosingBalance(asOf: string): Promise<number | null> {
    if (!bankAccount.org_id) return null;

    const rpcClient = (supabaseAdminMaybe || supabaseAuthed) as SupabaseClient<Database>;
    const { data, error } = await rpcClient.rpc('gl_account_balance_as_of', {
      p_org_id: bankAccount.org_id,
      p_gl_account_id: bankAccount.id,
      p_as_of: asOf,
      p_property_id: undefined,
    });

    if (!error && typeof data === 'number' && Number.isFinite(data)) return data;

    const fallbackClient = (supabaseAdminMaybe || supabaseAuthed) as SupabaseClient<Database>;
    const [linesResp, txResp] = await Promise.all([
      fallbackClient
        .from('transaction_lines')
        .select('amount, posting_type')
        .eq('gl_account_id', bankAccount.id)
        .lte('date', asOf)
        .limit(20000),
      fallbackClient
        .from('transactions')
        .select('total_amount, transaction_type')
        .eq('bank_gl_account_id', bankAccount.id)
        .lte('date', asOf)
        .limit(20000),
    ]);

    if (linesResp.error || txResp.error) {
      console.error('Failed to compute closing balance fallback for bank account page:', {
        bankAccountId: bankAccount.id,
        asOf,
        lineError: linesResp.error,
        txError: txResp.error,
        method: 'fallback-manual',
      });
      return null;
    }

    // Match RPC logic: sum(debits) - sum(credits) from transaction_lines
    const lineSum = (linesResp.data || []).reduce((acc, row) => {
      const amt = Math.abs(Number(row.amount ?? NaN));
      if (!Number.isFinite(amt) || amt === 0) return acc;
      const isDebit = String(row.posting_type || '').toLowerCase() === 'debit';
      return acc + (isDebit ? amt : -amt);
    }, 0);

    const txSum = (txResp.data || []).reduce((acc, row) => {
      const amt = Math.abs(Number(row.total_amount ?? NaN));
      if (!Number.isFinite(amt) || amt === 0) return acc;
      const t = String(row.transaction_type || '').toLowerCase();
      const depositTypes = new Set([
        'deposit',
        'ownercontribution',
        'unreversedownercontribution',
        'generaljournalentry',
      ]);
      const paymentTypes = new Set([
        'payment',
        'electronicfundstransfer',
        'applydeposit',
        'refund',
        'unreversedpayment',
        'unreversedelectronicfundstransfer',
        'reverseelectronicfundstransfer',
        'reversepayment',
      ]);
      if (depositTypes.has(t)) return acc + amt;
      if (paymentTypes.has(t)) return acc - amt;
      return acc;
    }, 0);

    return lineSum + txSum;
  }

  const closingBalance =
    (await computeClosingBalance(toStr)) ?? Number(bankAccount.bank_balance ?? 0);

  // Derive opening balance from closing balance minus the in-range transaction deltas.
  const totalDelta = transactions.reduce((acc, row) => {
    const { paymentAmount, depositAmount } = splitPaymentAndDeposit(
      row.transaction_type,
      row.bank_amount ?? row.total_amount,
      row.bank_posting_type,
      row.bank_amount,
    );
    return acc + (depositAmount - paymentAmount);
  }, 0);

  let runningBalance = closingBalance - totalDelta;

  const displayRows: DisplayTransactionRow[] = transactions.map((row) => {
    const { paymentAmount, depositAmount } = splitPaymentAndDeposit(
      row.transaction_type,
      row.bank_amount ?? row.total_amount,
      row.bank_posting_type,
      row.bank_amount,
    );

    runningBalance += depositAmount - paymentAmount;

    const vendorLabel = row.vendor_id ? vendorMap.get(String(row.vendor_id)) : null;
    const ownerIdFromPayee =
      row.payee_buildium_type?.toLowerCase() === 'rentalowner' &&
      typeof row.payee_buildium_id === 'number'
        ? row.payee_buildium_id
        : null;
    const ownerIdFromPaidTo =
      row.paid_to_type?.toLowerCase() === 'rentalowner' &&
      typeof row.paid_to_buildium_id === 'number'
        ? row.paid_to_buildium_id
        : null;
    const ownerLabel = (() => {
      if (ownerIdFromPayee != null) return ownerMap.get(ownerIdFromPayee) ?? null;
      if (ownerIdFromPaidTo != null) return ownerMap.get(ownerIdFromPaidTo) ?? null;
      return null;
    })();
    const payToLabel =
      firstNonEmpty(row.paid_to_name, row.payee_name, vendorLabel, ownerLabel) ?? '—';

    const typeLabel = deriveTransactionDisplayType(
      row.transaction_type,
      row.reference_number,
      row.is_transfer,
    );

    return {
      id: row.id ? String(row.id) : `${row.date ?? 'tx'}-${Math.random().toString(36).slice(2)}`,
      dateLabel: formatDate(row.date),
      numberLabel: row.reference_number || '—',
      typeLabel,
      paidByLabel: row.paid_by_label || '—',
      paidToLabel: payToLabel,
      memoLabel: row.memo || '—',
      paymentAmount,
      depositAmount,
      balanceAfter: runningBalance,
      transactionType: String(row.transaction_type ?? ''),
      isTransfer: Boolean(row.is_transfer),
    };
  });

  const matchLabel = displayRows.length === 1 ? 'match' : 'matches';

  const maskedAccountNumber = maskAccountNumber(bankAccount.bank_account_number);
  const accountTypeLabel = formatAccountType(bankAccount.bank_account_type);
  const buildiumId = bankAccount.buildium_gl_account_id ?? null;
  const editInitialData = {
    name: bankAccount.name,
    description: bankAccount.description,
    bank_account_type: bankAccount.bank_account_type,
    bank_account_number: bankAccount.bank_account_number,
    bank_routing_number: bankAccount.bank_routing_number,
    bank_country: bankAccount.bank_country ?? null,
    bank_check_printing_info: bankAccount.bank_check_printing_info ?? null,
  };

  return (
    <PageShell>
      <PageHeader
        title={bankAccount.name || 'Bank account'}
        description={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-base">{maskedAccountNumber}</span>
            <span className="text-muted-foreground">| {accountTypeLabel}</span>
            <span className="text-muted-foreground">
              {buildiumId ? `Buildium GL ID ${buildiumId}` : 'Not linked to Buildium yet'}
            </span>
            <Badge variant={bankAccount.is_active ? 'secondary' : 'outline'}>
              {bankAccount.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <EditBankAccountLauncher accountId={bankAccount.id} initialData={editInitialData} />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline">
              Inactivate account
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Previous account">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Next account">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        }
      />
      <PageBody>
        <NavTabs defaultValue={activeTab || 'transactions'} className="space-y-6">
          <NavTabsHeader>
            <NavTabsList>
              <NavTabsTrigger value="transactions">Transactions</NavTabsTrigger>
              <NavTabsTrigger value="bank-feed">Bank feed</NavTabsTrigger>
              <NavTabsTrigger value="reconciliations">Reconciliations</NavTabsTrigger>
              <NavTabsTrigger value="balance-breakdown">Balance breakdown</NavTabsTrigger>
              <NavTabsTrigger value="payment-settings">Payment settings</NavTabsTrigger>
              <NavTabsTrigger value="check-settings">Check settings</NavTabsTrigger>
              <NavTabsTrigger value="properties">Properties</NavTabsTrigger>
            </NavTabsList>
          </NavTabsHeader>

          <NavTabsContent value="transactions">
            <Tabs defaultValue="all-transactions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all-transactions">All transactions</TabsTrigger>
                <TabsTrigger value="check-search">Check search</TabsTrigger>
              </TabsList>

              <TabsContent value="all-transactions" className="space-y-4">
                <Card className="border-border/70 border shadow-sm">
                  <CardContent className="flex flex-col gap-0 p-0">
                    <div className="border-border/70 flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
                      <DateRangeControls defaultFrom={from} defaultTo={to} defaultRange={range} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/bank-accounts/${bankAccount.id}/record-check`}>
                            Record check
                          </Link>
                        </Button>
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/bank-accounts/${bankAccount.id}/record-deposit`}>
                            Record deposit
                          </Link>
                        </Button>
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/bank-accounts/${bankAccount.id}/record-other-transaction`}>
                            Record other transaction
                          </Link>
                        </Button>
                        <Button type="button" size="sm" variant="outline">
                          Reconcile account
                        </Button>
                      </div>
                    </div>

                    <div className="border-border/70 text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm">
                      <span>
                        {displayRows.length} {matchLabel}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground px-3"
                      >
                        Export
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[960px]">
                        <TableHeader>
                          <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-semibold tracking-widest uppercase">
                            <TableHead className="text-muted-foreground w-[7rem]">Date</TableHead>
                            <TableHead className="text-muted-foreground w-[6rem]">Type</TableHead>
                            <TableHead className="text-muted-foreground w-[18rem]">
                              Paid by
                            </TableHead>
                            <TableHead className="text-muted-foreground w-[18rem]">
                              Paid to
                            </TableHead>
                            <TableHead className="text-muted-foreground">Memo</TableHead>
                            <TableHead className="text-muted-foreground w-[9rem] text-right">
                              Payment
                            </TableHead>
                            <TableHead className="text-muted-foreground w-[9rem] text-right">
                              Deposit
                            </TableHead>
                            <TableHead className="text-muted-foreground w-[6rem]">Clr</TableHead>
                            <TableHead className="text-muted-foreground w-[10rem] text-right">
                              Balance
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                className="text-muted-foreground py-10 text-center text-sm"
                              >
                                We didn&apos;t find any transactions for this account in the
                                selected date range.
                              </TableCell>
                            </TableRow>
                          ) : (
                            displayRows.map((row) => {
                              const txType = row.transactionType.toLowerCase();
                              const isDeposit = txType === 'deposit';
                              const isCheck = row.typeLabel === 'Check';
                              const isTransfer = row.isTransfer;
                              const isOther = txType === 'other';
                              const href = isDeposit
                                ? `/bank-accounts/${bankAccount.id}/deposits/${row.id}`
                                : isCheck
                                  ? `/bank-accounts/${bankAccount.id}/checks/${row.id}`
                                  : isTransfer
                                    ? `/bank-accounts/${bankAccount.id}/transfers/${row.id}`
                                    : isOther
                                      ? `/bank-accounts/${bankAccount.id}/other-transactions/${row.id}`
                                      : '#';
                              return (
                                <TableRowLink
                                  key={row.id}
                                  href={href}
                                  className="border-border/70 bg-background hover:bg-muted/40 border-b transition-colors last:border-0"
                                >
                                  <TableCell className="align-top text-sm">
                                    {row.dateLabel}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">
                                    {row.typeLabel}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">
                                    {row.paidByLabel}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">
                                    {row.paidToLabel}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">
                                    {row.memoLabel}
                                  </TableCell>
                                  <TableCell className="text-right align-top text-sm">
                                    {row.paymentAmount > 0
                                      ? formatCurrency(row.paymentAmount)
                                      : '—'}
                                  </TableCell>
                                  <TableCell className="text-right align-top text-sm">
                                    {row.depositAmount > 0
                                      ? formatCurrency(row.depositAmount)
                                      : '—'}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">—</TableCell>
                                  <TableCell className="text-right align-top text-sm">
                                    {formatCurrency(row.balanceAfter)}
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
              </TabsContent>

              <TabsContent value="check-search">
                <Card className="border-border/70 border shadow-sm">
                  <CardContent className="text-muted-foreground py-12 text-center text-sm">
                    Check search tools for this bank account will appear here in a future update.
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </NavTabsContent>

          <NavTabsContent value="bank-feed">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Bank feed connections and imported transactions will appear here in a future update.
              </CardContent>
            </Card>
          </NavTabsContent>

          <NavTabsContent value="reconciliations">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Reconciliation history and tools for this bank account will appear here in a future
                update.
              </CardContent>
            </Card>
          </NavTabsContent>
          <NavTabsContent value="balance-breakdown">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="flex flex-col gap-0 p-0">
                <div className="border-border/70 border-b px-6 py-5">
                  <BalanceBreakdownControls
                    asOf={balanceAsOfStr}
                    view={balanceView}
                    selectedPropertyId={balancePropertyId}
                    properties={linkedProperties.map((p) => ({ id: p.id, label: p.label }))}
                  />
                </div>

                <div className="border-border/70 text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm">
                  <span>
                    {breakdownRows.length} {breakdownMatchLabel}
                  </span>
                  <span className="text-muted-foreground">As of {formatDate(balanceAsOfStr)}</span>
                </div>

                {propertyFilterApplied ? (
                  <div className="border-border/70 text-muted-foreground border-b px-6 py-3 text-sm">
                    You are viewing a filtered list of properties or company. Amounts shown here
                    represent only the selected properties&apos; or company portion of the balance.
                  </div>
                ) : null}

                {breakdownHasErrors ? (
                  <div className="border-border/70 border-b bg-amber-50 px-6 py-3 text-sm text-amber-900">
                    Some balances could not be loaded for this view. Missing rows are shown as $0.00
                    while we finish syncing.
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-semibold tracking-widest uppercase">
                        <TableHead className="text-muted-foreground">
                          {balanceView === 'owner' ? 'Owner' : 'Property or company'}
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          {balanceView === 'owner' ? 'Properties' : 'Rental owner'}
                        </TableHead>
                        <TableHead className="text-muted-foreground w-[8rem] text-right">
                          Pending
                        </TableHead>
                        <TableHead className="text-muted-foreground w-[10rem] text-right">
                          Balance
                        </TableHead>
                        <TableHead className="text-muted-foreground w-[10rem] text-right">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedProperties.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground py-10 text-center text-sm"
                          >
                            No properties are linked to this bank account yet.
                          </TableCell>
                        </TableRow>
                      ) : breakdownRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground py-10 text-center text-sm"
                          >
                            No balances to display for this view and filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {breakdownRows.map((row) => (
                            <TableRow
                              key={row.id}
                              className="border-border/70 hover:bg-muted/30 border-b transition-colors last:border-0"
                            >
                              <TableCell className="align-top text-sm">
                                {balanceView === 'owner' ? (
                                  <div className="space-y-1">
                                    <p className="text-foreground font-semibold">{row.name}</p>
                                    {row.properties?.length ? (
                                      <p className="text-muted-foreground text-xs">
                                        Includes {row.properties.slice(0, 3).join(', ')}
                                        {row.properties.length > 3
                                          ? `, +${row.properties.length - 3} more`
                                          : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {row.href ? (
                                        <Link
                                          className="text-primary font-medium hover:underline"
                                          href={row.href}
                                        >
                                          {row.name}
                                        </Link>
                                      ) : (
                                        <span className="text-foreground font-medium">
                                          {row.name}
                                        </span>
                                      )}
                                      {row.badge ? (
                                        <Badge
                                          variant="secondary"
                                          className="bg-muted/70 text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
                                        >
                                          {row.badge}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-muted-foreground text-xs">{row.ownerName}</p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="align-top text-sm">
                                {balanceView === 'owner' ? (
                                  <span className="text-muted-foreground text-sm">
                                    {row.properties?.length
                                      ? `${row.properties.length} properties`
                                      : '—'}
                                  </span>
                                ) : (
                                  <span className="text-foreground">{row.ownerName || '—'}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-right align-top text-sm">
                                {formatCurrency(row.pending)}
                              </TableCell>
                              <TableCell className="text-right align-top text-sm font-medium">
                                {formatCurrency(row.balance)}
                              </TableCell>
                              <TableCell className="text-right align-top text-sm font-semibold">
                                {formatCurrency(row.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-border/70 bg-muted/30 border-t font-semibold">
                            <TableCell className="text-sm">Total</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {balanceView === 'owner' ? '—' : ''}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(breakdownTotals.pending)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(breakdownTotals.balance)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(breakdownTotals.pending + breakdownTotals.balance)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </NavTabsContent>

          <NavTabsContent value="payment-settings">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Payment settings for this bank account will appear here in a future update.
              </CardContent>
            </Card>
          </NavTabsContent>

          <NavTabsContent value="check-settings">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Check printing settings for this bank account will appear here in a future update.
              </CardContent>
            </Card>
          </NavTabsContent>

          <NavTabsContent value="properties">
            <Card className="border-border/70 border shadow-sm">
              <CardContent className="flex flex-col gap-0 p-0">
                <div className="border-border/70 flex flex-col gap-1 border-b px-6 py-5">
                  <h2 className="text-lg font-semibold">Properties</h2>
                  <p className="text-muted-foreground text-sm">
                    Review which properties are associated with this bank account.
                  </p>
                </div>

                {propertiesError ? (
                  <div className="bg-destructive/5 text-destructive px-6 py-4 text-sm">
                    Unable to load properties for this bank account right now.
                  </div>
                ) : null}

                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-semibold tracking-widest uppercase">
                          <TableHead className="text-muted-foreground">Property</TableHead>
                          <TableHead className="text-muted-foreground w-[14rem]">
                            Property bank type
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedProperties.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={2}
                              className="text-muted-foreground py-10 text-center text-sm"
                            >
                              No properties are linked to this bank account yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          linkedProperties.map((property) => (
                            <TableRow
                              key={property.id}
                              className="border-border/70 hover:bg-muted/40 border-b transition-colors last:border-0"
                            >
                              <TableCell className="text-sm">
                                <Link
                                  href={`/properties/${property.id}`}
                                  className="text-primary font-medium hover:underline"
                                >
                                  {property.label}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm">{property.bankType}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </NavTabsContent>
        </NavTabs>
      </PageBody>
    </PageShell>
  );
}
