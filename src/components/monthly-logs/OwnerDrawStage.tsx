'use client';

import { useState, useEffect } from 'react';
import { Wallet, AlertCircle, TrendingUp, TrendingDown, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { Body, Heading, Label } from '@/ui/typography';

interface OwnerDrawStageProps {
  monthlyLogId: string;
}

interface OwnerDrawData {
  ownerDraw: number;
  transactions: Array<{
    transactionLineId: string;
    transactionId: string;
    date: string;
    memo: string | null;
    amount: number;
  }>;
  totals: {
    previousNetToOwner: number;
    totalPayments: number;
    totalBills: number;
    escrowAmount: number;
    managementFees: number;
  };
  netToOwner: number;
}

export default function OwnerDrawStage({ monthlyLogId }: OwnerDrawStageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OwnerDrawData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/owner-draw`);
        if (!response.ok) {
          throw new Error(`Failed to fetch owner draw data: ${response.status}`);
        }

        const text = await response.text();
        let result: OwnerDrawData | null = null;
        try {
          result = text ? JSON.parse(text) : null;
        } catch {
          throw new Error('Invalid response from server');
        }
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch owner draw data';
        console.error('Error fetching owner draw data:', err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [monthlyLogId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner Draw</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-lg bg-slate-200"></div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-32 rounded bg-slate-200"></div>
                <div className="h-4 w-24 rounded bg-slate-200"></div>
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
          <CardTitle>Owner Draw</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <Body as="p" size="sm">
              {error || 'Failed to load owner draw data'}
            </Body>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositiveDraw = data.ownerDraw > 0;
  const isPositiveNet = data.netToOwner > 0;

  const netBreakdown = [
    {
      label: 'Previous Net to Owner',
      value: data.totals.previousNetToOwner,
      type: 'add' as const,
    },
    { label: 'Total Payments', value: data.totals.totalPayments, type: 'add' as const },
    { label: 'Total Bills', value: data.totals.totalBills, type: 'subtract' as const },
    { label: 'Escrow', value: data.totals.escrowAmount, type: 'subtract' as const },
    { label: 'Management Fees', value: data.totals.managementFees, type: 'subtract' as const },
    { label: 'Owner Draw', value: data.ownerDraw, type: 'subtract' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Owner Draw Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Owner Draw Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-lg bg-slate-100 p-4">
              <Body as="p" size="sm" className="text-slate-700">
                Total of transactions coded to the &ldquo;Owner Draw&rdquo; GL account.
              </Body>
              <Body as="p" size="xs" tone="muted" className="mt-1">
                Update the GL assignment on transaction lines to change this total.
              </Body>
            </div>

            {/* Owner Draw Result */}
            <div className={cn('rounded-lg p-6', isPositiveDraw ? 'bg-green-50' : 'bg-red-50')}>
              <div className="flex items-center justify-between">
                <div>
                  <Body as="p" size="sm" className="text-slate-700">
                    Owner Draw
                  </Body>
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    {isPositiveDraw
                      ? 'Amount available for distribution'
                      : 'Additional funds needed'}
                  </Body>
                </div>
                <div className="flex items-center gap-2">
                  {isPositiveDraw ? (
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  )}
                  <Heading
                    as="p"
                    size="h3"
                    className={cn(isPositiveDraw ? 'text-green-600' : 'text-red-600')}
                  >
                    {formatCurrency(Math.abs(data.ownerDraw))}
                  </Heading>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-slate-600" />
                <Heading as="h4" size="h6" className="text-slate-700">
                  Owner Draw Transactions
                </Heading>
              </div>

              {data.transactions.length === 0 ? (
                <Body
                  as="div"
                  size="sm"
                  tone="muted"
                  className="rounded-lg border border-dashed border-slate-300 p-4 text-slate-600"
                >
                  No owner draw transactions have been assigned to this log.
                </Body>
              ) : (
                <div className="divide-y rounded-lg border border-slate-300">
                  {data.transactions.map((transaction) => (
                    <div
                      key={transaction.transactionLineId}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <Label as="p" size="sm" className="text-slate-700">
                        {formatDate(transaction.date)}
                      </Label>
                      <Body as="p" size="xs" tone="muted" className="truncate">
                        {transaction.memo || 'Owner Draw'}
                      </Body>
                    </div>
                    <Heading as="p" size="h6">
                      {formatCurrency(transaction.amount)}
                    </Heading>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net to Owner (Context) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net to Owner (For Reference)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Body as="p" size="sm" tone="muted" className="text-slate-600">
              Calculated using the updated formula:
              <br />
              <Heading as="span" size="h6" className="text-foreground">
                Previous Net to Owner + Payments – Bills – Escrow – Management Fees – Owner Draw
              </Heading>
            </Body>

            <div className="rounded-lg bg-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Body as="p" size="sm" className="text-slate-700">
                    Net to Owner
                  </Body>
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    Reflects prior balance plus this month&apos;s activity.
                  </Body>
                </div>
                <Heading
                  as="p"
                  size="h4"
                  className={cn(isPositiveNet ? 'text-green-600' : 'text-red-600')}
                >
                  {formatCurrency(Math.abs(data.netToOwner))}
                </Heading>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-100 p-4">
              {netBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <Body as="span" size="sm" tone="muted" className="text-slate-600">
                    {item.label}
                  </Body>
                  <Heading
                    as="span"
                    size="h6"
                    className={cn(item.type === 'add' ? 'text-green-600' : 'text-red-600')}
                  >
                    {item.type === 'add' ? '+' : '-'}
                    {formatCurrency(item.value)}
                  </Heading>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
