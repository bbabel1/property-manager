'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ServiceProfitabilityData {
  offering_id: string;
  offering_name: string;
  category: string;
  revenue_amount: number;
  cost_amount: number;
  margin_amount: number;
  margin_percentage: number;
}

interface ServiceProfitabilityCardProps {
  orgId: string;
  period: 'month' | 'quarter' | 'year';
  propertyId?: string;
}

export default function ServiceProfitabilityCard({
  orgId,
  period,
  propertyId,
}: ServiceProfitabilityCardProps) {
  const [data, setData] = useState<ServiceProfitabilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [orgId, period, propertyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ orgId, period });
      if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/dashboard/${orgId}/service-metrics?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load profitability data');
      }

      setData(result.data?.profitability || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          Loading profitability data...
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

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue_amount, 0);
  const totalCost = data.reduce((sum, item) => sum + item.cost_amount, 0);
  const totalMargin = totalRevenue - totalCost;
  const totalMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Profitability</CardTitle>
        <CardDescription>
          Revenue, costs, and margins by service offering for {period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-sm">Total Revenue</div>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Total Costs</div>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Net Margin</div>
            <div
              className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(totalMargin)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Margin %</div>
            <div
              className={`text-2xl font-bold ${totalMarginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {totalMarginPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Table */}
        {data.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            No profitability data available for this period.
          </div>
        ) : (
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
                {data
                  .sort((a, b) => b.margin_amount - a.margin_amount)
                  .map((item) => (
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
                        <div className="flex items-center justify-end gap-1">
                          {item.margin_amount >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatCurrency(item.margin_amount)}
                        </div>
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
        )}
      </CardContent>
    </Card>
  );
}
