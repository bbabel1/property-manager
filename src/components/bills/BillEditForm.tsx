'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { describeBuildiumPayload } from '@/lib/buildium-response';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Trash2, X } from 'lucide-react';

type VendorOption = { id: string; label: string };
const BILL_UNIT_PROPERTY_LEVEL_VALUE = '__PROPERTY_LEVEL__';

export type BillLinePreview = {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  gl_account_id: string;
  posting_type: 'Debit' | 'Credit';
  propertyName: string;
  unitLabel: string;
  accountLabel: string;
  description: string;
  amount: number;
  // Marks rows created client-side in this session
  isNew?: boolean;
};

export interface BillEditFormProps {
  billId: string;
  initial: {
    date: string;
    due_date: string | null;
    vendor_id: string | null;
    reference_number: string | null;
    memo: string | null;
  };
  vendors: VendorOption[];
  properties: { id: string; label: string }[];
  units: { id: string; label: string; property_id: string | null }[];
  accounts: { id: string; label: string; type?: string | null }[];
  lines: BillLinePreview[];
}

export default function BillEditForm({
  billId,
  initial,
  vendors,
  properties,
  units,
  accounts,
  lines,
}: BillEditFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: initial.date || '',
    due_date: initial.due_date || '',
    vendor_id: initial.vendor_id || '',
    reference_number: initial.reference_number || '',
    memo: initial.memo || '',
  });

  const [rows, setRows] = useState(() =>
    lines.filter((l) => l.posting_type !== 'Credit').map((l) => ({ ...l })),
  );
  const [editing, setEditing] = useState<{
    id: string;
    field: 'property' | 'unit' | 'account' | 'description' | 'amount';
  } | null>(null);
  const total = useMemo(
    () =>
      rows
        .filter((r) => r.posting_type === 'Debit')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0),
    [rows],
  );

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const returnTo = searchParams.get('returnTo') || null;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        date: form.date || null,
        due_date: form.due_date || null,
        vendor_id: form.vendor_id || null,
        reference_number: form.reference_number || null,
        memo: form.memo || null,
        lines: rows
          .filter((r) => r.posting_type === 'Debit')
          .map((r) => ({
            gl_account_id: r.gl_account_id,
            amount: Number(r.amount || 0),
            memo: r.description || null,
            property_id: r.property_id || null,
            unit_id: r.unit_id || null,
          })),
      };
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = extractBuildiumErrorMessage(body);
        setError(message);
        toast.error('Failed to sync bill to Buildium', message ? { description: message } : undefined);
        return;
      }
      const successDescription = extractBuildiumSuccessDescription(body);
      toast.success('Bill updated in Buildium', successDescription ? { description: successDescription } : undefined);
      router.push(returnTo || `/bills/${billId}`);
      router.refresh();
    });
  };

  const propertyOptions = properties;
  const expenseAccountOptions = useMemo(
    () =>
      accounts.filter((account) =>
        String(account.type ?? '')
          .toLowerCase()
          .includes('expense'),
      ),
    [accounts],
  );

  const addLine = () => {
    setRows((prev) => {
      const lastNonCredit = [...prev].reverse().find((r) => r.posting_type !== 'Credit');
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          // Use previous line's property/unit if available
          property_id: lastNonCredit?.property_id ?? null,
          unit_id: lastNonCredit?.unit_id ?? null,
          // Leave account blank by default for new rows
          gl_account_id: '',
          posting_type: 'Debit' as const,
          propertyName: '',
          unitLabel: '',
          accountLabel: '',
          // Leave description blank
          description: '',
          amount: 0,
          isNew: true,
        },
      ];
    });
  };

  const removeLine = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id || r.posting_type === 'Credit'));

  const setRow = (id: string, patch: Partial<BillLinePreview>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const propertyLabel = (id: string | null) =>
    properties.find((p) => p.id === id)?.label || 'Property';
  const unitLabel = (id: string | null) =>
    units.find((u) => u.id === id)?.label || 'Property level';
  const accountLabel = (id: string | null) => accounts.find((a) => a.id === id)?.label || 'Account';

  const cellControlBaseClass =
    'block h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm leading-tight transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary';
  const cellSelectClass = `${cellControlBaseClass} appearance-none pr-9`;
  const cellTextButtonClass =
    'flex h-9 w-full items-center rounded-md px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 hover:bg-muted/30';
  const cellMutedTextButtonClass = `${cellTextButtonClass} text-muted-foreground`;
  const cellNumericInputClass = `${cellControlBaseClass} text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
  const cellAmountButtonClass =
    'flex h-9 w-full items-center justify-end rounded-md px-3 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 hover:bg-muted/30';
  const cellAmountPaidButtonClass =
    'flex h-9 w-full items-center justify-end rounded-md px-3 text-right text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 hover:bg-muted/30';

  return (
    <div className="w-full space-y-6 p-0">
      <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-4 pt-6 sm:px-8 lg:px-12 lg:pt-8">
        <h1 className="text-foreground text-2xl font-semibold">Edit bill</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push(returnTo || `/bills/${billId}`)}
          aria-label="Close edit form"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mx-auto w-full max-w-8xl rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <form className="space-y-6 pb-24" onSubmit={onSubmit}>
        <Card className="mx-auto w-full max-w-8xl rounded-xl border border-border/60 bg-background shadow-md">
          <CardContent className="space-y-8 px-4 py-6 sm:px-8 lg:px-10">
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 sm:items-end sm:max-w-4xl">
                <label className="block space-y-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Date *
                  </span>
                  <DateInput
                    value={form.date}
                    onChange={(nextDate) => update('date', nextDate)}
                    className="h-11 w-full"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Due *
                  </span>
                  <DateInput
                    value={form.due_date || ''}
                    onChange={(nextDate) => update('due_date', nextDate)}
                    className="h-11 w-full"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                  Pay to *
                </span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="relative min-w-[16rem] sm:w-[36rem]">
                    <select
                      value={form.vendor_id || ''}
                      onChange={(e) => update('vendor_id', e.target.value)}
                      className="border-border/60 bg-background focus-visible:ring-primary block h-11 w-full appearance-none rounded-md border px-3 pr-10 text-base leading-tight focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2" />
                  </div>
                  <button
                    type="button"
                    className="text-primary hover:underline text-sm font-semibold"
                    onClick={() => {
                      toast.info('Work order linking coming soon');
                    }}
                  >
                    + Add work order
                  </button>
                </div>
              </label>

              <label className="block space-y-2 max-w-3xl">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Reference number
                </span>
                <Input
                  value={form.reference_number || ''}
                  onChange={(e) => update('reference_number', e.target.value)}
                  className="h-11 w-full text-base"
                />
              </label>
            </div>

            <label className="block space-y-2 max-w-5xl">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Memo
              </span>
              <Textarea
                rows={3}
                value={form.memo || ''}
                onChange={(e) => update('memo', e.target.value)}
                className="w-full text-base"
              />
            </label>

            <div className="space-y-4 border-t border-border/60 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">Item details</h3>
                  <p className="text-muted-foreground text-xs">
                    Keep line details tidy to mirror what Buildium shows.
                  </p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                <div className="w-full overflow-auto px-0">
                  <Table className="min-w-full text-sm border-collapse">
                    <TableHeader>
                      <TableRow className="bg-muted/40 divide-x divide-border border-b border-border/70">
                        <TableHead className="w-[30%] min-w-[11rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase text-foreground text-left">
                          Property or company
                        </TableHead>
                        <TableHead className="w-[9%] min-w-[6rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase text-foreground text-left">
                          Unit
                        </TableHead>
                        <TableHead className="w-[14%] min-w-[8rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase text-foreground text-left">
                          Account
                        </TableHead>
                        <TableHead className="w-[25%] min-w-[12rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase text-foreground text-left">
                          Description
                        </TableHead>
                        <TableHead className="w-[10%] min-w-[7rem] px-3.5 py-3 text-right text-xs font-semibold tracking-wide uppercase text-foreground tabular-nums">
                          Initial amount
                        </TableHead>
                        <TableHead className="w-[10%] min-w-[7rem] px-3.5 py-3 text-right text-xs font-semibold tracking-wide uppercase text-foreground tabular-nums">
                          Amount paid
                        </TableHead>
                        <TableHead className="w-[44px] px-0 py-0 bg-transparent" />
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-muted-foreground py-6 text-center text-sm"
                          >
                            No line items to edit.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {rows.map((l) => {
                            const currentAccountOption =
                              l.gl_account_id &&
                              !expenseAccountOptions.some((a) => a.id === l.gl_account_id)
                                ? {
                                    id: l.gl_account_id,
                                    label: accountLabel(l.gl_account_id),
                                  }
                                : null;

                            return (
                              <TableRow
                                key={l.id}
                                className="relative align-middle divide-x divide-border border-b border-border/60 transition-colors hover:bg-muted/20 [&>td:last-child]:border-l-0"
                              >
                                <TableCell className="text-foreground min-w-0 px-0 align-middle">
                                  <div className="px-4 py-2">
                                    {editing?.id === l.id &&
                                    editing.field === 'property' &&
                                    l.posting_type !== 'Credit' ? (
                                      <Select
                                        value={l.property_id || ''}
                                        onValueChange={(value) => {
                                          setRow(l.id, {
                                            property_id: value || null,
                                            unit_id: null,
                                          });
                                          setEditing(null);
                                        }}
                                      >
                                        <SelectTrigger className="h-10 w-full justify-between border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30">
                                          <SelectValue placeholder="Select property" className="w-full truncate" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {propertyOptions.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                              {p.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <button
                                        type="button"
                                        className={cellTextButtonClass}
                                        onClick={() =>
                                          l.posting_type !== 'Credit' &&
                                          setEditing({ id: l.id, field: 'property' })
                                        }
                                      >
                                        {propertyLabel(l.property_id)}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground min-w-0 px-0 align-middle">
                                  <div className="px-4 py-2">
                                    {editing?.id === l.id &&
                                    editing.field === 'unit' &&
                                    l.posting_type !== 'Credit' ? (
                                      <Select
                                        value={l.unit_id ?? BILL_UNIT_PROPERTY_LEVEL_VALUE}
                                        onValueChange={(value) => {
                                          setRow(l.id, {
                                            unit_id:
                                              value === BILL_UNIT_PROPERTY_LEVEL_VALUE ? null : value,
                                          });
                                          setEditing(null);
                                        }}
                                      >
                                        <SelectTrigger className="h-10 w-full justify-between border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30">
                                          <SelectValue placeholder="Property level" className="w-full truncate" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={BILL_UNIT_PROPERTY_LEVEL_VALUE}>
                                            Property level
                                          </SelectItem>
                                          {units
                                            .filter(
                                              (u) =>
                                                !l.property_id || u.property_id === l.property_id,
                                            )
                                            .map((u) => (
                                              <SelectItem key={u.id} value={u.id}>
                                                {u.label}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <button
                                        type="button"
                                        className={cellMutedTextButtonClass}
                                        onClick={() =>
                                          l.posting_type !== 'Credit' &&
                                          setEditing({ id: l.id, field: 'unit' })
                                        }
                                      >
                                        {unitLabel(l.unit_id)}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground min-w-0 px-0 align-middle">
                                  <div className="px-4 py-2">
                                    {editing?.id === l.id &&
                                    editing.field === 'account' &&
                                    l.posting_type !== 'Credit' ? (
                                      <Select
                                        value={l.gl_account_id}
                                        onValueChange={(value) => {
                                          setRow(l.id, { gl_account_id: value });
                                          setEditing(null);
                                        }}
                                      >
                                        <SelectTrigger className="h-10 w-full justify-between border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30">
                                          <SelectValue placeholder="Select account" className="w-full truncate" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {currentAccountOption ? (
                                            <SelectItem value={currentAccountOption.id} disabled>
                                              {currentAccountOption.label}
                                            </SelectItem>
                                          ) : null}
                                          {expenseAccountOptions.length > 0 ? (
                                            expenseAccountOptions.map((a) => (
                                              <SelectItem key={a.id} value={a.id}>
                                                {a.label}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="__none" disabled>
                                              No expense accounts available
                                            </SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <button
                                        type="button"
                                        className={cellTextButtonClass}
                                        onClick={() =>
                                          l.posting_type !== 'Credit' &&
                                          setEditing({ id: l.id, field: 'account' })
                                        }
                                      >
                                        {l.isNew && !l.gl_account_id
                                          ? ''
                                          : accountLabel(l.gl_account_id)}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground min-w-0 px-0 align-middle">
                                  <div className="px-4 py-2">
                                    {editing?.id === l.id &&
                                    editing.field === 'description' &&
                                    l.posting_type !== 'Credit' ? (
                                      <Input
                                        autoFocus
                                        value={l.description}
                                        onBlur={() => setEditing(null)}
                                        onChange={(e) =>
                                          setRow(l.id, { description: e.target.value })
                                        }
                                        className={cellControlBaseClass}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        className={cellTextButtonClass}
                                        onClick={() =>
                                          l.posting_type !== 'Credit' &&
                                          setEditing({ id: l.id, field: 'description' })
                                        }
                                      >
                                        {l.isNew && !l.description ? '' : l.description || '—'}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="px-0 text-right align-middle font-medium tabular-nums">
                                  <div className="px-4 py-2">
                                    {l.posting_type === 'Credit' ? (
                                      new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                      }).format(Math.abs(Number(l.amount || 0)))
                                    ) : (
                                      <div className="flex items-center justify-end gap-2">
                                        {editing?.id === l.id && editing.field === 'amount' ? (
                                          <Input
                                            autoFocus
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            value={String(l.amount)}
                                            onBlur={() => setEditing(null)}
                                            onChange={(e) =>
                                              setRow(l.id, { amount: Number(e.target.value || 0) })
                                            }
                                            className={`${cellNumericInputClass} w-[10rem] min-w-[7rem]`}
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            className={cellAmountButtonClass}
                                            onClick={() =>
                                              setEditing({ id: l.id, field: 'amount' })
                                            }
                                          >
                                            {new Intl.NumberFormat('en-US', {
                                              style: 'currency',
                                              currency: 'USD',
                                            }).format(Math.abs(Number(l.amount || 0)))}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="px-0 text-right align-middle font-medium tabular-nums">
                                  <div className="px-4 py-2">
                                    <button
                                      type="button"
                                      className={cellAmountPaidButtonClass}
                                      disabled
                                    >
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                      }).format(0)}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="w-[44px] px-0 text-center align-middle border-l-0">
                                  <button
                                    type="button"
                                    aria-label="Remove line"
                                    className="text-destructive hover:text-destructive/80 inline-flex h-8 w-8 items-center justify-center transition-colors"
                                    onClick={() => l.posting_type !== 'Credit' && removeLine(l.id)}
                                    disabled={l.posting_type === 'Credit'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/30 divide-x divide-border">
                            <TableCell
                              colSpan={3}
                              className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase"
                            />
                            <TableCell className="text-foreground px-4 py-3 text-right text-xs font-semibold uppercase">
                              Total
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(Math.abs(Number(total || 0)))}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(0)}
                            </TableCell>
                            <TableCell className="w-[40px]" />
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="pt-2 text-sm">
                <button type="button" className="text-primary hover:underline" onClick={addLine}>
                  Add line
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-primary bg-primary text-primary-foreground sticky bottom-0 z-10 mt-2 border-t">
          <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-4 py-3 sm:px-8 lg:px-12">
            <div className="flex items-center gap-2">
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-primary-foreground/90 hover:text-primary-foreground"
                onClick={() => router.push(`/bills/${billId}`)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
            <div className="text-sm font-medium">
              Total bill amount:{' '}
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                Math.abs(Number(total || 0)),
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

const FALLBACK_BILL_ERROR_MESSAGE = 'Failed to save bill';

function extractBuildiumErrorMessage(body: unknown): string {
  const buildiumMessage = describeBuildiumPayload((body as any)?.buildium?.payload);
  if (buildiumMessage) return buildiumMessage;
  if (typeof (body as any)?.error === 'string') return (body as any).error;
  if (typeof (body as any)?.details === 'string') return (body as any).details;
  return FALLBACK_BILL_ERROR_MESSAGE;
}

function extractBuildiumSuccessDescription(body: unknown): string | null {
  const payload = (body as any)?.buildium?.payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.Id === 'number') return `Buildium confirmation #${record.Id}`;
  if (typeof record.Message === 'string') return record.Message as string;
  if (typeof record.message === 'string') return record.message as string;
  return null;
}
