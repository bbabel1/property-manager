'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { Body, Heading, Label } from '@/ui/typography';

interface Transaction {
  id: string;
  total_amount: number;
  memo: string;
  date: string;
  transaction_type: string;
  lease_id: number;
  monthly_log_id: string | null;
  reference_number: string | null;
}

interface ChargesStageProps {
  monthlyLogId: string;
}

export default function ChargesStage({ monthlyLogId }: ChargesStageProps) {
  const [assignedTransactions, setAssignedTransactions] = useState<Transaction[]>([]);
  const [unassignedTransactions, setUnassignedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch assigned transactions for this monthly log
      const assignedResponse = await fetch(`/api/monthly-logs/${monthlyLogId}/transactions`);
      if (assignedResponse.ok) {
        const text = await assignedResponse.text();
        let assigned: Transaction[] = [];
        try {
          assigned = text ? JSON.parse(text) : [];
        } catch {
          console.error('Failed to parse assigned transactions response');
          assigned = [];
        }
        setAssignedTransactions(assigned);
      } else {
        console.error(
          'Failed to fetch assigned transactions:',
          assignedResponse.status,
          assignedResponse.statusText,
        );
        toast.error('Failed to load assigned transactions');
      }

      // Fetch unassigned transactions
      const unassignedResponse = await fetch('/api/transactions/unassigned');
      if (unassignedResponse.ok) {
        const text = await unassignedResponse.text();
        let unassigned: Transaction[] = [];
        try {
          unassigned = text ? JSON.parse(text) : [];
        } catch {
          console.error('Failed to parse unassigned transactions response');
          unassigned = [];
        }
        setUnassignedTransactions(unassigned);
      } else {
        console.error(
          'Failed to fetch unassigned transactions:',
          unassignedResponse.status,
          unassignedResponse.statusText,
        );
        toast.error('Failed to load unassigned transactions');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [monthlyLogId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleAssignTransactions = useCallback(async () => {
    if (selectedUnassigned.size === 0) return;

    try {
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/transactions/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds: Array.from(selectedUnassigned),
        }),
      });

      if (response.ok) {
        toast.success(`Assigned ${selectedUnassigned.size} transaction(s) to monthly log`);
        setSelectedUnassigned(new Set());
        await fetchTransactions();
      } else {
        throw new Error('Failed to assign transactions');
      }
    } catch (error) {
      console.error('Error assigning transactions:', error);
      toast.error('Failed to assign transactions');
    }
  }, [monthlyLogId, selectedUnassigned, fetchTransactions]);

  const handleUnassignTransaction = useCallback(
    async (transactionId: string) => {
      try {
        const response = await fetch(
          `/api/monthly-logs/${monthlyLogId}/transactions/${transactionId}/unassign`,
          {
            method: 'DELETE',
          },
        );

        if (response.ok) {
          toast.success('Transaction unassigned from monthly log');
          await fetchTransactions();
        } else {
          throw new Error('Failed to unassign transaction');
        }
      } catch (error) {
        console.error('Error unassigning transaction:', error);
        toast.error('Failed to unassign transaction');
      }
    },
    [monthlyLogId, fetchTransactions],
  );

  const handleToggleUnassigned = useCallback((transactionLineId: string) => {
    setSelectedUnassigned((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionLineId)) {
        newSet.delete(transactionLineId);
      } else {
        newSet.add(transactionLineId);
      }
      return newSet;
    });
  }, []);

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

  const totalCharges = assignedTransactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.total_amount),
    0,
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Charges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Charges Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Charges
            </div>
            <div className="text-right">
              <Heading as="div" size="h3">
                {formatCurrency(totalCharges)}
              </Heading>
              <Body as="div" size="sm" tone="muted">
                {assignedTransactions.length} transaction(s)
              </Body>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Action Buttons */}
          <div className="mb-6 flex items-center gap-3">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Charge
            </Button>
          </div>

          {/* Assigned Transactions Table */}
          {assignedTransactions.length > 0 ? (
            <div className="space-y-3">
              {assignedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border border-slate-300 bg-white p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {transaction.transaction_type === 'Charge' ? (
                          <Circle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-green-500" />
                        )}
                        <Label as="span" size="sm">
                          {transaction.memo}
                        </Label>
                      </div>
                      <Badge variant="outline">
                        {transaction.reference_number || 'No Ref'}
                      </Badge>
                    </div>
                    <Body as="div" size="sm" tone="muted" className="mt-1">
                      {formatDate(transaction.date)}
                    </Body>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Heading
                        as="div"
                        size="h6"
                        className={cn(
                          transaction.transaction_type === 'Charge'
                            ? 'text-red-600'
                            : 'text-green-600',
                        )}
                      >
                        {transaction.transaction_type === 'Charge' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.total_amount))}
                      </Heading>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnassignTransaction(transaction.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Body as="div" size="sm" tone="muted" className="py-8 text-center">
              No charges assigned to this monthly log yet.
            </Body>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <Heading as="span" size="h6">
              Unassigned Transactions
            </Heading>
            {selectedUnassigned.size > 0 && (
              <Button onClick={handleAssignTransactions} size="sm" className="gap-2">
                Assign {selectedUnassigned.size} Selected
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unassignedTransactions.length > 0 ? (
            <div className="space-y-2">
              {unassignedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors',
                    selectedUnassigned.has(transaction.id)
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-300 bg-white hover:bg-slate-100',
                  )}
                  onClick={() => handleToggleUnassigned(transaction.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border-2',
                        selectedUnassigned.has(transaction.id)
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300',
                      )}
                    >
                      {selectedUnassigned.has(transaction.id) && (
                        <CheckCircle className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div>
                      <Label as="div" size="sm">
                        {transaction.memo}
                      </Label>
                      <Body as="div" size="sm" tone="muted">
                        {formatDate(transaction.date)}
                      </Body>
                    </div>
                  </div>
                  <Heading
                    as="span"
                    size="h6"
                    className={cn(
                      transaction.transaction_type === 'Charge'
                        ? 'text-slate-900'
                        : 'text-green-600',
                    )}
                  >
                    {transaction.transaction_type === 'Charge' ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.total_amount))}
                  </Heading>
                </div>
              ))}
            </div>
          ) : (
            <Body as="div" size="sm" tone="muted" className="py-8 text-center">
              No unassigned transactions found.
            </Body>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
