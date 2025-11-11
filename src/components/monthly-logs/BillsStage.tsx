'use client';

import { useState, useEffect } from 'react';
import { Receipt, AlertCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface BillsStageProps {
  monthlyLogId: string;
}

interface Bill {
  id: string;
  total_amount: number;
  memo: string;
  date: string;
  reference_number: string | null;
  vendor_id: string | null;
}

interface BillsData {
  assignedBills: Bill[];
  totalBills: number;
}

export default function BillsStage({ monthlyLogId }: BillsStageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/bills`);
        if (!response.ok) {
          throw new Error(`Failed to fetch bills data: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bills data';
        console.error('Error fetching bills data:', err);
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
          <CardTitle>Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between rounded-lg border border-slate-200 p-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-slate-200"></div>
                  <div className="h-3 w-24 rounded bg-slate-200"></div>
                </div>
                <div className="h-4 w-16 rounded bg-slate-200"></div>
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
          <CardTitle>Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'Failed to load bills data'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bills Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-600" />
              Bills
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <DollarSign className="h-4 w-4" />
              Total: {formatCurrency(data.totalBills)}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.assignedBills.length > 0 ? (
            <div className="space-y-3">
              {data.assignedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{bill.memo}</span>
                      {bill.reference_number && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          #{bill.reference_number}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{formatDate(bill.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">
                      -{formatCurrency(Math.abs(bill.total_amount))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Receipt className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-slate-900">No bills found</h3>
              <p className="mt-2 text-sm text-slate-500">
                No bills have been assigned to this monthly log yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
