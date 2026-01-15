'use client';

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, AlertCircle, DollarSign, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Body, Heading, Label } from '@/ui/typography';

interface ManagementFeesStageProps {
  monthlyLogId: string;
}

interface Fee {
  id: string;
  total_amount: number;
  memo: string;
  date: string;
}

interface ManagementFeesData {
  servicePlan: string | null;
  activeServices: string[];
  feeType: string | null;
  feePercentage: number | null;
  feeDollarAmount: number;
  billingFrequency: string | null;
  assignedFees: Fee[];
  totalFees: number;
}

export default function ManagementFeesStage({ monthlyLogId }: ManagementFeesStageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ManagementFeesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/management-fees`);
      if (!response.ok) {
        throw new Error(`Failed to fetch management fees data: ${response.status}`);
      }

      const text = await response.text();
      let result: ManagementFeesData | null = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        throw new Error('Invalid response from server');
      }
      setData(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch management fees data';
      console.error('Error fetching management fees data:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [monthlyLogId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleGenerateFee = async () => {
    try {
      setGenerating(true);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/management-fees/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const text = await response.text();
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = text ? JSON.parse(text) : {};
        } catch {
          errorData = { error: { message: `Request failed with status ${response.status}` } };
        }
        throw new Error(errorData.error?.message || 'Failed to generate management fee');
      }

      toast.success('Management fee generated successfully');
      await fetchData(); // Refresh data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate management fee';
      console.error('Error generating management fee:', err);
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Management Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between rounded-lg border border-slate-300 p-4">
              <div className="h-4 w-32 rounded bg-slate-200"></div>
              <div className="h-4 w-24 rounded bg-slate-200"></div>
            </div>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 rounded bg-slate-200"></div>
                <div className="h-3 w-16 rounded bg-slate-200"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Management Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <Body
            as="div"
            size="sm"
            className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600"
          >
            <AlertCircle className="h-5 w-5" />
            <span>{error || 'Failed to load management fees data'}</span>
          </Body>
        </CardContent>
      </Card>
    );
  }

  const configuredFeeValue = data.feeDollarAmount ?? 0;
  const hasConfiguredFee =
    data.feeType === 'Percentage'
      ? (data.feePercentage ?? 0) > 0
      : configuredFeeValue > 0;
  const hasFees = data.assignedFees.length > 0;

  return (
    <div className="space-y-6">
      {/* Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Fee Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label as="p" size="sm" tone="muted">
                  Service Plan
                </Label>
                <Body as="p" size="sm" className="mt-1">
                  {data.servicePlan || 'Not configured'}
                </Body>
              </div>
              <div>
                <Label as="p" size="sm" tone="muted">
                  Fee Type
                </Label>
                <Body as="p" size="sm" className="mt-1">
                  {data.feeType || 'Not set'}
                </Body>
              </div>
              <div>
                <Label as="p" size="sm" tone="muted">
                  Management Fee
                </Label>
                <Heading as="p" size="h5" className="mt-1 text-purple-600">
                  {configuredFeeValue > 0 ? formatCurrency(configuredFeeValue) : 'Not set'}
                </Heading>
              </div>
              <div>
                <Label as="p" size="sm" tone="muted">
                  Fee Percentage
                </Label>
                <Body as="p" size="sm" className="mt-1">
                  {data.feeType === 'Percentage'
                    ? formatPercentage(data.feePercentage)
                    : data.feeType
                      ? 'Not applicable'
                      : 'Not set'}
                </Body>
              </div>
            </div>

            {data.activeServices.length > 0 && (
              <div>
                <Label as="p" size="sm" tone="muted">
                  Active Services
                </Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.activeServices.map((service) => (
                    <span
                      key={service}
                      className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!hasConfiguredFee && (
              <Body
                as="div"
                size="sm"
                className="rounded-lg bg-amber-50 p-3 text-amber-700"
              >
                <Label as="p" size="sm">
                  No management fee configured
                </Label>
                <Body as="p" size="xs" className="mt-1">
                  Configure a management fee to generate fees automatically.
                </Body>
              </Body>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assigned Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-600" />
              Assigned Fees
            </div>
            {hasConfiguredFee && !hasFees && (
              <Button onClick={handleGenerateFee} disabled={generating} size="sm" className="gap-2">
                <DollarSign className="h-4 w-4" />
                {generating ? 'Generating...' : 'Generate Fee'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasFees ? (
            <div className="space-y-3">
              {data.assignedFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4"
                >
                  <div className="flex-1">
                    <Label as="div">{fee.memo}</Label>
                    <Body as="div" size="sm" tone="muted" className="mt-1">
                      {formatDate(fee.date)}
                    </Body>
                  </div>
                  <div className="text-right">
                    <Heading as="div" size="h5" className="text-purple-600">
                      {formatCurrency(Math.abs(fee.total_amount))}
                    </Heading>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-slate-300 pt-3">
                <Label as="span">Total Management Fees</Label>
                <Heading as="span" size="h4" className="text-purple-600">
                  {formatCurrency(data.totalFees)}
                </Heading>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Briefcase className="h-6 w-6 text-slate-400" />
              </div>
              <Heading as="h3" size="h6" className="mt-4">
                No fees assigned
              </Heading>
              <Body as="p" size="sm" tone="muted" className="mt-2">
                {hasConfiguredFee
                  ? 'Click "Generate Fee" to create a management fee for this period.'
                  : 'Configure a management fee for this unit first.'}
              </Body>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
