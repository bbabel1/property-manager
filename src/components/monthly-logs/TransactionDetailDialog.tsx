'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

type TransactionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MonthlyLogTransaction | null;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
};

const LEASE_TRANSACTION_LABELS: Record<string, string> = {
  Charge: 'Lease Charge',
  Payment: 'Lease Payment',
  Credit: 'Lease Credit',
};

const getTransactionLabel = (type: string): string => LEASE_TRANSACTION_LABELS[type] ?? type;

export default function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
  formatCurrency,
  formatDate,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  const typeLabel = getTransactionLabel(transaction.transaction_type);
  const amountFormatted = formatCurrency(Math.abs(transaction.total_amount));
  const isCharge = transaction.transaction_type === 'Charge';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Transaction Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transaction Type Badge */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {typeLabel}
            </Badge>
            {transaction.lease_id ? (
              <span className="text-sm text-slate-500">Lease Transaction</span>
            ) : (
              <span className="text-sm text-slate-500">Unit Transaction</span>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount
            </label>
            <div className="text-2xl font-semibold text-slate-900">
              {isCharge ? '+' : '-'}
              {amountFormatted}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Date
            </label>
            <div className="text-sm text-slate-700">{formatDate(transaction.date)}</div>
          </div>

          {/* Account */}
          {transaction.account_name ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account
              </label>
              <div className="text-sm text-slate-700">{transaction.account_name}</div>
            </div>
          ) : null}

          {/* Memo */}
          {transaction.memo ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Memo
              </label>
              <div className="text-sm text-slate-700">{transaction.memo}</div>
            </div>
          ) : null}

          {/* Reference Number */}
          {transaction.reference_number ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reference Number
              </label>
              <div className="text-sm text-slate-700 font-mono">{transaction.reference_number}</div>
            </div>
          ) : null}

          {/* Transaction ID */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Transaction ID
            </label>
            <div className="text-sm text-slate-500 font-mono">{transaction.id}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

