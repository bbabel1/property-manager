'use client';

import type { ReactNode } from 'react';
import { LargeDialogContent } from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';

type TransactionModalContentProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Standard wrapper for all transaction modals (detail, edit, overlay).
 * Ensures consistent max width, padding, and overflow behavior.
 */
export default function TransactionModalContent({
  children,
  className,
}: TransactionModalContentProps) {
  return (
    <LargeDialogContent
      className={cn(
        'w-[680px] max-w-[680px] overflow-hidden p-0',
        'focus:outline-none focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </LargeDialogContent>
  );
}
