"use client"
import { useEffect } from 'react'
import { Plus, Building, TrendingUp, DollarSign, AlertTriangle, Users, Calendar, Wrench, FileText, UserCheck, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { supabase } from '@/lib/db'

export default function DashboardPage() {
  const { data, error, isLoading, refresh, orgId } = useDashboardMetrics()
  const k = data?.kpis

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
    if (!orgId) return
    const channel = supabase
      .channel(`dashboard:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders', filter: `org_id=eq.${orgId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leases', filter: `org_id=eq.${orgId}` },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, refresh])

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 p-3 flex items-center justify-between">
          <span>Couldn’t load dashboard.</span>
          <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your properties.</p>
        </div>
        <Button className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : (k?.total_properties ?? 0)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{isLoading ? '—' : `${k?.total_units ?? 0} units`}</Badge>
                  {typeof k?.growth_rate_pct === 'number' && (
                    <span className="text-xs text-muted-foreground">{k.growth_rate_pct >= 0 ? '+' : ''}{k.growth_rate_pct}%</span>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : `${k?.occupancy_rate_pct ?? 0}%`}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs bg-success text-white">{isLoading ? '—' : `${k?.occupied_units ?? 0} occupied`}</Badge>
                  <span className="text-xs text-muted-foreground">{isLoading ? '—' : `${k?.available_units ?? 0} available`}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Monthly Rent Roll</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : formatCurrency(k?.monthly_rent_roll ?? 0)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{isLoading ? '—' : `${k?.active_leases ?? 0} active leases`}</Badge>
                  {typeof k?.growth_rate_pct === 'number' && (
                    <span className="text-xs text-success">{k.growth_rate_pct >= 0 ? '+' : ''}{k.growth_rate_pct}%</span>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Open Work Orders</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : (k?.open_work_orders ?? 0)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">{isLoading ? '—' : `${k?.urgent_work_orders ?? 0} urgent`}</Badge>
                  <span className="text-xs text-muted-foreground">&nbsp;</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Lease Renewals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-destructive">{isLoading ? '—' : (data?.renewals?.critical_30 ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Critical</p>
                <p className="text-xs text-muted-foreground">≤30 days</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-warning">{isLoading ? '—' : (data?.renewals?.upcoming_60 ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upcoming</p>
                <p className="text-xs text-muted-foreground">30-60 days</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-primary">{isLoading ? '—' : (data?.renewals?.future_90 ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Future</p>
                <p className="text-xs text-muted-foreground">60-90 days</p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <UserCheck className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Property Onboarding</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-primary">{isLoading ? '—' : (data?.onboarding?.in_progress ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">In Progress</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-warning">{isLoading ? '—' : (data?.onboarding?.pending_approval ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Pending</p>
                <p className="text-xs text-muted-foreground">Approval</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-destructive">{isLoading ? '—' : (data?.onboarding?.overdue ?? 0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Overdue</p>
                <p className="text-xs text-muted-foreground">Needs attention</p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Recent Transactions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            {(data?.transactions ?? []).map((t) => {
              const isDebit = t.amount < 0
              const abs = Math.abs(t.amount)
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full ${isDebit ? 'bg-destructive/10' : 'bg-success/10'} flex items-center justify-center`}>
                      <DollarSign className={`h-4 w-4 ${isDebit ? 'text-destructive' : 'text-success'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.memo ?? 'Transaction'}</p>
                      <p className="text-xs text-muted-foreground">{t.property_name ?? '—'} • {new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={isDebit ? 'destructive' : 'default'} className={`text-xs ${isDebit ? '' : 'bg-success text-white'}`}>{isDebit ? '-' : '+'}{formatCurrency(abs)}</Badge>
                </div>
              )
            })}
            {(!isLoading && (data?.transactions?.length ?? 0) === 0) && (
              <div className="text-sm text-muted-foreground">No recent transactions.</div>
            )}
          </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Wrench className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Active Work Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            {(data?.workOrders ?? []).map((w) => {
              const urgent = (w.priority || '').toLowerCase() === 'urgent' || (w.priority || '').toLowerCase() === 'high'
              return (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full ${urgent ? 'bg-destructive/10' : 'bg-warning/10'} flex items-center justify-center`}>
                      {urgent ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Wrench className="h-4 w-4 text-warning" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{(w.priority || '').toLowerCase()} • {new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button variant="link" size="sm">open</Button>
                </div>
              )
            })}
            {(!isLoading && (data?.workOrders?.length ?? 0) === 0) && (
              <div className="text-sm text-muted-foreground">No active work orders.</div>
            )}
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
