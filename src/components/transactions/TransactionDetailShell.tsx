'use client';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';
import { amountToneClassName } from '@/lib/amount-formatting';
import { Body, Heading, Label } from '@/ui/typography';

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
  const amountClass = amountToneClassName(amountTone);

  const effectiveHint = actions?.editDisabledReason ?? actions?.hint ?? null;
  const showActions = actions?.onEdit || actions?.onDelete;

  return (
    <div className="space-y-6">
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <div className="border-b border-slate-100 px-6 pt-6 pr-12 pb-4">
        <div className="space-y-1">
          <Heading as="p" size="h4" aria-hidden>
            {title}
          </Heading>
          {scopeLabel || dateLabel ? (
            <Body as="p" size="sm" tone="muted">
              {[scopeLabel, dateLabel].filter(Boolean).join(' • ')}
            </Body>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {typeLabel ? (
            <Badge variant="outline" className="bg-slate-100 text-slate-700">
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
        <div className="flex flex-col gap-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
              Amount
            </Label>
            <Heading as="div" size="h2" className={amountClass}>
              {amountPrefix}
              {amountLabel}
            </Heading>
            {dateLabel ? (
              <Body as="p" size="xs" tone="muted">
                Posted {dateLabel}
              </Body>
            ) : null}
          </div>
          {(transactionId || referenceNumber) && (
            <div className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:w-auto">
              {transactionId ? (
                <>
              <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                Transaction ID
              </Label>
              <Body as="p" size="sm" tone="muted" className="break-words font-mono">
                {transactionId}
              </Body>
            </>
          ) : null}
          {referenceNumber ? (
                <>
                  <Label
                    as="p"
                    size="xs"
                    tone="muted"
                className="mt-3 tracking-wide uppercase"
              >
                Reference #
              </Label>
              <Body as="p" size="sm" tone="muted" className="break-words font-mono">
                {referenceNumber}
              </Body>
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-3"
              >
                <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                  {item.label}
                </Label>
                <Body
                  as="div"
                  size="sm"
                  tone={item.mono ? 'muted' : 'default'}
                  className={cn('mt-1', item.mono ? 'font-mono break-words' : '')}
                >
                  {item.value}
                </Body>
              </div>
            ))}
          </div>
        ) : null}

        {showActions ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                Actions
              </Label>
              {effectiveHint ? (
                <Body as="p" size="sm" tone="muted">
                  {effectiveHint}
                </Body>
              ) : null}
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
