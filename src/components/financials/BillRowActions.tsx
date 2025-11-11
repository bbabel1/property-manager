"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import ActionButton from "@/components/ui/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as React from "react";
import { toast } from "sonner";
import {
  BuildiumDeletePrompt,
  finalizeBuildiumDelete,
  initiateBuildiumDelete,
} from "@/components/bills/useBuildiumDeleteFlow";
import { BuildiumDeleteConfirmationDialog } from "@/components/bills/BuildiumDeleteConfirmationDialog";

type BillRowActionsProps = {
  billId: string;
};

export function BillRowActions({ billId }: BillRowActionsProps) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [buildiumPrompt, setBuildiumPrompt] = React.useState<BuildiumDeletePrompt | null>(null);
  const [isConfirmingBuildium, setIsConfirmingBuildium] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const stopPropagation = React.useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const handleDelete = React.useCallback(() => {
    setIsConfirmOpen(false);
    startTransition(async () => {
      try {
        const result = await initiateBuildiumDelete(billId);
        if (result.status === "deleted") {
          toast.success("Bill deleted");
          router.refresh();
        } else {
          setBuildiumPrompt(result.prompt);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete bill";
        toast.error("Failed to delete bill", { description: message });
      }
    });
  }, [billId, router]);

  const handleConfirmBuildium = React.useCallback(async () => {
    if (!buildiumPrompt) return;
    setIsConfirmingBuildium(true);
    try {
      await finalizeBuildiumDelete(billId, buildiumPrompt.confirmation);
      setBuildiumPrompt(null);
      toast.success("Bill deleted");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete bill";
      toast.error("Failed to delete bill", { description: message });
    } finally {
      setIsConfirmingBuildium(false);
    }
  }, [billId, buildiumPrompt, router]);

  const handleCancelBuildium = React.useCallback(() => {
    if (isConfirmingBuildium) return;
    setBuildiumPrompt(null);
  }, [isConfirmingBuildium]);

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <ActionButton
          aria-label="Bill actions"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          disabled={isDeleting}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[10rem]"
        side="bottom"
        sideOffset={6}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            setIsMenuOpen(false);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            setIsMenuOpen(false);
          }}
        >
          Email
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            setIsMenuOpen(false);
          }}
        >
          Print
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isDeleting) return;
            setIsMenuOpen(false);
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
        onConfirm={handleConfirmBuildium}
        onCancel={handleCancelBuildium}
        isConfirming={isConfirmingBuildium}
      />
    </DropdownMenu>
  );
}

export default BillRowActions;
