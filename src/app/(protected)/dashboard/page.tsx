'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
          <Button className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
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
              <span>Couldn’t load dashboard.</span>
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
                    <p className="text-muted-foreground text-sm font-medium">Total Properties</p>
                    <p className="text-foreground text-2xl font-bold">
                      {isLoading ? '—' : (k?.total_properties ?? 0)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {isLoading ? '—' : `${k?.total_units ?? 0} units`}
                      </Badge>
                      {typeof k?.growth_rate === 'number' && (
                        <span className="text-muted-foreground text-xs">
                          {k.growth_rate >= 0 ? '+' : ''}
                          {k.growth_rate}%
                        </span>
                      )}
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
                    <p className="text-muted-foreground text-sm font-medium">Occupancy Rate</p>
                    <p className="text-foreground text-2xl font-bold">
                      {isLoading ? '—' : `${k?.occupancy_rate ?? 0}%`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-success text-xs text-white">
                        {isLoading ? '—' : `${k?.occupied_units ?? 0} occupied`}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {isLoading ? '—' : `${k?.available_units ?? 0} available`}
                      </span>
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
                    <p className="text-muted-foreground text-sm font-medium">Monthly Rent Roll</p>
                    <p className="text-foreground text-2xl font-bold">
                      {isLoading ? '—' : formatCurrency(k?.monthly_rent_roll ?? 0)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {isLoading ? '—' : `${k?.active_leases ?? 0} active leases`}
                      </Badge>
                      {typeof k?.growth_rate === 'number' && (
                        <span className="text-success text-xs">
                          {k.growth_rate >= 0 ? '+' : ''}
                          {k.growth_rate}%
                        </span>
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
                    <p className="text-muted-foreground text-sm font-medium">Open Work Orders</p>
                    <p className="text-foreground text-2xl font-bold">
                      {isLoading ? '—' : (k?.open_work_orders ?? 0)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {isLoading ? '—' : `${k?.urgent_work_orders ?? 0} urgent`}
                      </Badge>
                      <span className="text-muted-foreground text-xs">&nbsp;</span>
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
                  <span className="text-muted-foreground text-xs">Next 90 days</span>
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
                      <TabsTrigger
                        key={bucket.key}
                        value={bucket.key}
                        className="px-3 py-1 text-xs sm:text-sm"
                      >
                        {bucket.label}
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
                              <div className="w-24 text-sm text-muted-foreground">{stage.label}</div>
                              <div className="flex-1">
                                <div className="bg-muted h-3 w-full rounded-full">
                                  <div
                                    className={`${stage.color} h-3 rounded-full transition-[width] duration-300`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <div className="w-8 text-right text-sm font-semibold text-foreground">
                                {isLoading ? '—' : count}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-2 text-sm">
                          <span className="text-foreground font-semibold">
                            {isLoading
                              ? 'Loading…'
                              : `${counts.total} ${counts.total === 1 ? 'lease' : 'leases'}`}
                          </span>
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
                      <span className="text-primary text-lg font-bold">
                        {isLoading ? '—' : (data?.onboarding?.in_progress ?? 0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">In Progress</p>
                      <p className="text-muted-foreground text-xs">Active</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="bg-warning/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                      <span className="text-warning text-lg font-bold">
                        {isLoading ? '—' : (data?.onboarding?.pending_approval ?? 0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">Pending</p>
                      <p className="text-muted-foreground text-xs">Approval</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                      <span className="text-destructive text-lg font-bold">
                        {isLoading ? '—' : (data?.onboarding?.overdue ?? 0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">Overdue</p>
                      <p className="text-muted-foreground text-xs">Needs attention</p>
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
            <p className="text-muted-foreground text-xs">Last 24 hours</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txSlice.map((t) => {
                    const isDebit = t.amount < 0;
                    const abs = Math.abs(t.amount);
                    const ts = t.created_at || t.date;
                    const dateLabel = ts ? new Date(ts).toLocaleString() : '—';
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{dateLabel}</TableCell>
                        <TableCell className="text-sm">
                          {t.memo || 'Transaction'}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {t.type ? t.type.toLowerCase() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={isDebit ? 'destructive' : 'default'}
                            className={`text-xs ${isDebit ? '' : 'bg-success text-white'}`}
                          >
                            {isDebit ? '-' : '+'}
                            {formatCurrency(abs)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!isLoading && txSlice.length === 0 && (
                <div className="text-muted-foreground text-sm">
                  No transactions in the last 24 hours.
                </div>
              )}
              {isLoading && txSlice.length === 0 && (
                <div className="text-muted-foreground text-sm">Loading transactions…</div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {transactions.length} in last 24 hours
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentTxPage <= 1 || transactions.length === 0}
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Page {currentTxPage} of {txTotalPages}
                  </span>
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
                        <p className="text-foreground text-sm font-medium">{w.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {(w.priority || '').toLowerCase()} •{' '}
                          {new Date(w.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button variant="link" size="sm">
                      open
                    </Button>
                  </div>
                );
              })}
              {!isLoading && (data?.workOrders?.length ?? 0) === 0 && (
                <div className="text-muted-foreground text-sm">No active work orders.</div>
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
