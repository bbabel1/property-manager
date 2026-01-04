'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import ActionButton from '@/components/ui/ActionButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TransactionActionCategory = 'deposit' | 'check' | 'transfer';

type Props = {
  deleteUrl: string | null;
  detailHref: string;
  transactionCategory: TransactionActionCategory | null;
};

export default function BankTransactionActions({
  deleteUrl,
  detailHref,
  transactionCategory,
}: Props) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, startTransition] = useTransition();

  const canNavigate = detailHref && detailHref !== '#';
  const deleteLabel =
    transactionCategory === 'deposit'
      ? 'deposit'
      : transactionCategory === 'check'
        ? 'check'
        : 'transaction';

  const handleNavigate = () => {
    if (!detailHref || detailHref === '#') return;
    router.push(detailHref);
  };

  const handleDelete = () => {
    if (!deleteUrl || isDeleting) return;
    setIsConfirmOpen(false);
    startTransition(async () => {
      try {
        const response = await fetch(deleteUrl, { method: 'DELETE' });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = (payload as { error?: string } | null)?.error;
          toast.error('Could not delete transaction', {
            description: message || 'You might not have permission to delete this transaction.',
          });
          return;
        }

        toast.success('Transaction deleted');
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete transaction';
        toast.error('Could not delete transaction', { description: message });
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionButton
            aria-label="Transaction actions"
            data-row-link-ignore="true"
            disabled={isDeleting}
            aria-disabled={isDeleting}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[12rem]"
          sideOffset={6}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            disabled={!canNavigate}
            onSelect={(event) => {
              event.preventDefault();
              if (!canNavigate) return;
              handleNavigate();
            }}
          >
            View details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!deleteUrl}
            onSelect={(event) => {
              event.preventDefault();
              if (!deleteUrl) return;
              setIsConfirmOpen(true);
            }}
          >
            Delete {deleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent data-row-link-ignore="true">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {deleteLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting removes the {deleteLabel} from this bank register permanently. Only platform
              admins can delete transactions, and this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteUrl || isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isDeleting ? 'Deleting…' : `Delete ${deleteLabel}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
