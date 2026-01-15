'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogFinancialSummary } from '@/types/monthly-log';
import { Body, Heading, Label } from '@/ui/typography';

interface FinancialSummaryInlineProps {
  summary: MonthlyLogFinancialSummary | null;
  loading: boolean;
}

export default function FinancialSummaryInline({ summary, loading }: FinancialSummaryInlineProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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

  if (loading) {
    return (
      <Card className="border-slate-300 bg-white">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-slate-200"></div>
              <div className="h-4 w-24 rounded bg-slate-200"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-slate-200"></div>
              <div className="h-4 w-20 rounded bg-slate-200"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const { totalPayments, totalBills, netToOwner, previousBalance } = summary;
  const netToOwnerTrend = netToOwner > 0 ? 'up' : netToOwner < 0 ? 'down' : 'stable';

  return (
    <Card className="border-slate-300 bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-3">
          {/* Header with Toggle */}
          <div className="flex items-center justify-between">
            <Heading as="h3" size="h6">Financial Summary</Heading>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <Body as="span" size="xs" tone="muted" className="hidden sm:inline">
                    Collapse
                  </Body>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <Body as="span" size="xs" tone="muted" className="hidden sm:inline">
                    Expand
                  </Body>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>

          {/* Key Metrics - Always Visible */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label size="xs" tone="muted">Total Payments</Label>
              <Heading as="p" size="h6">
                {formatCurrency(totalPayments)}
              </Heading>
            </div>
            <div className="space-y-1">
              <Label size="xs" tone="muted">Total Bills</Label>
              <Heading as="p" size="h6" className="text-red-600">
                -{formatCurrency(totalBills)}
              </Heading>
            </div>
            <div className="space-y-1">
              <Label size="xs" tone="muted">Previous Balance</Label>
              <Heading
                as="p"
                className={cn(
                  previousBalance >= 0 ? 'text-foreground' : 'text-red-600',
                )}
                size="h6"
              >
                {formatCurrency(previousBalance)}
              </Heading>
            </div>
            <div className="space-y-1">
              <Label size="xs" tone="muted">Net to Owner</Label>
              <div className="flex items-center gap-1.5">
                <Heading
                  as="p"
                  size="h5"
                  className={cn(
                    netToOwner >= 0 ? 'text-foreground' : 'text-red-600',
                  )}
                >
                  {formatCurrency(netToOwner)}
                </Heading>
                {netToOwnerTrend && getTrendIcon(netToOwnerTrend)}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="space-y-3 border-t border-slate-300 pt-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label size="xs" tone="muted">Total Charges</Label>
                <Heading as="p" size="h6">
                  {formatCurrency(summary.totalCharges)}
                  {summary.chargesTrend && (
                    <span className="ml-1.5 inline-block">
                      {getTrendIcon(summary.chargesTrend)}
                    </span>
                  )}
                </Heading>
              </div>
              <div className="space-y-1">
                <Label size="xs" tone="muted">Total Credits</Label>
                <Heading as="p" size="h6">
                  -{formatCurrency(summary.totalCredits)}
                </Heading>
              </div>
              <div className="space-y-1">
                <Label size="xs" tone="muted">Escrow</Label>
                <Heading as="p" size="h6">
                  {formatCurrency(summary.escrowAmount)}
                </Heading>
              </div>
              <div className="space-y-1">
                <Label size="xs" tone="muted">Management Fees</Label>
                <Heading as="p" size="h6" className="text-red-600">
                  -{formatCurrency(summary.managementFees)}
                </Heading>
              </div>
              <div className="space-y-1">
                <Label size="xs" tone="muted">Owner Draw</Label>
                <Heading as="p" size="h6" className="text-red-600">
                  -{formatCurrency(Math.abs(summary.ownerDraw ?? 0))}
                </Heading>
              </div>
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
