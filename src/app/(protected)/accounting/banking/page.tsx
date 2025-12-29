import { ChevronDown, Download } from 'lucide-react';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';
import {
  PageBody,
  PageHeader,
  PageShell,
} from '@/components/layout/page-shell';
import { supabaseAdminMaybe, type TypedSupabaseClient } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  NavTabs,
  NavTabsContent,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
} from '@/components/ui/nav-tabs';
import BankingHeaderActions from '@/components/financials/BankingHeaderActions';
import BankingStatusFilter, {
  type BankingStatus,
} from '@/components/financials/BankingStatusFilter';

export const dynamic = 'force-dynamic';

type SearchParams = {
  status?: string;
};

type BankAccountRow = {
  id: string;
  org_id: string | null;
  name: string | null;
  description: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_balance: number | null;
  is_active: boolean | null;
};

type ReconciliationRow = {
  bank_gl_account_id: string | null;
  statement_ending_date: string | null;
};

type AugmentedBankAccountRow = BankAccountRow & {
  last_reconciliation_date: string | null;
  undeposited_funds: number | null;
};

type PropertyRow = {
  id: string | number;
  operating_bank_gl_account_id: string | null;
  deposit_trust_gl_account_id: string | null;
};

type UndepositedFundsLine = {
  amount: number | null;
  posting_type: string | null;
  property_id: string | null;
  unit_id: string | null;
  gl_account_id: string | null;
  transactions?: {
    id: string | null;
    org_id: string | null;
  } | null;
  units?: {
    id: string | null;
    property_id: string | null;
  } | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(Number(amount));
}

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

function maskAccountNumber(value: string | null) {
  if (!value) return '—';
  const s = String(value);
  if (s.length <= 4) return s;
  return s.replace(/.(?=.{4}$)/g, '•');
}

function normalizeStatus(raw: unknown): BankingStatus {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'inactive') return 'inactive';
  if (value === 'all') return 'all';
  return 'active';
}

