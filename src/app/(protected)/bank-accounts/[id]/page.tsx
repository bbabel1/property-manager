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
import type { Database } from '@/types/database';
import Link from 'next/link';

type SearchParams = {
  from?: string;
  to?: string;
  range?: string;
};

type BankAccountDetail = {
  id: string;
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
};

type VendorRecord = {
  id: string;
  buildium_vendor_id?: number | null;
  contact?:
    | {
        display_name?: string;
        company_name?: string;
        first_name?: string;
        last_name?: string;
      }
    | {
        display_name?: string;
        company_name?: string;
        first_name?: string;
        last_name?: string;
      }[]
    | null;
};

type DisplayTransactionRow = {
  id: string;
  dateLabel: string;
  numberLabel: string;
  paidByLabel: string;
  paidToLabel: string;
  memoLabel: string;
  paymentAmount: number;
  depositAmount: number;
  balanceAfter: number;
  transactionType: string;
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

  const defaultTo = endOfMonth(today);
  const defaultFrom = startOfMonth(today);

  const to = sp?.to ? new Date(sp.to) : defaultTo;
  const from = sp?.from ? new Date(sp.from) : defaultFrom;
  const range = hasRangeParam ? sp.range! : hasExplicitDates ? 'custom' : 'currentMonth';

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const db = supabaseAdmin || supabase;

  const [{ data: account, error: accountError }, { data: txData, error: txError }] =
    await Promise.all([
      db
        .from('gl_accounts')
        .select(
          'id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_balance, bank_buildium_balance, buildium_gl_account_id, is_active, bank_country, bank_check_printing_info',
        )
        .eq('id', id)
        .eq('is_bank_account', true)
        .maybeSingle<BankAccountDetail>(),
      db
        .from('v_bank_register_transactions')
        .select(
          'id, date, reference_number, memo, total_amount, transaction_type, vendor_id, bank_gl_account_id, bank_amount, bank_posting_type, paid_by_label, paid_to_name',
        )
        .eq('bank_gl_account_id', id)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true })
        .range(0, 199),
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

  const bankAccount = account as BankAccountDetail;
  const transactions = (txData || []) as BankTransactionRow[];

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

  let runningBalance = 0;
  const displayRows: DisplayTransactionRow[] = transactions.map((row) => {
    const { paymentAmount, depositAmount } = splitPaymentAndDeposit(
      row.transaction_type,
      row.bank_amount ?? row.total_amount,
      row.bank_posting_type,
      row.bank_amount,
    );

    runningBalance += depositAmount - paymentAmount;

    return {
      id: row.id ? String(row.id) : `${row.date ?? 'tx'}-${Math.random().toString(36).slice(2)}`,
      dateLabel: formatDate(row.date),
      numberLabel: row.reference_number || '—',
      paidByLabel: row.paid_by_label || '—',
      paidToLabel: row.paid_to_name || '—',
      memoLabel: row.memo || '—',
      paymentAmount,
      depositAmount,
      balanceAfter: runningBalance,
      transactionType: String(row.transaction_type ?? ''),
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
        <NavTabs defaultValue="transactions" className="space-y-6">
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
                            <TableHead className="text-muted-foreground w-[6rem]">Num</TableHead>
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
                              const txType = String(row.transactionType || '').toLowerCase();
                              const isDeposit = txType === 'deposit';
                              const isCheck =
                                txType === 'check' || (txType === 'payment' && row.numberLabel !== '—');
                              const href =
                                isDeposit
                                  ? `/bank-accounts/${bankAccount.id}/deposits/${row.id}`
                                  : isCheck
                                    ? `/bank-accounts/${bankAccount.id}/checks/${row.id}`
                                    : '#';
                              return (
                                <TableRowLink
                                  key={row.id}
                                  href={href}
                                  className="border-border/70 bg-background hover:bg-muted/40 border-b transition-colors last:border-0"
                                >
                                  <TableCell className="align-top text-sm">{row.dateLabel}</TableCell>
                                  <TableCell className="align-top text-sm">{row.numberLabel}</TableCell>
                                  <TableCell className="align-top text-sm">{row.paidByLabel}</TableCell>
                                  <TableCell className="align-top text-sm">{row.paidToLabel}</TableCell>
                                  <TableCell className="align-top text-sm">{row.memoLabel}</TableCell>
                                  <TableCell className="text-right align-top text-sm">
                                    {row.paymentAmount > 0 ? formatCurrency(row.paymentAmount) : '—'}
                                  </TableCell>
                                  <TableCell className="text-right align-top text-sm">
                                    {row.depositAmount > 0 ? formatCurrency(row.depositAmount) : '—'}
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
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Balance breakdown for this bank account will appear here in a future update.
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
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Properties linked to this bank account will appear here in a future update.
              </CardContent>
            </Card>
          </NavTabsContent>
        </NavTabs>
      </PageBody>
    </PageShell>
  );
}
