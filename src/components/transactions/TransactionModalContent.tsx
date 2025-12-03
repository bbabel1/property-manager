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
        'max-w-3xl overflow-hidden p-0 sm:max-w-4xl',
        'focus:outline-none focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </LargeDialogContent>
  );
}
