'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ActionButton from '@/components/ui/ActionButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type BillActionsMenuProps = {
  billId: string;
};

export default function BillActionsMenu({ billId }: BillActionsMenuProps) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm('Delete this bill? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bills/${billId}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to delete bill');
        }
        router.push('/bills');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete bill';
        alert(message);
      }
    });
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
      <DropdownMenuContent align="end" className="min-w-[12rem]" sideOffset={6}>
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
            if (isDeleting) return;
            handleDelete();
          }}
        >
          Delete bill
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
