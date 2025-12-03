'use client';

import { Dialog } from '@/components/ui/dialog';
import TransactionDetailShell from '@/components/transactions/TransactionDetailShell';
import TransactionModalContent from '@/components/transactions/TransactionModalContent';
import {
  getTransactionAmountDisplay,
  getTransactionScopeLabel,
  getTransactionTypeLabel,
} from '@/lib/transactions/formatting';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

type TransactionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MonthlyLogTransaction | null;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onEdit?: (transaction: MonthlyLogTransaction) => void;
  onDelete?: (transaction: MonthlyLogTransaction) => void;
  editDisabledReason?: string | null;
};

export default function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
  formatCurrency,
  formatDate,
  onEdit,
  onDelete,
  editDisabledReason,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  const typeLabel = getTransactionTypeLabel(transaction.transaction_type);
  const amountDisplay = getTransactionAmountDisplay(transaction, formatCurrency);
  const scopeLabel = getTransactionScopeLabel(transaction);
  const editButtonLabel =
    transaction.transaction_type === 'Bill'
      ? 'Edit bill'
      : transaction.lease_id
        ? 'Edit in lease'
        : 'Edit';
  const actionHint =
    editDisabledReason ??
    (transaction.transaction_type === 'Bill'
      ? 'Opens this bill in the Bills workspace to edit.'
      : transaction.lease_id
        ? 'Opens lease financials so you can edit or void this entry.'
        : 'Edit this transaction from the workspace that created it.');
  const detailItems = [
    { label: 'Date', value: formatDate(transaction.date) },
    { label: 'Account', value: transaction.account_name ?? '—' },
    { label: 'Memo', value: transaction.memo ?? '—' },
    {
      label: 'Reference #',
      value: transaction.reference_number ?? '—',
      mono: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TransactionModalContent>
        <TransactionDetailShell
          title="Transaction Details"
          typeLabel={typeLabel}
          scopeLabel={scopeLabel}
          dateLabel={formatDate(transaction.date)}
          amountLabel={amountDisplay.formatted}
          amountPrefix={amountDisplay.prefix}
          amountTone={amountDisplay.tone}
          transactionId={transaction.id}
          referenceNumber={transaction.reference_number}
          detailItems={detailItems}
          actions={
            onEdit || onDelete
              ? {
                  hint: actionHint,
                  onEdit: onEdit ? () => onEdit(transaction) : undefined,
                  onDelete: onDelete ? () => onDelete(transaction) : undefined,
                  editDisabledReason,
                  editLabel: editButtonLabel,
                  deleteLabel: 'Delete',
                }
              : undefined
          }
        />
      </TransactionModalContent>
    </Dialog>
  );
}