export default async function BankingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await (searchParams || Promise.resolve({}))) as Record<
    string,
    string | undefined
  >;
  const status = normalizeStatus(sp?.status);

  const supabase = await getSupabaseServerClient();
  const supabaseTyped = supabase as unknown as TypedSupabaseClient;
  const supabaseInternal = (supabaseAdminMaybe ?? supabaseTyped) as TypedSupabaseClient;

  let bankQuery = supabase
    .from('gl_accounts')
    .select(
      'id, org_id, name, description, bank_account_type, bank_account_number, bank_balance, is_active',
    )
    .eq('is_bank_account', true)
    .order('name', { ascending: true });

  if (status === 'active') {
    bankQuery = bankQuery.eq('is_active', true);
  } else if (status === 'inactive') {
    bankQuery = bankQuery.eq('is_active', false);
  }

  const { data: bankAccountsData, error } = await bankQuery;

  const bankAccounts = (bankAccountsData || []) as BankAccountRow[];

  let rows: AugmentedBankAccountRow[] = bankAccounts.map((row) => ({
    ...row,
    last_reconciliation_date: null,
    undeposited_funds: null,
  }));

  if (!error && bankAccounts.length > 0) {
    const ids = bankAccounts.map((row) => row.id);
    const { data: reconciliationData } = await supabase
      .from('reconciliation_log')
      .select('bank_gl_account_id, statement_ending_date')
      .in('bank_gl_account_id', ids);

    const lastReconciliationByAccount = new Map<string, string>();
    (reconciliationData || []).forEach((row) => {
      const r = row as ReconciliationRow;
      const accountId = r.bank_gl_account_id;
      const date = r.statement_ending_date;
      if (!accountId || !date) return;
      const current = lastReconciliationByAccount.get(accountId);
      if (!current || current < date) {
        lastReconciliationByAccount.set(accountId, date);
      }
    });

    rows = rows.map((row) => ({
      ...row,
      last_reconciliation_date: lastReconciliationByAccount.get(row.id) ?? row.last_reconciliation_date,
    }));
  }

  // Populate live balances (debits minus credits) into bank_balance for display.
  if (rows.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const balanceResults = await Promise.all(
      rows.map(async (row) => {
        if (!row.org_id) return { id: row.id, balance: row.bank_balance };
        const balanceArgs: Database['public']['Functions']['gl_account_balance_as_of']['Args'] = {
          p_org_id: row.org_id,
          p_gl_account_id: row.id,
          p_as_of: today,
          p_property_id: undefined,
        };
        const { data, error: balanceError } = await supabaseTyped.rpc('gl_account_balance_as_of', balanceArgs);
        if (balanceError) {
          console.error('Failed to compute balance for bank account', row.id, balanceError);
          return { id: row.id, balance: row.bank_balance };
        }
        return { id: row.id, balance: typeof data === 'number' ? data : row.bank_balance };
      }),
    );

    const balanceById = new Map<string, number | null>();
    balanceResults.forEach((result) => {
      balanceById.set(result.id, result.balance ?? null);
    });

    rows = rows.map((row) => ({
      ...row,
      bank_balance: balanceById.get(row.id) ?? row.bank_balance,
    }));
  }

  // Populate undeposited funds totals sitting in org-level Undeposited Funds accounts.
  if (rows.length > 0) {
    const bankIds = new Set(rows.map((row) => row.id));
    const banksByOrg = new Map<string | null, string[]>();
    rows.forEach((row) => {
      const orgKey = row.org_id ? String(row.org_id) : null;
      const list = banksByOrg.get(orgKey) ?? [];
      list.push(row.id);
      banksByOrg.set(orgKey, list);
    });

    const orgIds = Array.from(new Set(rows.map((row) => row.org_id).filter(Boolean).map(String)));
    const udfByOrg = new Map<string, string>();
    await Promise.all(
      orgIds.map(async (orgId) => {
        const udfGlId = await resolveUndepositedFundsGlAccountId(supabaseTyped, orgId);
        if (udfGlId) udfByOrg.set(orgId, udfGlId);
      }),
    );

    const udfGlAccountIds = Array.from(new Set(udfByOrg.values()));
    if (udfGlAccountIds.length > 0) {
      const bankIdsByProperty = new Map<string, string[]>();
      if (orgIds.length > 0) {
        const { data: propertiesData } = await supabase
          .from('properties')
          .select('id, operating_bank_gl_account_id, deposit_trust_gl_account_id')
          .in('org_id', orgIds)
          .limit(5000);

        const properties = (propertiesData || []) as PropertyRow[];
        properties.forEach((property) => {
          if (!property?.id) return;
          const ids = [property.operating_bank_gl_account_id, property.deposit_trust_gl_account_id]
            .filter(Boolean)
            .map(String)
            .filter((id) => bankIds.has(id));
          bankIdsByProperty.set(String(property.id), ids);
        });
      }

      const { data: udfLines, error: udfLinesError } = await supabaseInternal
        .from('transaction_lines')
        .select(
          `
          amount,
          posting_type,
          property_id,
          unit_id,
          gl_account_id,
          transactions!inner(
            id,
            org_id
          ),
          units:units(
            id,
            property_id
          )
        `,
        )
        .in('gl_account_id', udfGlAccountIds)
        .in('transactions.org_id', orgIds)
        .limit(10000);

      if (udfLinesError) {
        console.error('Failed to load undeposited funds lines for banking page', udfLinesError);
      } else {
        const undepositedByBank = new Map<string, number>();

        const lines = (udfLines || []) as UndepositedFundsLine[];
        lines.forEach((line) => {
          const rawAmount = Math.abs(Number(line?.amount ?? NaN));
          if (!Number.isFinite(rawAmount) || rawAmount === 0) return;
          const posting = String(line?.posting_type || '').toLowerCase() === 'credit' ? -rawAmount : rawAmount;

          const linePropertyId = line?.property_id ? String(line.property_id) : null;
          const unitPropertyId = line?.units?.property_id ? String(line.units.property_id) : null;
          const propertyId = linePropertyId || unitPropertyId || null;

          const orgKey = line?.transactions?.org_id ? String(line.transactions.org_id) : null;
          const allowedBankIds =
            propertyId && bankIdsByProperty.has(propertyId) ? bankIdsByProperty.get(propertyId)! : [];
          const fallbackBanks = banksByOrg.get(orgKey) || [];

          const targetBankIds = (allowedBankIds.length > 0 ? allowedBankIds : fallbackBanks).filter((id) =>
            bankIds.has(id),
          );
          if (targetBankIds.length === 0) return;

          targetBankIds.forEach((bankId) => {
            const next = (undepositedByBank.get(bankId) ?? 0) + posting;
            undepositedByBank.set(bankId, next);
          });
        });

        rows = rows.map((row) => {
          const orgKey = row.org_id ? String(row.org_id) : null;
          const hasUdf = orgKey ? udfByOrg.has(orgKey) : false;
          const rawValue = undepositedByBank.get(row.id);
          const value = rawValue != null && Math.abs(rawValue) < 0.0001 ? 0 : rawValue;
          return {
            ...row,
            undeposited_funds: value != null ? value : hasUdf ? 0 : row.undeposited_funds,
          };
        });
      }
    }
  }

  const matchLabel = rows.length === 1 ? 'match' : 'matches';

  const renderBankAccountsTab = () => (
    <Card className="border-border/70 border shadow-sm">
      <CardContent className="flex flex-col gap-0 p-0">
        <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <BankingStatusFilter initialStatus={status} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3"
          >
            Add filter option
            <ChevronDown className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="border-border/70 text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm">
          <span>
            {rows.length} {matchLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-3"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-widest">
                <TableHead className="text-muted-foreground w-[18rem]">
                  Name
                </TableHead>
                <TableHead className="text-muted-foreground w-[10rem]">
                  Account number
                </TableHead>
                <TableHead className="text-muted-foreground w-[10rem]">
                  EPay enabled
                </TableHead>
                <TableHead className="text-muted-foreground w-[12rem]">
                  Retail cash enabled
                </TableHead>
                <TableHead className="text-muted-foreground w-[12rem]">
                  Last reconciliation date
                </TableHead>
                <TableHead className="text-muted-foreground w-[10rem]">
                  Undeposited funds
                </TableHead>
                <TableHead className="text-muted-foreground w-[10rem] text-right">
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-10 text-center text-sm"
                  >
                    We didn&apos;t find any bank accounts. Try adjusting your
                    filters or add a new bank account.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRowLink
                    key={row.id}
                    href={`/bank-accounts/${row.id}`}
                    className="border-border/70 bg-background hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <TableCell className="align-top">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-primary">
                          {row.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.description || 'Bank account'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {maskAccountNumber(row.bank_account_number)}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {/* Placeholder until ElectronicPayments payload is surfaced */}
                      —
                    </TableCell>
                    <TableCell className="align-top text-sm">—</TableCell>
                    <TableCell className="align-top text-sm">
                      {formatDate(row.last_reconciliation_date)}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {row.undeposited_funds == null
                        ? '—'
                        : formatCurrency(row.undeposited_funds)}
                    </TableCell>
                    <TableCell className="align-top text-right text-sm">
                      {formatCurrency(row.bank_balance)}
                    </TableCell>
                  </TableRowLink>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderCreditCardsTab = () => (
    <Card className="border-border/70 border shadow-sm">
      <CardContent className="flex items-center justify-center py-16">
        <div className="space-y-2 text-center">
          <h2 className="text-lg font-semibold text-foreground">Credit cards</h2>
          <p className="text-sm text-muted-foreground">
            Tracking for credit card accounts will appear here in a future
            update.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageShell>
      <PageHeader
        title="Banking"
        description="Review your bank accounts and balances."
        actions={<BankingHeaderActions />}
      />
      <PageBody>
        <NavTabs defaultValue="bank-accounts">
          <NavTabsHeader>
            <NavTabsList>
              <NavTabsTrigger value="bank-accounts">
                Bank accounts
              </NavTabsTrigger>
              <NavTabsTrigger value="credit-cards">
                Credit cards
              </NavTabsTrigger>
            </NavTabsList>
          </NavTabsHeader>
          <NavTabsContent value="bank-accounts">
            {renderBankAccountsTab()}
          </NavTabsContent>
          <NavTabsContent value="credit-cards">
            {renderCreditCardsTab()}
          </NavTabsContent>
        </NavTabs>
      </PageBody>
    </PageShell>
  );
}
