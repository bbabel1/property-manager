'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogFinancialSummary } from '@/types/monthly-log';

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
            <h3 className="text-sm font-semibold text-slate-900">Financial Summary</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-600 hover:text-slate-900"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <span className="hidden sm:inline">Collapse</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Expand</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>

          {/* Key Metrics - Always Visible */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-600">Total Payments</p>
              <p className="text-base font-semibold text-slate-900">
                {formatCurrency(totalPayments)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-600">Total Bills</p>
              <p className="text-base font-semibold text-red-600">-{formatCurrency(totalBills)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-600">Previous Balance</p>
              <p
                className={cn(
                  'text-base font-semibold',
                  previousBalance >= 0 ? 'text-slate-900' : 'text-red-600',
                )}
              >
                {formatCurrency(previousBalance)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-600">Net to Owner</p>
              <div className="flex items-center gap-1.5">
                <p
                  className={cn(
                    'text-lg font-bold',
                    netToOwner >= 0 ? 'text-slate-900' : 'text-red-600',
                  )}
                >
                  {formatCurrency(netToOwner)}
                </p>
                {netToOwnerTrend && getTrendIcon(netToOwnerTrend)}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="space-y-3 border-t border-slate-300 pt-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Total Charges</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(summary.totalCharges)}
                    {summary.chargesTrend && (
                      <span className="ml-1.5 inline-block">
                        {getTrendIcon(summary.chargesTrend)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Total Credits</p>
                  <p className="text-sm font-semibold text-slate-900">
                    -{formatCurrency(summary.totalCredits)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Escrow</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(summary.escrowAmount)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Management Fees</p>
                  <p className="text-sm font-semibold text-red-600">
                    -{formatCurrency(summary.managementFees)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Owner Draw</p>
                  <p className="text-sm font-semibold text-red-600">
                    -{formatCurrency(Math.abs(summary.ownerDraw ?? 0))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
