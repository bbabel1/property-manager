'use client';

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogFinancialSummary } from '@/types/monthly-log';
import { Body, Heading, Label } from '@/ui/typography';

interface FinancialSummaryCardProps {
  summary: MonthlyLogFinancialSummary | null;
  loading: boolean;
}

interface FinancialMetric {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
  isNegative?: boolean;
  valueClassName?: string;
  format?: (value: number) => string;
}

export default function EnhancedFinancialSummaryCard({
  summary,
  loading,
}: FinancialSummaryCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="h-3 w-3 text-green-600" />;
      case 'down':
        return <ArrowDownRight className="h-3 w-3 text-red-600" />;
      case 'stable':
        return <Minus className="h-3 w-3 text-slate-600" />;
      default:
        return null;
    }
  };

  const floatingCardClass =
    'relative rounded-2xl border border-slate-100 bg-white/95 shadow-[0_14px_35px_rgba(15,23,42,0.1)] backdrop-blur-md';

  const stickyCardClass = cn(floatingCardClass, 'sticky top-6 z-10 lg:sticky lg:top-6');

  if (loading) {
    return (
      <Card className={stickyCardClass}>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 rounded bg-slate-200"></div>
                <div className="h-4 w-16 rounded bg-slate-200"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={stickyCardClass}>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
      <CardContent>
        <div className="py-4 text-center text-slate-600">
          <Body as="p">Unable to load financial summary</Body>
          <Body as="p" size="sm" tone="muted" className="mt-1">
            Please check your connection and try again
          </Body>
        </div>
      </CardContent>
    </Card>
  );
  }

  const {
    totalCharges,
    totalCredits,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    netToOwner,
    ownerDraw,
    previousBalance,
  } = summary;

  const ledgerMetrics: FinancialMetric[] = [
    {
      label: 'Total Charges',
      value: totalCharges,
      trend: summary.chargesTrend,
    },
    {
      label: 'Total Credits',
      value: totalCredits,
      isNegative: true,
      valueClassName: 'text-slate-900',
    },
    {
      label: 'Total Payments',
      value: totalPayments,
      trend: summary.paymentsTrend,
    },
    {
      label: 'Total Bills',
      value: totalBills,
      isNegative: true,
      valueClassName: 'text-slate-900',
    },
    {
      label: 'Escrow',
      value: escrowAmount,
      format: (value) => formatCurrency(value),
      // Keep escrow value neutral (always black) per design request
      valueClassName: 'text-slate-900',
    },
    {
      label: 'Management Fees',
      value: managementFees,
      isNegative: true,
      valueClassName: 'text-slate-900',
    },
    {
      label: 'Owner Draw',
      value: Math.abs(ownerDraw ?? totalPayments - totalBills - escrowAmount),
      isNegative: true,
      valueClassName: 'text-slate-900',
    },
  ];

  const netToOwnerTrend = netToOwner > 0 ? 'up' : netToOwner < 0 ? 'down' : 'stable';

  return (
    <Card className={stickyCardClass}>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
            Lease Ledger
          </Label>
          <div className="border-b border-slate-300" />
        </div>

        {/* Ledger Metrics */}
        <div className="space-y-3">
          {ledgerMetrics.slice(0, 3).map((metric) => (
            <div key={metric.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Body as="span" size="sm" tone="muted">
                  {metric.label}
                </Body>
                {metric.trend && getTrendIcon(metric.trend)}
              </div>
              <Heading
                as="span"
                size="h6"
                className={cn(
                  metric.valueClassName ?? (metric.isNegative ? 'text-red-600' : 'text-foreground'),
                )}
              >
                {metric.format
                  ? metric.format(metric.value)
                  : `${metric.isNegative ? '-' : ''}${formatCurrency(Math.abs(metric.value))}`}
              </Heading>
            </div>
          ))}
        </div>

        <div>
          <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
            Unit Transactions
          </Label>
          <div className="border-b border-slate-300" />
        </div>

        <div className="space-y-3">
          {ledgerMetrics.slice(3).map((metric) => (
            <div key={metric.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Body as="span" size="sm" tone="muted">
                  {metric.label}
                </Body>
                {metric.trend && getTrendIcon(metric.trend)}
              </div>
              <Heading
                as="span"
                size="h6"
                className={cn(
                  metric.valueClassName ?? (metric.isNegative ? 'text-red-600' : 'text-foreground'),
                )}
              >
                {metric.format
                  ? metric.format(metric.value)
                  : `${metric.isNegative ? '-' : ''}${formatCurrency(Math.abs(metric.value))}`}
              </Heading>
            </div>
          ))}
        </div>

        {/* Previous Balance */}
        <div className="flex items-center justify-between border-t border-slate-300 pt-4">
          <Body as="span" size="sm" tone="muted">
            Previous Net to Owner
          </Body>
          <Heading
            as="span"
            size="h6"
            className={cn(
              previousBalance >= 0 ? 'text-foreground' : 'text-red-600',
            )}
          >
            {formatCurrency(previousBalance)}
          </Heading>
        </div>

        {/* Net to Owner - Highlighted */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heading as="span" size="h6">
                Net to Owner
              </Heading>
              {netToOwnerTrend && getTrendIcon(netToOwnerTrend)}
            </div>
            <Heading
              as="span"
              size="h5"
              className={cn(
                netToOwner >= 0 ? 'text-foreground' : 'text-red-600',
              )}
            >
              {formatCurrency(netToOwner)}
            </Heading>
          </div>
          {/* Remove previous month comparison for now */}
        </div>

      </CardContent>
    </Card>
  );
}
