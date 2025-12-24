'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format-currency';
import { Download, FileText } from 'lucide-react';
import supabase from '@/lib/db';

type ProfitabilityRow = {
  offering_id: string;
  offering_name: string;
  category: string;
  revenue_amount: number;
  cost_amount: number;
  margin_amount: number;
  margin_percentage: number;
};

type UtilizationRow = {
  offering_id: string;
  offering_name: string;
  category: string;
  active_properties: number;
  total_properties: number;
  utilization_rate: number;
};

type ReportData = {
  profitability: ProfitabilityRow[];
  utilization: UtilizationRow[];
};

export default function ServiceReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        const claims = (data?.user?.app_metadata as { claims?: { org_ids?: (string | number)[] } } | null | undefined)
          ?.claims;
        const firstOrg = (claims?.org_ids ?? [])[0];
        if (mounted) {
          setOrgId(firstOrg != null ? String(firstOrg) : null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      if (!orgId) return;
      try {
        setLoading(true);
        const params = new URLSearchParams({ orgId, period: selectedPeriod, type: 'all' });

        const response = await fetch(`/api/dashboard/${orgId}/service-metrics?${params}`);
        const result = (await response.json()) as { data?: unknown };

        if (response.ok && result?.data && typeof result.data === 'object') {
          const profitability = Array.isArray((result.data as { profitability?: unknown }).profitability)
            ? (
                (result.data as { profitability: unknown[] }).profitability
              ).flatMap((item) => {
                if (!item || typeof item !== 'object') return [];
                const {
                  offering_id,
                  offering_name,
                  category,
                  revenue_amount,
                  cost_amount,
                  margin_amount,
                  margin_percentage,
                } = item as Record<string, unknown>;
                if (offering_id == null) return [];
                return [
                  {
                    offering_id: String(offering_id),
                    offering_name: typeof offering_name === 'string' ? offering_name : String(offering_id),
                    category: typeof category === 'string' ? category : '',
                    revenue_amount: Number(revenue_amount) || 0,
                    cost_amount: Number(cost_amount) || 0,
                    margin_amount: Number(margin_amount) || 0,
                    margin_percentage: Number(margin_percentage) || 0,
                  },
                ];
              })
            : [];

          const utilization = Array.isArray((result.data as { utilization?: unknown }).utilization)
            ? (
                (result.data as { utilization: unknown[] }).utilization
              ).flatMap((item) => {
                if (!item || typeof item !== 'object') return [];
                const {
                  offering_id,
                  offering_name,
                  category,
                  active_properties,
                  total_properties,
                  utilization_rate,
                } = item as Record<string, unknown>;
                if (offering_id == null) return [];
                return [
                  {
                    offering_id: String(offering_id),
                    offering_name: typeof offering_name === 'string' ? offering_name : String(offering_id),
                    category: typeof category === 'string' ? category : '',
                    active_properties: Number(active_properties) || 0,
                    total_properties: Number(total_properties) || 0,
                    utilization_rate: Number(utilization_rate) || 0,
                  },
                ];
              })
            : [];

          setReportData({ profitability, utilization });
        }
      } catch (err) {
        console.error('Error loading report:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [orgId, selectedPeriod]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!orgId) return;
    try {
      const params = new URLSearchParams({
        orgId,
        period: selectedPeriod,
        format,
        export: 'true',
      });
      const response = await fetch(`/api/reports/services?${params}`);
      if (!response.ok) {
        if (response.status === 501) {
          alert('PDF export is not yet implemented.');
          return;
        }
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report. Please try CSV while PDF is unavailable.');
    }
  };

  if (loading || !orgId) {
    return (
      <PageShell>
        <PageBody>
          <div className="text-muted-foreground py-12 text-center">Loading report...</div>
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
              <h1 className="text-foreground text-2xl font-bold">Service Performance Report</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Detailed service metrics, revenue, costs, and profitability analysis
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
              <Button variant="outline" onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Profitability Section */}
          {reportData?.profitability && reportData.profitability.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Service Profitability</CardTitle>
                <CardDescription>Revenue, costs, and margins by service offering</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-border overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Costs</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.profitability.map((item) => (
                        <TableRow key={item.offering_id}>
                          <TableCell className="font-medium">{item.offering_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.revenue_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.cost_amount)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              item.margin_amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(item.margin_amount)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              item.margin_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {item.margin_percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Utilization Section */}
          {reportData?.utilization && reportData.utilization.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Service Utilization</CardTitle>
                <CardDescription>Active service usage across properties and units</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-border overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Active Properties</TableHead>
                        <TableHead className="text-right">Total Properties</TableHead>
                        <TableHead className="text-right">Utilization Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.utilization.map((item) => (
                        <TableRow key={item.offering_id}>
                          <TableCell className="font-medium">{item.offering_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.active_properties}</TableCell>
                          <TableCell className="text-right">{item.total_properties}</TableCell>
                          <TableCell className="text-right">
                            {item.utilization_rate.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {(!reportData ||
            (reportData.profitability?.length === 0 && reportData.utilization?.length === 0)) && (
            <Card>
              <CardContent className="text-muted-foreground py-6 text-center">
                No report data available for the selected period.
              </CardContent>
            </Card>
          )}
        </Stack>
      </PageBody>
    </PageShell>
  );
}
