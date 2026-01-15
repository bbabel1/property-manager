'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, CheckCircle, MoreHorizontal, Trash2, Edit, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import TransactionSkeleton from './TransactionSkeleton';
import { useMonthlyLogData } from '@/hooks/useMonthlyLogData';
import { Body, Heading, Label } from '@/ui/typography';

interface ChargesStageProps {
  monthlyLogId: string;
  onAssignedTransactionsChange?: (
    transactions: Array<{
      id: string;
      total_amount: number;
      transaction_type: string;
    }>,
  ) => void;
}

export default function EnhancedChargesStage({
  monthlyLogId,
  onAssignedTransactionsChange,
}: ChargesStageProps) {
  const {
    assignedTransactions,
    unassignedTransactions,
    loading,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
  } = useMonthlyLogData(monthlyLogId);

  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  const [assigningTransaction, setAssigningTransaction] = useState<string | null>(null);

  // Notify parent component when assigned transactions change
  useEffect(() => {
    if (onAssignedTransactionsChange) {
      onAssignedTransactionsChange(
        assignedTransactions.map((t) => ({
          id: t.id,
          total_amount: t.total_amount,
          transaction_type: t.transaction_type,
        })),
      );
    }
  }, [assignedTransactions, onAssignedTransactionsChange]);

  const handleAssignTransaction = useCallback(
    async (transactionId: string) => {
      try {
        // Prevent multiple assignments of the same transaction
        if (assigningTransaction === transactionId) return;

        setAssigningTransaction(transactionId);

        // Find the transaction to move
        const transactionToMove = unassignedTransactions.find((t) => t.id === transactionId);
        if (!transactionToMove) {
          throw new Error('Transaction not found');
        }

        // Optimistic update: immediately move transaction from unassigned to assigned
        moveTransactionToAssigned(transactionToMove);

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/transactions/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionIds: [transactionId],
          }),
        });

        if (!response.ok) {
          // Revert optimistic update on error
          moveTransactionToUnassigned(transactionId);

          const text = await response.text();
          let errorData: { error?: string } = {};
          try {
            errorData = text ? JSON.parse(text) : {};
          } catch {
            errorData = { error: `Request failed with status ${response.status}` };
          }
          throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        toast.success(`Transaction assigned successfully`);

        // No need to refetch - optimistic update already handled it
      } catch (error) {
        console.error('Error assigning transaction:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to assign transaction';
        toast.error(errorMessage);
      } finally {
        setAssigningTransaction(null);
      }
    },
    [
      monthlyLogId,
      assigningTransaction,
      unassignedTransactions,
      moveTransactionToAssigned,
      moveTransactionToUnassigned,
    ],
  );

  const handleUnassignTransaction = useCallback(
    async (transactionId: string) => {
      try {
        // Find the transaction to move
        const transactionToMove = assignedTransactions.find((t) => t.id === transactionId);
        if (!transactionToMove) {
          throw new Error('Transaction not found');
        }

        // Optimistic update: immediately move transaction from assigned to unassigned
        moveTransactionToUnassigned(transactionId);

        const response = await fetch(
          `/api/monthly-logs/${monthlyLogId}/transactions/${transactionId}/unassign`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          // Revert optimistic update on error
          moveTransactionToAssigned(transactionToMove);

          throw new Error('Failed to unassign transaction');
        }

        toast.success('Transaction unassigned from monthly log');
        // No need to refetch - optimistic update already handled it
      } catch (error) {
        console.error('Error unassigning transaction:', error);
        toast.error('Failed to unassign transaction');
      }
    },
    [monthlyLogId, assignedTransactions, moveTransactionToUnassigned, moveTransactionToAssigned],
  );

  const handleBulkUnassign = useCallback(async () => {
    if (selectedAssigned.size === 0) return;

    try {
      // Find transactions to move
      const transactionsToMove = assignedTransactions.filter((t) => selectedAssigned.has(t.id));

      // Optimistic update: immediately move transactions from assigned to unassigned
      transactionsToMove.forEach((transaction) => {
        moveTransactionToUnassigned(transaction.id);
      });

      const promises = Array.from(selectedAssigned).map((id) =>
        fetch(`/api/monthly-logs/${monthlyLogId}/transactions/${id}/unassign`, {
          method: 'DELETE',
        }),
      );

      await Promise.all(promises);
      toast.success(`Unassigned ${selectedAssigned.size} transaction(s)`);
      setSelectedAssigned(new Set());
      // No need to refetch - optimistic update already handled it
    } catch (error) {
      // Revert optimistic update on error
      const transactionsToRevert = assignedTransactions.filter((t) => selectedAssigned.has(t.id));
      transactionsToRevert.forEach((transaction) => {
        moveTransactionToAssigned(transaction);
      });

      console.error('Error bulk unassigning transactions:', error);
      toast.error('Failed to unassign transactions');
    }
  }, [
    monthlyLogId,
    selectedAssigned,
    assignedTransactions,
    moveTransactionToUnassigned,
    moveTransactionToAssigned,
  ]);

  const handleToggleUnassigned = useCallback(
    (transactionId: string) => {
      // Automatically assign the transaction when checked
      handleAssignTransaction(transactionId);
    },
    [handleAssignTransaction],
  );

  const handleToggleAssigned = useCallback((transactionLineId: string) => {
    setSelectedAssigned((prev) => {
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

  const totalCharges = assignedTransactions.reduce((sum, transaction) => {
    // For charges, use positive amount; for credits, use negative amount
    if (transaction.transaction_type === 'Charge') {
      return sum + Math.abs(transaction.total_amount);
    } else if (transaction.transaction_type === 'Credit') {
      return sum - Math.abs(transaction.total_amount);
    }
    return sum;
  }, 0);

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
          <TransactionSkeleton count={3} />
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
          {/* Action Button */}
          <div className="mb-6 flex justify-end">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Charge
            </Button>
          </div>

          {/* Bulk Actions Toolbar */}
          {selectedAssigned.size > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <Label as="span" size="sm" className="text-blue-900">
                  {selectedAssigned.size} transaction(s) selected
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkUnassign}
                  className="gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAssigned(new Set())}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Assigned Transactions */}
          {assignedTransactions.length > 0 ? (
            <div className="space-y-3">
              {assignedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4 transition-all duration-200 hover:shadow-sm',
                    selectedAssigned.has(transaction.id)
                      ? 'border-blue-200 bg-blue-50 shadow-sm'
                      : 'border-slate-300 bg-white hover:border-slate-300 hover:bg-slate-100',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedAssigned.has(transaction.id)}
                      onCheckedChange={() => handleToggleAssigned(transaction.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label as="span" size="sm">
                            {transaction.memo}
                          </Label>
                        </div>
                      </div>
                      <Body as="div" size="sm" tone="muted" className="mt-1">
                        {formatDate(transaction.date)}
                      </Body>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Heading as="div" size="h6">
                        {transaction.transaction_type === 'Charge' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.total_amount))}
                      </Heading>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleUnassignTransaction(transaction.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <AlertCircle className="h-6 w-6 text-slate-400" />
              </div>
              <Heading as="h3" size="h6" className="mt-4">
                No charges found
              </Heading>
              <Body as="p" size="sm" tone="muted" className="mt-2">
                No charges have been assigned to this monthly log yet.
              </Body>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unassigned Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Unassigned Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {unassignedTransactions.length > 0 ? (
            <div className="space-y-2">
              {unassignedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-slate-300 bg-white p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm',
                    assigningTransaction === transaction.id && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                  <Checkbox
                    onCheckedChange={() => handleToggleUnassigned(transaction.id)}
                    className="h-4 w-4"
                    disabled={assigningTransaction === transaction.id}
                  />
                  <div>
                    <Label as="div" size="sm">
                      {transaction.memo}
                    </Label>
                    <Body as="div" size="sm" tone="muted">
                      {formatDate(transaction.date)}
                    </Body>
                  </div>
                </div>
                <Heading as="div" size="h6">
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
