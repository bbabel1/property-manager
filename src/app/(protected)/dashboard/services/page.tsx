'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import ServiceProfitabilityCard from '@/components/dashboard/ServiceProfitabilityCard';
import ServiceRevenueChart from '@/components/dashboard/ServiceRevenueChart';
import ServiceUtilizationCard from '@/components/dashboard/ServiceUtilizationCard';
import { TrendingUp, DollarSign, BarChart3, Download } from 'lucide-react';
import supabase from '@/lib/db';

export default function ServiceDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        const claims = (data?.user?.app_metadata as any)?.claims;
        const firstOrg = (claims?.org_ids ?? [])[0] as string | undefined;
        if (mounted) {
          setOrgId(firstOrg || null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !orgId) {
    return (
      <PageShell>
        <PageBody>
          <div className="text-muted-foreground py-12 text-center">Loading dashboard...</div>
        </PageBody>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBody>
        <Stack gap="lg">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold">Service Performance Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Track revenue, costs, and profitability across all service offerings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedPeriod}
                onValueChange={(v) => setSelectedPeriod(v as 'month' | 'quarter' | 'year')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Service Revenue</CardTitle>
                <DollarSign className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-muted-foreground text-xs">Loading...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Service Costs</CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-muted-foreground text-xs">Loading...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Margin</CardTitle>
                <BarChart3 className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0%</div>
                <p className="text-muted-foreground text-xs">Loading...</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="profitability" className="space-y-4">
            <TabsList>
              <TabsTrigger value="profitability">Profitability</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="utilization">Utilization</TabsTrigger>
            </TabsList>

            <TabsContent value="profitability" className="space-y-4">
              <ServiceProfitabilityCard orgId={orgId} period={selectedPeriod} />
            </TabsContent>

            <TabsContent value="revenue" className="space-y-4">
              <ServiceRevenueChart orgId={orgId} period={selectedPeriod} />
            </TabsContent>

            <TabsContent value="utilization" className="space-y-4">
              <ServiceUtilizationCard orgId={orgId} period={selectedPeriod} />
            </TabsContent>
          </Tabs>
        </Stack>
      </PageBody>
    </PageShell>
  );
}
