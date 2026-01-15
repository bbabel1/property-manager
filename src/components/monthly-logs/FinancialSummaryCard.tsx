'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Body, Heading, Label } from '@/ui/typography';

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
          <CardTitle>
            <Heading as="h3" size="h5">
              Financial Summary
            </Heading>
          </CardTitle>
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
          <CardTitle>
            <Heading as="h3" size="h5">
              Financial Summary
            </Heading>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Body as="div" size="sm" tone="muted" className="py-4 text-center">
            <p>Unable to load financial summary</p>
            <Body as="p" size="sm" tone="muted" className="mt-1">
              Please check your connection and try again
            </Body>
          </Body>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={floatingCardClass}>
      <CardHeader>
        <CardTitle>
          <Heading as="h3" size="h5">
            Financial Summary
          </Heading>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label size="xs" tone="muted" className="uppercase tracking-wide">
            Lease Ledger
          </Label>
          <div className="border-b border-slate-300" />
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Total Charges
          </Body>
          <Label as="span" size="sm">
            {formatCurrency(summary.totalCharges)}
          </Label>
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Total Credits
          </Body>
          <Label as="span" size="sm">
            -{formatCurrency(summary.totalCredits)}
          </Label>
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Total Payments
          </Body>
          <Label as="span" size="sm">
            {formatCurrency(summary.totalPayments)}
          </Label>
        </div>

        <div>
          <Label size="xs" tone="muted" className="uppercase tracking-wide">
            Unit Transactions
          </Label>
          <div className="border-b border-slate-300" />
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Total Bills
          </Body>
          <Label as="span" size="sm" className="text-red-600">
            -{formatCurrency(summary.totalBills)}
          </Label>
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Escrow
          </Body>
          <Label as="span" size="sm">
            {formatCurrency(summary.escrowAmount)}
          </Label>
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Management Fees
          </Body>
          <Label as="span" size="sm" className="text-red-600">
            -{formatCurrency(summary.managementFees)}
          </Label>
        </div>

        <div className="border-t border-slate-300 pt-4">
          <div className="flex items-center justify-between">
            <Body as="span" size="sm" tone="muted">
              Previous Balance
            </Body>
            <Label as="span" size="sm">
              {formatCurrency(summary.previousBalance)}
            </Label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label as="span" size="sm">
              Net to Owner
            </Label>
            <Heading
              as="span"
              size="h5"
              className={summary.netToOwner >= 0 ? '' : 'text-red-600'}
            >
              {formatCurrency(summary.netToOwner)}
            </Heading>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Body as="span" size="sm" tone="muted">
            Balance
          </Body>
          <Label as="span" size="sm">
            {formatCurrency(summary.balance)}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
