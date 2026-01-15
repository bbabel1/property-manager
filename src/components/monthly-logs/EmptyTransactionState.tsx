'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Body, Label } from '@/ui/typography';

type EmptyTransactionStateProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export default function EmptyTransactionState({
  title = 'No transactions to show',
  description = 'Add or assign transactions to see them here.',
  children,
}: EmptyTransactionStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-400 bg-slate-100 px-4 py-6 text-center">
      <Info className="h-5 w-5 text-slate-400" aria-hidden />
      <div className="space-y-1">
        <Label as="p">{title}</Label>
        <Body as="p" size="xs" tone="muted">
          {description}
        </Body>
      </div>
      {children}
    </div>
  );
}
