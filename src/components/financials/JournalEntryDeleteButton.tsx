'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

type JournalEntryDeleteButtonProps = {
  transactionId: string;
  propertyId: string;
  disabled?: boolean;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  fullWidth?: boolean;
};

export default function JournalEntryDeleteButton({
  transactionId,
  propertyId,
  disabled = false,
  className,
  variant = 'destructive',
  size = 'default',
  fullWidth = true,
}: JournalEntryDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const router = useRouter();

  const openConfirm = () => {
    if (disabled || isDeleting) return;
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (disabled || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/journal-entries/${transactionId}?propertyId=${encodeURIComponent(propertyId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Unable to delete journal entry.');
      }
      setIsConfirmOpen(false);
      toast.success('Journal entry deleted.');
      router.replace(`/properties/${propertyId}/financials`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete journal entry.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDialogChange = (nextOpen: boolean) => {
    if (isDeleting) return;
    setIsConfirmOpen(nextOpen);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || isDeleting}
        onClick={openConfirm}
        className={cn(fullWidth ? 'w-full' : 'w-auto', 'font-semibold', className)}
      >
        {isDeleting ? 'Deleting…' : 'Delete entry'}
      </Button>
      <AlertDialog open={isConfirmOpen} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes the journal entry from the property ledger. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
