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
import { Progress } from '@/components/ui/progress';

interface UtilizationData {
  offering_id: string;
  offering_name: string;
  category: string;
  total_properties: number;
  active_properties: number;
  total_units: number;
  active_units: number;
  utilization_rate: number;
}

interface ServiceUtilizationCardProps {
  orgId: string;
  period: 'month' | 'quarter' | 'year';
  propertyId?: string;
}

export default function ServiceUtilizationCard({
  orgId,
  period,
  propertyId,
}: ServiceUtilizationCardProps) {
  const [data, setData] = useState<UtilizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, period, propertyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ orgId, period, type: 'utilization' });
      if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/dashboard/${orgId}/service-metrics?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load utilization data');
      }

      setData(result.data?.utilization || []);
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
          Loading utilization data...
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
        <CardTitle>Service Utilization</CardTitle>
        <CardDescription>
          Active service usage across properties and units for {period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            No utilization data available for this period.
          </div>
        ) : (
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Active Properties</TableHead>
                  <TableHead className="text-right">Total Properties</TableHead>
                  <TableHead className="text-right">Active Units</TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data
                  .sort((a, b) => b.utilization_rate - a.utilization_rate)
                  .map((item) => (
                    <TableRow key={item.offering_id}>
                      <TableCell className="font-medium">{item.offering_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.active_properties}</TableCell>
                      <TableCell className="text-right">{item.total_properties}</TableCell>
                      <TableCell className="text-right">{item.active_units}</TableCell>
                      <TableCell className="text-right">{item.total_units}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={item.utilization_rate} className="h-2 flex-1" />
                          <span className="w-12 text-right text-sm font-medium">
                            {item.utilization_rate.toFixed(0)}%
                          </span>
                        </div>
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
