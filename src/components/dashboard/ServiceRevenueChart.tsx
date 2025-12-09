'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/format-currency';

interface RevenueDataPoint {
  period: string;
  revenue: number;
  offering_id: string;
  offering_name: string;
}

interface ServiceRevenueChartProps {
  orgId: string;
  period: 'month' | 'quarter' | 'year';
  propertyId?: string;
}

export default function ServiceRevenueChart({
  orgId,
  period,
  propertyId,
}: ServiceRevenueChartProps) {
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [selectedOffering, setSelectedOffering] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [orgId, period, propertyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ orgId, period, type: 'revenue' });
      if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/dashboard/${orgId}/service-metrics?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load revenue data');
      }

      setData(result.data?.revenue || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Group data by period and offering
  const groupedData = data.reduce(
    (acc, item) => {
      const key = `${item.period}-${item.offering_id}`;
      if (!acc[key]) {
        acc[key] = {
          period: item.period,
          offering_id: item.offering_id,
          offering_name: item.offering_name,
          revenue: 0,
        };
      }
      acc[key].revenue += item.revenue;
      return acc;
    },
    {} as Record<
      string,
      { period: string; offering_id: string; offering_name: string; revenue: number }
    >,
  );

  const chartData = Object.values(groupedData)
    .filter((item) => selectedOffering === 'all' || item.offering_id === selectedOffering)
    .sort((a, b) => a.period.localeCompare(b.period));

  const uniqueOfferings = Array.from(new Set(data.map((d) => d.offering_id))).map((id) => {
    const item = data.find((d) => d.offering_id === id);
    return { id, name: item?.offering_name || 'Unknown' };
  });

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          Loading revenue data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-destructive text-center">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Service Revenue Trends</CardTitle>
            <CardDescription>Revenue by service offering over time</CardDescription>
          </div>
          {uniqueOfferings.length > 0 && (
            <Select value={selectedOffering} onValueChange={setSelectedOffering}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueOfferings.map((offering) => (
                  <SelectItem key={offering.id} value={offering.id}>
                    {offering.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            No revenue data available for this period.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple bar chart */}
            {chartData.map((item) => {
              const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={`${item.period}-${item.offering_id}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.offering_name}</span>
                    <span className="text-muted-foreground">{item.period}</span>
                    <span className="font-medium">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="bg-muted h-4 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
