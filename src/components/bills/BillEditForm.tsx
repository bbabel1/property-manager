'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, Trash2, X } from 'lucide-react';

type VendorOption = { id: string; label: string };

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
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'Failed to save bill');
        return;
      }
      router.push(`/bills/${billId}`);
      router.refresh();
    });
  };

  const propertyOptions = properties;
  const expenseAccountOptions = useMemo(
    () =>
      accounts.filter((account) =>
        String(account.type ?? '').toLowerCase().includes('expense'),
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
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold">Edit bill</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push(`/bills/${billId}`)}
          aria-label="Close edit form"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <form className="space-y-6 pb-24" onSubmit={onSubmit}>
        <Card className="border-border border shadow-sm">
          <CardContent className="space-y-8 px-6 py-6">
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Date *
                </span>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                  className="w-40"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Due *
                </span>
                <Input
                  type="date"
                  value={form.due_date || ''}
                  onChange={(e) => update('due_date', e.target.value)}
                  className="w-40"
                />
              </label>
            </div>
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                  Pay to *
                </span>
                <div className="relative w-64">
                  <select
                    value={form.vendor_id || ''}
                    onChange={(e) => update('vendor_id', e.target.value)}
                    className="border-border/60 bg-background focus-visible:ring-primary block h-9 w-full appearance-none rounded-md border px-3 pr-9 text-sm leading-tight focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Reference number
                </span>
                <Input
                  value={form.reference_number || ''}
                  onChange={(e) => update('reference_number', e.target.value)}
                  className="w-48"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Memo
              </span>
              <Textarea
                rows={3}
                value={form.memo || ''}
                onChange={(e) => update('memo', e.target.value)}
                className="w-full max-w-2xl"
              />
            </label>
            <div className="space-y-3">
              <h3 className="text-foreground text-sm font-semibold">Item details</h3>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <input
                  id="apply-markups"
                  type="checkbox"
                  className="border-border text-primary h-4 w-4 rounded"
                  disabled
                />
                <label htmlFor="apply-markups" className="select-none">
                  Apply bill markups
                </label>
              </div>
              <div className="relative pr-12">
                <div className="border-border/70 rounded-lg border">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="border-border/60 w-[18rem] border-r border-dotted">
                          Property or company
                        </TableHead>
                        <TableHead className="border-border/60 w-[12rem] border-r border-dotted">
                          Unit
                        </TableHead>
                        <TableHead className="border-border/60 w-[18rem] border-r border-dotted">
                          Account
                        </TableHead>
                        <TableHead className="border-border/60 border-r border-dotted">
                          Description
                        </TableHead>
                        <TableHead className="w-[10rem] text-right">Initial amount</TableHead>
                        <TableHead className="w-[10rem] text-right">Amount paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-border divide-y">
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
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
                              <TableRow key={l.id} className="relative align-middle">
                                <TableCell className="text-foreground border-border/60 min-w-0 border-r border-dotted px-0 align-middle">
                                  <div className="px-4 py-2.5">
                                    {editing?.id === l.id &&
                                    editing.field === 'property' &&
                                    l.posting_type !== 'Credit' ? (
                                    <div className="relative">
                                      <select
                                        autoFocus
                                        value={l.property_id || ''}
                                        onBlur={() => setEditing(null)}
                                        onChange={(e) => {
                                          setRow(l.id, {
                                            property_id: e.target.value || null,
                                            unit_id: null,
                                          });
                                          setEditing(null);
                                        }}
                                        className={cellSelectClass}
                                        aria-label="Select property"
                                      >
                                        {propertyOptions.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.label}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                                    </div>
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
                              <TableCell className="text-foreground border-border/60 min-w-0 border-r border-dotted px-0 align-middle">
                                <div className="px-4 py-2.5">
                                  {editing?.id === l.id &&
                                  editing.field === 'unit' &&
                                  l.posting_type !== 'Credit' ? (
                                    <div className="relative">
                                      <select
                                        autoFocus
                                        value={l.unit_id || ''}
                                        onBlur={() => setEditing(null)}
                                        onChange={(e) => {
                                          setRow(l.id, { unit_id: e.target.value || null });
                                          setEditing(null);
                                        }}
                                        className={cellSelectClass}
                                        aria-label="Select unit"
                                      >
                                        <option value="">Property level</option>
                                        {units
                                          .filter(
                                            (u) =>
                                              !l.property_id || u.property_id === l.property_id,
                                          )
                                          .map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {u.label}
                                            </option>
                                          ))}
                                      </select>
                                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                                    </div>
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
                              <TableCell className="text-foreground border-border/60 min-w-0 border-r border-dotted px-0 align-middle">
                                <div className="px-4 py-2.5">
                                  {editing?.id === l.id &&
                                  editing.field === 'account' &&
                                  l.posting_type !== 'Credit' ? (
                                    <div className="relative">
                                      <select
                                        autoFocus
                                        value={l.gl_account_id}
                                        onBlur={() => setEditing(null)}
                                        onChange={(e) => {
                                          setRow(l.id, { gl_account_id: e.target.value });
                                          setEditing(null);
                                        }}
                                        className={cellSelectClass}
                                        aria-label="Select account"
                                      >
                                        {currentAccountOption ? (
                                          <option value={currentAccountOption.id} disabled>
                                            {currentAccountOption.label}
                                          </option>
                                        ) : null}
                                        {expenseAccountOptions.length > 0 ? (
                                          expenseAccountOptions.map((a) => (
                                            <option key={a.id} value={a.id}>
                                              {a.label}
                                            </option>
                                          ))
                                        ) : (
                                          <option value="" disabled>
                                            No expense accounts available
                                          </option>
                                        )}
                                      </select>
                                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={cellTextButtonClass}
                                      onClick={() =>
                                        l.posting_type !== 'Credit' &&
                                        setEditing({ id: l.id, field: 'account' })
                                      }
                                    >
                                      {l.isNew && !l.gl_account_id ? '' : accountLabel(l.gl_account_id)}
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-foreground border-border/60 min-w-0 border-r border-dotted px-0 align-middle">
                                <div className="px-4 py-2.5">
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
                                      {(l.isNew && !l.description) ? '' : (l.description || '—')}
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="border-border/60 border-r border-dotted px-0 text-right align-middle font-medium">
                                <div className="px-4 py-2.5">
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
                                          onClick={() => setEditing({ id: l.id, field: 'amount' })}
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
                              <TableCell className="px-0 text-right align-middle font-medium">
                                <div className="px-4 py-2.5">
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
                            </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/30">
                            <TableCell
                              colSpan={4}
                              className="text-muted-foreground px-4 py-2.5 text-right text-xs font-semibold tracking-wide uppercase"
                            >
                              Total
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-right font-semibold">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(Math.abs(Number(total || 0)))}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-right font-semibold">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(0)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Trash bins positioned outside table border */}
                {rows
                  .filter((l) => l.posting_type !== 'Credit')
                  .map((l, index) => (
                    <button
                      key={`remove-${l.id}`}
                      type="button"
                      aria-label="Remove line"
                      className="text-destructive hover:bg-destructive/10 absolute right-0 inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                      style={{ top: `${56 + index * 57}px` }}
                      onClick={() => removeLine(l.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ))}
              </div>
              <div className="py-4 text-sm">
                <button type="button" className="text-primary hover:underline" onClick={addLine}>
                  Add line
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-primary bg-primary text-primary-foreground sticky bottom-0 z-10 mt-2 flex items-center justify-between border-t px-4 py-3">
          <div className="text-sm">
            Total bill amount:{' '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              Math.abs(Number(total || 0)),
            )}
          </div>
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
        </div>
      </form>
    </div>
  );
}
