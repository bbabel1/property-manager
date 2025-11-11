'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ActionButton from '@/components/ui/ActionButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  initiateBuildiumDelete,
  finalizeBuildiumDelete,
  BuildiumDeletePrompt,
} from '@/components/bills/useBuildiumDeleteFlow';
import { BuildiumDeleteConfirmationDialog } from '@/components/bills/BuildiumDeleteConfirmationDialog';

type BillActionsMenuProps = {
  billId: string;
};

export default function BillActionsMenu({ billId }: BillActionsMenuProps) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [buildiumPrompt, setBuildiumPrompt] = useState<BuildiumDeletePrompt | null>(null);
  const [isConfirmingBuildium, setIsConfirmingBuildium] = useState(false);

  const handleDelete = () => {
    setIsConfirmOpen(false);
    startTransition(async () => {
      try {
        const result = await initiateBuildiumDelete(billId);
        if (result.status === 'deleted') {
          toast.success('Bill deleted');
          router.push('/bills');
        } else {
          setBuildiumPrompt(result.prompt);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete bill';
        toast.error('Failed to delete bill', { description: message });
      }
    });
  };

  const handleConfirmBuildium = async () => {
    if (!buildiumPrompt) return;
    setIsConfirmingBuildium(true);
    try {
      await finalizeBuildiumDelete(billId, buildiumPrompt.confirmation);
      toast.success('Bill deleted');
      setBuildiumPrompt(null);
      router.push('/bills');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete bill';
      toast.error('Failed to delete bill', { description: message });
    } finally {
      setIsConfirmingBuildium(false);
    }
  };

  const handleCancelBuildium = () => {
    if (isConfirmingBuildium) return;
    setBuildiumPrompt(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton
          type="button"
          className="border-border border"
          aria-label="More bill actions"
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
        <DropdownMenuItem disabled title="Coming soon">
          Enter charges
        </DropdownMenuItem>
        <DropdownMenuItem disabled title="Coming soon">
          Request owner contribution
        </DropdownMenuItem>
        <DropdownMenuItem disabled title="Coming soon">
          Duplicate bill
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isDeleting) return;
            setIsConfirmOpen(true);
          }}
        >
          Delete bill
        </DropdownMenuItem>
      </DropdownMenuContent>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes the bill and its line items. You can’t undo it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                if (isDeleting) return;
                handleDelete();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete bill'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BuildiumDeleteConfirmationDialog
        open={Boolean(buildiumPrompt)}
        buildium={buildiumPrompt?.buildium}
        expiresAt={buildiumPrompt?.confirmation.expiresAt}
        onCancel={handleCancelBuildium}
        onConfirm={handleConfirmBuildium}
        isConfirming={isConfirmingBuildium}
      />
    </DropdownMenu>
  );
}
