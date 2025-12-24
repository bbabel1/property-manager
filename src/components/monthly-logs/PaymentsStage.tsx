'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import CreatePaymentForm from './CreatePaymentForm';

interface PaymentsStageProps {
  monthlyLogId: string;
}

interface PaymentsData {
  previousLeaseBalance: number;
  totalRentOwed: number;
  remainingRentBalance: number;
  leaseCharges: number;
  leaseCredits: number;
  paymentsApplied: number;
  feeCharges: number;
  unitId: string;
  propertyId: string;
}

export default function PaymentsStage({ monthlyLogId }: PaymentsStageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePayment, setShowCreatePayment] = useState(false);

  const formatCurrency = (amount: number) => {
    // Handle NaN, null, undefined, or invalid numbers
    const safeAmount = isNaN(amount) || amount == null ? 0 : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(safeAmount);
  };

  const handlePaymentCreated = () => {
    // Refresh the data after payment is created
    fetchData();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/payments`);
      if (!response.ok) {
        throw new Error(`Failed to fetch payments data: ${response.status}`);
      }

      const text = await response.text();
      let result: PaymentsData | null = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        throw new Error('Invalid response from server');
      }
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payments data';
      console.error('Error fetching payments data:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [monthlyLogId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
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
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'Failed to load payments data'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isBalancePositive = data.remainingRentBalance >= 0;

  return (
    <div className="space-y-6">
      {/* Rent Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Rent Balance
            </div>
            <Button
              onClick={() => setShowCreatePayment(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Payment
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Total Rent Owed */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Rent Owed</p>
                <p className="mt-1 text-xs text-slate-600">Previous Balance + Charges – Credits</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(data.totalRentOwed)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Previous Month Balance</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(data.previousLeaseBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-slate-600">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  Charges This Month
                </span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(data.leaseCharges)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-slate-600">
                  <TrendingDown className="h-3 w-3 text-blue-600" />
                  Credits This Month
                </span>
                <span className="font-medium text-blue-600">
                  -{formatCurrency(data.leaseCredits)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="flex items-center gap-1 text-slate-600">
                  <TrendingDown className="h-3 w-3 text-purple-600" />
                  Payments Applied
                </span>
                <span className="font-medium text-purple-600">
                  -{formatCurrency(data.paymentsApplied)}
                </span>
              </div>
            </div>

            {/* Remaining Balance */}
            <div
              className={cn(
                'flex items-center justify-between rounded-lg p-4',
                isBalancePositive ? 'bg-amber-50' : 'bg-green-50',
              )}
            >
              <div>
                <p className="text-sm font-medium text-slate-700">Remaining Balance</p>
                <p className="mt-1 text-xs text-slate-600">
                  {isBalancePositive ? 'Amount owed by tenant' : 'Overpayment/credit'}
                </p>
              </div>
              <p
                className={cn(
                  'text-lg font-semibold',
                  isBalancePositive ? 'text-amber-600' : 'text-green-600',
                )}
              >
                {formatCurrency(Math.abs(data.remainingRentBalance))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Processing Fees */}
      {data.feeCharges > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Processing Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Total fees for this period</p>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(data.feeCharges)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Payment Form */}
      <CreatePaymentForm
        monthlyLogId={monthlyLogId}
        unitId={data?.unitId || ''}
        propertyId={data?.propertyId || ''}
        isOpen={showCreatePayment}
        onClose={() => setShowCreatePayment(false)}
        onSuccess={handlePaymentCreated}
      />
    </div>
  );
}
