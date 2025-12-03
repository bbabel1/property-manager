'use client';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';

type DetailItem = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

type ActionConfig = {
  hint?: string | null;
  onEdit?: () => void;
  editLabel?: string;
  editDisabledReason?: string | null;
  onDelete?: () => void;
  deleteLabel?: string;
};

export type TransactionDetailShellProps = {
  title?: string;
  typeLabel?: string;
  scopeLabel?: string;
  dateLabel?: string;
  amountLabel: string;
  amountPrefix?: string;
  amountTone?: 'positive' | 'negative' | 'neutral';
  transactionId?: string;
  referenceNumber?: string | null;
  detailItems?: DetailItem[];
  actions?: ActionConfig;
};

export default function TransactionDetailShell({
  title = 'Transaction Details',
  typeLabel,
  scopeLabel,
  dateLabel,
  amountLabel,
  amountPrefix,
  amountTone = 'positive',
  transactionId,
  referenceNumber,
  detailItems = [],
  actions,
}: TransactionDetailShellProps) {
  const amountClass = cn(
    'text-3xl font-semibold leading-tight',
    amountTone === 'positive'
      ? 'text-emerald-700'
      : amountTone === 'negative'
        ? 'text-rose-700'
        : 'text-slate-900',
  );

  const effectiveHint = actions?.editDisabledReason ?? actions?.hint ?? null;
  const showActions = actions?.onEdit || actions?.onDelete;

  return (
    <div className="space-y-6">
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <div className="border-b border-slate-100 px-6 pb-4 pt-6 pr-12">
        <div className="space-y-1">
          <p className="text-xl font-semibold leading-tight" aria-hidden>
            {title}
          </p>
          {scopeLabel || dateLabel ? (
            <p className="text-sm text-slate-500">
              {[scopeLabel, dateLabel].filter(Boolean).join(' • ')}
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {typeLabel ? (
            <Badge variant="outline" className="bg-slate-50 text-slate-700">
              {typeLabel}
            </Badge>
          ) : null}
          {scopeLabel ? (
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
              {scopeLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-6 pb-6">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount
            </p>
            <div className={amountClass}>
              {amountPrefix}
              {amountLabel}
            </div>
            {dateLabel ? (
              <p className="text-xs text-slate-500">Posted {dateLabel}</p>
            ) : null}
          </div>
          {(transactionId || referenceNumber) && (
            <div className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 sm:w-auto">
              {transactionId ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Transaction ID
                  </p>
                  <p className="font-mono text-sm text-slate-700 break-words">{transactionId}</p>
                </>
              ) : null}
              {referenceNumber ? (
                <>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reference #
                  </p>
                  <p className="font-mono text-sm text-slate-700 break-words">{referenceNumber}</p>
                </>
              ) : null}
            </div>
          )}
        </div>

        {detailItems.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {detailItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p
                  className={cn(
                    'mt-1 text-sm text-slate-800',
                    item.mono ? 'break-words font-mono text-slate-700' : '',
                  )}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {showActions ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </p>
              {effectiveHint ? <p className="text-sm text-slate-600">{effectiveHint}</p> : null}
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              {actions?.onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={actions.onDelete}
                >
                  {actions.deleteLabel ?? 'Delete'}
                </Button>
              ) : null}
              {actions?.onEdit ? (
                <Button
                  type="button"
                  disabled={Boolean(actions.editDisabledReason)}
                  onClick={actions.onEdit}
                >
                  {actions.editLabel ?? 'Edit'}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
