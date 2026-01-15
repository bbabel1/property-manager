'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  Plus,
  Building,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Wrench,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import {
  Cluster,
  PageBody,
  PageGrid,
  PageHeader,
  PageShell,
  Stack,
} from '@/components/layout/page-shell';
import { ExpiringLeaseBucketKey, ExpiringLeaseCounts, useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { supabase } from '@/lib/db';
import { amountToneClassName, formatAmountDisplay } from '@/lib/amount-formatting';
import { formatCurrency } from '@/lib/format-currency';
import { Body, Heading, Label } from '@/ui/typography';

type ExpiringStageKey = 'notStarted' | 'offers' | 'renewals' | 'moveOuts';

const EXPIRING_STAGE_CONFIG: { key: ExpiringStageKey; label: string; color: string }[] = [
  { key: 'notStarted', label: 'Not started', color: 'bg-slate-300' },
  { key: 'offers', label: 'Offers', color: 'bg-sky-400' },
  { key: 'renewals', label: 'Renewals', color: 'bg-primary' },
  { key: 'moveOuts', label: 'Move-outs', color: 'bg-violet-500' },
];

const EXPIRING_BUCKETS_DEFAULT: Array<{ key: ExpiringLeaseBucketKey; label: string }> = [
  { key: '0_30', label: '0 - 30 days' },
  { key: '31_60', label: '31 - 60 days' },
  { key: '61_90', label: '61 - 90 days' },
  { key: 'all', label: 'All' },
];

const makeEmptyExpiringCounts = (): ExpiringLeaseCounts => ({
  notStarted: 0,
  offers: 0,
  renewals: 0,
  moveOuts: 0,
  total: 0,
});

export default function DashboardPage() {
  const { data, error, isLoading, refresh, orgId } = useDashboardMetrics();
  const k = data?.kpis;
  const [selectedExpiringBucket, setSelectedExpiringBucket] =
    useState<ExpiringLeaseBucketKey>('0_30');
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 5;
  const transactions = data?.transactions ?? [];
  const txTotalPages = transactions.length ? Math.ceil(transactions.length / TX_PAGE_SIZE) : 1;
  const currentTxPage = Math.min(txPage, txTotalPages);
  const txSlice = transactions.slice((currentTxPage - 1) * TX_PAGE_SIZE, currentTxPage * TX_PAGE_SIZE);

  const expiringBuckets = useMemo(() => {
    const fromApi = data?.expiringLeases?.buckets ?? [];
    return EXPIRING_BUCKETS_DEFAULT.map((bucket) => {
      const match = fromApi.find((b) => b.key === bucket.key);
      return {
        ...bucket,
        counts: match?.counts ? { ...makeEmptyExpiringCounts(), ...match.counts } : makeEmptyExpiringCounts(),
      };
    });
  }, [data?.expiringLeases]);

  const router = useRouter();

  const resolveTransactionHref = (t: (typeof transactions)[number]) => {
    const type = (t.type || '').toLowerCase();
    const bankAccountId = t.bank_gl_account_id ? String(t.bank_gl_account_id) : null;
    const leaseId = t.lease_id ? String(t.lease_id) : null;
    const hasCheckNumber = Boolean(t.reference_number || t.check_number);
    const isTransferLike =
      type === 'transfer' || type === 'other' || type === 'electronicfundstransfer';
    const paymentMethod = (t.payment_method || '').toLowerCase();

    if (bankAccountId) {
      if (type === 'deposit') {
        return `/bank-accounts/${bankAccountId}/deposits/${t.id}`;
      }
      if (type === 'check' || (type === 'payment' && (hasCheckNumber || paymentMethod === 'check'))) {
        return `/bank-accounts/${bankAccountId}/checks/${t.id}`;
      }
      if (isTransferLike) {
        return `/bank-accounts/${bankAccountId}/transfers/${t.id}`;
      }
      return `/bank-accounts/${bankAccountId}/other-transactions/${t.id}`;
    }

    if (leaseId && type === 'charge') {
      return `/leases/${leaseId}/edit-charge?transactionId=${t.id}`;
    }

    return null;
  };

  // Optional realtime refresh: subscribe to base tables for this org
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`dashboard:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders', filter: `org_id=eq.${orgId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leases', filter: `org_id=eq.${orgId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, refresh]);

  useEffect(() => {
    setTxPage(1);
  }, [transactions.length]);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your properties."
        actions={
          <Button asChild className="flex items-center">
            <Link href="/properties" className="flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Link>
          </Button>
        }
      />
      <PageBody>
        <Stack gap="lg">
          {error && (
            <Cluster
              justify="between"
              align="center"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-red-700"
            >
              <Body as="span" size="sm">
                Couldn’t load dashboard.
              </Body>
              <Button variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            </Cluster>
          )}
          <PageGrid columns={4}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label size="sm" tone="muted">Total Properties</Label>
                      <span className="status-pill status-pill-success px-2 py-0.5 text-[11px]">
                        Active
                      </span>
                    </div>
                    <Heading as="p" size="h3">
                      {isLoading ? '—' : (k?.total_properties ?? 0)}
                    </Heading>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {isLoading ? '—' : `${k?.total_units ?? 0} active units`}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Building className="text-primary h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label size="sm" tone="muted">Occupancy Rate</Label>
                    <Heading as="p" size="h3">
                      {isLoading ? '—' : `${k?.occupancy_rate ?? 0}%`}
                    </Heading>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="text-xs">
                        {isLoading ? '—' : `${k?.occupied_units ?? 0} occupied`}
                      </Badge>
                      <Body size="xs" tone="muted">
                        {isLoading ? '—' : `${k?.available_units ?? 0} available`}
                      </Body>
                    </div>
                  </div>
                  <div className="bg-success/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <TrendingUp className="text-success h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label size="sm" tone="muted">Monthly Rent Roll</Label>
                    <Heading as="p" size="h3">
                      {isLoading ? '—' : formatCurrency(k?.monthly_rent_roll ?? 0)}
                    </Heading>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {isLoading ? '—' : `${k?.active_leases ?? 0} active leases`}
                      </Badge>
                      {typeof k?.growth_rate === 'number' && (
                        <Body size="xs" className="text-success">
                          {k.growth_rate >= 0 ? '+' : ''}
                          {k.growth_rate}%
                        </Body>
                      )}
                    </div>
                  </div>
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <DollarSign className="text-primary h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label size="sm" tone="muted">Open Work Orders</Label>
                    <Heading as="p" size="h3">
                      {isLoading ? '—' : (k?.open_work_orders ?? 0)}
                    </Heading>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {isLoading ? '—' : `${k?.urgent_work_orders ?? 0} urgent`}
                      </Badge>
                      <Body size="xs" tone="muted">&nbsp;</Body>
                    </div>
                  </div>
                  <div className="bg-warning/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <AlertTriangle className="text-warning h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageGrid>

          <PageGrid columns={2}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="text-primary mr-2 h-5 w-5" />
                    <CardTitle>Expiring Leases</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={selectedExpiringBucket}
                  onValueChange={(value) =>
                    setSelectedExpiringBucket(value as ExpiringLeaseBucketKey)
                  }
                  className="space-y-4"
                >
                  <TabsList>
                    {expiringBuckets.map((bucket) => (
                      <TabsTrigger key={bucket.key} value={bucket.key} className="px-3 py-1">
                        <Label as="span" size="sm">
                          {bucket.label}
                        </Label>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {expiringBuckets.map((bucket) => {
                    const counts = bucket.counts ?? makeEmptyExpiringCounts();
                    const maxCount = Math.max(
                      ...EXPIRING_STAGE_CONFIG.map((stage) => counts[stage.key]),
                      1,
                    );
                    return (
                      <TabsContent key={bucket.key} value={bucket.key} className="space-y-3">
                        {EXPIRING_STAGE_CONFIG.map((stage) => {
                          const count = counts[stage.key];
                          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          return (
                            <div className="flex items-center gap-3" key={stage.key}>
                              <Body as="div" size="sm" tone="muted" className="w-24">
                                {stage.label}
                              </Body>
                              <div className="flex-1">
                                <div className="bg-muted h-3 w-full rounded-full">
                                  <div
                                    className={`${stage.color} h-3 rounded-full transition-[width] duration-300`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <Heading as="div" size="h6" className="w-8 text-right">
                                {isLoading ? '—' : count}
                              </Heading>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-2">
                          <Heading as="span" size="h6">
                            {isLoading
                              ? 'Loading…'
                              : `${counts.total} ${counts.total === 1 ? 'lease' : 'leases'}`}
                          </Heading>
                          <Button variant="link" size="sm" className="px-0 text-primary" asChild>
                            <Link href="/leases" className="inline-flex items-center gap-1">
                              View all
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <UserCheck className="text-primary mr-2 h-5 w-5" />
                  <CardTitle>Property Onboarding</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <div className="space-y-2 text-center">
                    <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                      <Heading as="span" size="h5" className="text-primary">
                        {isLoading ? '—' : (data?.onboarding?.in_progress ?? 0)}
                      </Heading>
                    </div>
                    <div>
                      <Label size="sm">In Progress</Label>
                      <Body size="xs" tone="muted">Active</Body>
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="bg-warning/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                      <Heading as="span" size="h5" className="text-warning">
                        {isLoading ? '—' : (data?.onboarding?.pending_approval ?? 0)}
                      </Heading>
                    </div>
                    <div>
                      <Label size="sm">Pending</Label>
                      <Body size="xs" tone="muted">Approval</Body>
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                      <Heading as="span" size="h5" className="text-destructive">
                        {isLoading ? '—' : (data?.onboarding?.overdue ?? 0)}
                      </Heading>
                    </div>
                    <div>
                      <Label size="sm">Overdue</Label>
                      <Body size="xs" tone="muted">Needs attention</Body>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageGrid>

          <PageGrid columns={2}>
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <DollarSign className="text-primary mr-2 h-5 w-5" />
              <CardTitle>Recent Transactions</CardTitle>
            </div>
            <Body size="xs" tone="muted">Last 7 days</Body>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Label as="span" size="xs" tone="muted">
                        Date
                      </Label>
                    </TableHead>
                    <TableHead>
                      <Label as="span" size="xs" tone="muted">
                        Description
                      </Label>
                    </TableHead>
                    <TableHead>
                      <Label as="span" size="xs" tone="muted">
                        Type
                      </Label>
                    </TableHead>
                    <TableHead className="text-right">
                      <Label as="span" size="xs" tone="muted">
                        Amount
                      </Label>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txSlice.map((t) => {
                    const amount = Number(t.amount ?? 0);
                    const amountDisplay = formatAmountDisplay(amount, { useParensForNegative: true });
                    const ts = t.created_at || t.date;
                    const dateLabel = ts ? new Date(ts).toLocaleDateString() : '—';
                    const href = resolveTransactionHref(t);

                    const handleClick = () => {
                      if (href) router.push(href);
                    };

                    const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                      if (!href) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(href);
                      }
                    };

                    return (
                      <TableRow
                        key={t.id}
                        className={href ? 'cursor-pointer' : undefined}
                        role={href ? 'link' : undefined}
                        tabIndex={href ? 0 : undefined}
                        onClick={href ? handleClick : undefined}
                        onKeyDown={href ? handleKeyDown : undefined}
                      >
                        <TableCell>
                          <Body as="span" size="sm">
                            {dateLabel}
                          </Body>
                        </TableCell>
                        <TableCell>
                          <Body as="span" size="sm">
                            {t.memo || 'Transaction'}
                          </Body>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Body as="span" size="sm">
                            {t.type ? t.type.toLowerCase() : '—'}
                          </Body>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right',
                            amountToneClassName(amountDisplay.tone),
                          )}
                        >
                          <Body as="span" size="sm" className={amountToneClassName(amountDisplay.tone)}>
                            {amountDisplay.display}
                          </Body>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!isLoading && txSlice.length === 0 && (
                <Body size="sm" tone="muted">
                  No transactions in the last 7 days.
                </Body>
              )}
              {isLoading && txSlice.length === 0 && (
                <Body size="sm" tone="muted">Loading transactions…</Body>
              )}
              <div className="flex items-center justify-between">
                <Body size="xs" tone="muted">
                  {transactions.length} in last 7 days
                </Body>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentTxPage <= 1 || transactions.length === 0}
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Body size="xs" tone="muted">
                    Page {currentTxPage} of {txTotalPages}
                  </Body>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={transactions.length === 0 || currentTxPage >= txTotalPages}
                    onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Wrench className="text-primary mr-2 h-5 w-5" />
              <CardTitle>Active Work Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.workOrders ?? []).map((w) => {
                const urgent =
                  (w.priority || '').toLowerCase() === 'urgent' ||
                  (w.priority || '').toLowerCase() === 'high';
                return (
                  <div
                    key={w.id}
                    className="bg-muted/30 flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full ${urgent ? 'bg-destructive/10' : 'bg-warning/10'} flex items-center justify-center`}
                      >
                        {urgent ? (
                          <AlertTriangle className="text-destructive h-4 w-4" />
                        ) : (
                          <Wrench className="text-warning h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <Label size="sm">{w.title}</Label>
                        <Body size="xs" tone="muted">
                          {(w.priority || '').toLowerCase()} •{' '}
                          {new Date(w.created_at).toLocaleDateString()}
                        </Body>
                      </div>
                    </div>
                    <Button variant="link" size="sm" asChild>
                      <Link href="/maintenance">Open</Link>
                    </Button>
                  </div>
                );
              })}
              {!isLoading && (data?.workOrders?.length ?? 0) === 0 && (
                <Body size="sm" tone="muted">No active work orders.</Body>
              )}
            </div>
          </CardContent>
        </Card>
      </PageGrid>
        </Stack>
      </PageBody>
    </PageShell>
  );
}
