'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinancialSummaryCardProps {
  monthlyLogId: string;
}

interface FinancialSummary {
  totalCharges: number;
  totalCredits: number;
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
  managementFees: number;
  netToOwner: number;
  balance: number;
  previousBalance: number;
}

export default function FinancialSummaryCard({ monthlyLogId }: FinancialSummaryCardProps) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/financial-summary`);
        if (response.ok) {
          const text = await response.text();
          let data: FinancialSummary | null = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            console.error('Failed to parse financial summary response');
            data = null;
          }
          setSummary(data);
        } else {
          console.error('Failed to fetch financial summary:', response.status, response.statusText);
          setSummary(null);
        }
      } catch (error) {
        console.error('Error fetching financial summary:', error);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [monthlyLogId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const floatingCardClass =
    'relative rounded-2xl border border-slate-100 bg-white/95 shadow-[0_14px_35px_rgba(15,23,42,0.1)] backdrop-blur-md';

  if (loading) {
    return (
      <Card className={floatingCardClass}>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
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
      <Card className={floatingCardClass}>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-4 text-center text-slate-500">
            <p>Unable to load financial summary</p>
            <p className="mt-1 text-sm">Please check your connection and try again</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={floatingCardClass}>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lease Ledger
          </p>
          <div className="border-b border-slate-200" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Charges</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(summary.totalCharges)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Credits</span>
          <span className="font-semibold text-slate-900">
            -{formatCurrency(summary.totalCredits)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Payments</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(summary.totalPayments)}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unit Transactions
          </p>
          <div className="border-b border-slate-200" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Bills</span>
          <span className="font-semibold text-red-600">-{formatCurrency(summary.totalBills)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Escrow</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(summary.escrowAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Management Fees</span>
          <span className="font-semibold text-red-600">
            -{formatCurrency(summary.managementFees)}
          </span>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Previous Balance</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(summary.previousBalance)}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Net to Owner</span>
            <span
              className={summary.netToOwner >= 0 ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-red-600'}
            >
              {formatCurrency(summary.netToOwner)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Balance</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(summary.balance)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
