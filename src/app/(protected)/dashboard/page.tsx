'use client';
import { useEffect } from 'react';
import {
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
import {
  PageBody,
  PageGrid,
  PageHeader,
  PageShell,
  Stack,
} from '@/components/layout/page-shell';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { supabase } from '@/lib/db';

export default function DashboardPage() {
  const { data, error, isLoading, refresh, orgId } = useDashboardMetrics();
  const k = data?.kpis;

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
            <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              <span>Couldn’t load dashboard.</span>
              <Button variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            </div>
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
                  {typeof k?.growth_rate_pct === 'number' && (
                    <span className="text-muted-foreground text-xs">
                      {k.growth_rate_pct >= 0 ? '+' : ''}
                      {k.growth_rate_pct}%
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
                  {isLoading ? '—' : `${k?.occupancy_rate_pct ?? 0}%`}
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
                  {typeof k?.growth_rate_pct === 'number' && (
                    <span className="text-success text-xs">
                      {k.growth_rate_pct >= 0 ? '+' : ''}
                      {k.growth_rate_pct}%
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <FileText className="text-primary mr-2 h-5 w-5" />
              <CardTitle>Lease Renewals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 text-center">
                <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-destructive text-lg font-bold">
                    {isLoading ? '—' : (data?.renewals?.critical_30 ?? 0)}
                  </span>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">Critical</p>
                  <p className="text-muted-foreground text-xs">≤30 days</p>
                </div>
              </div>
              <div className="space-y-2 text-center">
                <div className="bg-warning/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-warning text-lg font-bold">
                    {isLoading ? '—' : (data?.renewals?.upcoming_60 ?? 0)}
                  </span>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">Upcoming</p>
                  <p className="text-muted-foreground text-xs">30-60 days</p>
                </div>
              </div>
              <div className="space-y-2 text-center">
                <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-primary text-lg font-bold">
                    {isLoading ? '—' : (data?.renewals?.future_90 ?? 0)}
                  </span>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">Future</p>
                  <p className="text-muted-foreground text-xs">60-90 days</p>
                </div>
              </div>
            </div>
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <DollarSign className="text-primary mr-2 h-5 w-5" />
              <CardTitle>Recent Transactions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.transactions ?? []).map((t) => {
                const isDebit = t.amount < 0;
                const abs = Math.abs(t.amount);
                return (
                  <div
                    key={t.id}
                    className="bg-muted/30 flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full ${isDebit ? 'bg-destructive/10' : 'bg-success/10'} flex items-center justify-center`}
                      >
                        <DollarSign
                          className={`h-4 w-4 ${isDebit ? 'text-destructive' : 'text-success'}`}
                        />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {t.memo ?? 'Transaction'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t.property_name ?? '—'} • {new Date(t.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={isDebit ? 'destructive' : 'default'}
                      className={`text-xs ${isDebit ? '' : 'bg-success text-white'}`}
                    >
                      {isDebit ? '-' : '+'}
                      {formatCurrency(abs)}
                    </Badge>
                  </div>
                );
              })}
              {!isLoading && (data?.transactions?.length ?? 0) === 0 && (
                <div className="text-muted-foreground text-sm">No recent transactions.</div>
              )}
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
      </div>
        </Stack>
      </PageBody>
    </PageShell>
  );
}
