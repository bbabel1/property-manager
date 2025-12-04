'use client';

import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import EmptyTransactionState from '@/components/monthly-logs/EmptyTransactionState';
import TransactionLoadingSkeleton from '@/components/monthly-logs/TransactionLoadingSkeleton';
import {
  formatDate,
  getTransactionAmountDisplay,
} from '@/lib/transactions/formatting';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

type TransactionTableProps = {
  transactions: MonthlyLogTransaction[];
  loading?: boolean;
  stickyActions?: React.ReactNode;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onRowClick?: (transaction: MonthlyLogTransaction) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

const buildLeaseTransactionLink = (leaseId?: number | string | null): string | null => {
  if (leaseId == null) return null;
  return `/leases/${leaseId}?tab=financials`;
};

export default function TransactionTable({
  transactions,
  loading = false,
  stickyActions,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  onRowClick,
  emptyTitle,
  emptyDescription,
}: TransactionTableProps) {
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="rounded-lg border border-slate-300 bg-white/70">
      {stickyActions ? (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-300/80 bg-white/90 px-4 py-3">
          {stickyActions}
        </div>
      ) : null}
      <div className="max-h-[60vh] overflow-auto">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-slate-100">
            <TableRow className="text-xs uppercase tracking-wide text-slate-600">
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(value) => onToggleAll(Boolean(value))}
                  aria-label="Select all transactions"
                />
              </TableHead>
              <TableHead className="w-36 min-w-[120px]">Date</TableHead>
              <TableHead className="w-48 min-w-[140px]">Account</TableHead>
              <TableHead className="w-64 min-w-[200px]">Memo</TableHead>
              <TableHead className="w-32 min-w-[120px]">Type</TableHead>
              <TableHead className="w-32 min-w-[120px] text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6">
                  <TransactionLoadingSkeleton rows={3} />
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6">
                  <EmptyTransactionState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const amountDisplay = getTransactionAmountDisplay(transaction);
                const amountClass =
                  amountDisplay.tone === 'negative'
                    ? 'text-rose-700'
                    : amountDisplay.tone === 'positive'
                      ? 'text-emerald-700'
                      : 'text-slate-900';
                const leaseLink = buildLeaseTransactionLink(transaction.lease_id);
                const rawType = transaction.transaction_type || '';
                const typeLabel = rawType === 'GeneralJournalEntry' ? 'Journal Entry' : rawType || '—';
                const isSelected = selectedIds.has(transaction.id);

                return (
                  <TableRow
                    key={transaction.id}
                    className="cursor-pointer text-sm text-slate-700 transition hover:bg-slate-100"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('button') || target.closest('input') || target.closest('a')) {
                        return;
                      }
                      onRowClick?.(transaction);
                    }}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(transaction.id)}
                        aria-label={`Select transaction ${transaction.memo || transaction.id}`}
                      />
                    </TableCell>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.account_name ?? '—'}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{transaction.memo ?? '—'}</TableCell>
                    <TableCell>
                      {leaseLink ? (
                        <Link
                          href={leaseLink}
                          className="text-blue-600 underline-offset-2 hover:underline"
                        >
                          {typeLabel}
                        </Link>
                      ) : (
                        <span className="text-blue-600">{typeLabel}</span>
                      )}
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold', amountClass)}>
                      {amountDisplay.prefix}
                      {amountDisplay.formatted}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
