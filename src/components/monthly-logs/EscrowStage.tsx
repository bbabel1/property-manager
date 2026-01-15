'use client';

import { useState, useEffect } from 'react';
import { Shield, TrendingUp, TrendingDown, AlertCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { Body, Heading, Label } from '@/ui/typography';

interface EscrowStageProps {
  monthlyLogId: string;
}

interface EscrowMovement {
  id: string;
  date: string;
  memo: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
}

interface EscrowData {
  deposits: number;
  withdrawals: number;
  balance: number;
  movements: EscrowMovement[];
  hasValidGLAccounts: boolean;
}

export default function EscrowStage({ monthlyLogId }: EscrowStageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EscrowData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/escrow`);
        if (!response.ok) {
          throw new Error(`Failed to fetch escrow data: ${response.status}`);
        }

        const text = await response.text();
        let result: EscrowData | null = null;
        try {
          result = text ? JSON.parse(text) : null;
        } catch {
          throw new Error('Invalid response from server');
        }
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch escrow data';
        console.error('Error fetching escrow data:', err);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escrow / Security Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between rounded-lg border border-slate-300 p-4">
              <div className="h-4 w-32 rounded bg-slate-200"></div>
              <div className="h-4 w-24 rounded bg-slate-200"></div>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between rounded-lg border border-slate-300 p-3">
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-slate-200"></div>
                  <div className="h-3 w-20 rounded bg-slate-200"></div>
                </div>
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
          <CardTitle>Escrow / Security Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <Body as="p" size="sm">
              {error || 'Failed to load escrow data'}
            </Body>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.hasValidGLAccounts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escrow / Security Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            <div>
              <Heading as="p" size="h6">
                Configuration Required
              </Heading>
              <Body as="p" size="sm" tone="muted" className="mt-1">
                No GL accounts are configured for escrow tracking. Please configure a GL account
                with the "deposit" category to track security deposits.
              </Body>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Escrow Balance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Escrow Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Current Balance */}
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label size="sm">Current Balance</Label>
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    Security deposits held
                  </Body>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <Heading as="p" size="h4" className="text-blue-900">
                    {formatCurrency(data.balance)}
                  </Heading>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <Label size="xs" className="tracking-wide uppercase text-green-600">
                    Deposits
                  </Label>
                </div>
                <Heading as="p" size="h5" className="mt-2">
                  {formatCurrency(data.deposits)}
                </Heading>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  <Label size="xs" className="tracking-wide uppercase text-red-600">
                    Withdrawals
                  </Label>
                </div>
                <Heading as="p" size="h5" className="mt-2">
                  {formatCurrency(data.withdrawals)}
                </Heading>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escrow Movements */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Heading as="p" size="h6">
              Transaction History
            </Heading>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.movements.length > 0 ? (
            <div className="space-y-2">
              {data.movements.map((movement) => (
                <div
                  key={movement.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:shadow-sm',
                    movement.type === 'deposit'
                      ? 'border-green-200 bg-green-50 hover:border-green-300'
                      : 'border-red-200 bg-red-50 hover:border-red-300',
                  )}
                >
                  <div className="flex items-center gap-3">
                    {movement.type === 'deposit' ? (
                      <div className="rounded-full bg-green-100 p-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="rounded-full bg-red-100 p-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      </div>
                    )}
                    <div>
                      <Label as="p" size="sm">
                        {movement.memo}
                      </Label>
                      <Body as="p" size="xs" tone="muted">
                        {formatDate(movement.date)}
                      </Body>
                    </div>
                  </div>
                  <Heading
                    as="div"
                    size="h6"
                    className={cn(
                      movement.type === 'deposit' ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {movement.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(movement.amount)}
                  </Heading>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Shield className="h-6 w-6 text-slate-400" />
              </div>
              <Heading as="h3" size="h6" className="mt-4">
                No movements found
              </Heading>
              <Body as="p" size="sm" tone="muted" className="mt-2">
                No escrow transactions for this period.
              </Body>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
