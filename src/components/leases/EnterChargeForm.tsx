'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  extractLeaseTransactionFromResponse,
  type LeaseAccountOption,
  type LeaseFormSuccessPayload,
} from '@/components/leases/types';
import { formatCurrency } from '@/lib/transactions/formatting';

const EnterChargeSchema = z.object({
  date: z.string().min(1, 'Date required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  memo: z.string().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account required'),
        amount: z.number().nonnegative(),
      }),
    )
    .min(1, 'Add at least one account'),
});

type AllocationRow = {
  id: string;
  account_id: string;
  amount: string;
};

type FormState = {
  date: string | null;
  amount: string;
  memo: string;
  allocations: AllocationRow[];
};

export interface EnterChargeFormProps {
  leaseId: number | string;
  accounts: LeaseAccountOption[];
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  onSubmitSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  onSubmitError?: (message?: string | null) => void;
  mode?: 'create' | 'edit';
  transactionId?: number;
  initialValues?: {
    date: string | null;
    amount: number;
    memo?: string | null;
    allocations?: Array<{ account_id: string; amount: number; memo?: string | null }>;
  };
  prefillTenantId?: string | null;
  prefillAccountId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
  layout?: 'standalone' | 'embedded';
  footerRenderer?: (context: { submitting: boolean; onCancel?: () => void }) => ReactNode;
  hideTitle?: boolean;
}

export default function EnterChargeForm({
  leaseId,
  accounts,
  onCancel,
  onSuccess,
  onSubmitSuccess,
  onSubmitError,
  mode = 'create',
  transactionId,
  initialValues,
  prefillAccountId,
  prefillAmount,
  prefillDate,
  prefillMemo,
  layout = 'standalone',
  footerRenderer,
  hideTitle = false,
}: EnterChargeFormProps) {
  const createId = () =>
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const resolvedInitial = useMemo<FormState>(() => {
    if (initialValues) {
      return {
        date: initialValues.date ?? null,
        amount: String(initialValues.amount ?? ''),
        memo: initialValues.memo ?? 'Charge',
        allocations:
          Array.isArray(initialValues.allocations) && initialValues.allocations.length
            ? initialValues.allocations.map((entry) => ({
                id: createId(),
                account_id: entry.account_id,
                amount: String(entry.amount ?? ''),
              }))
            : [{ id: createId(), account_id: '', amount: '' }],
      };
    }

    const amountStr =
      typeof prefillAmount === 'number' && Number.isFinite(prefillAmount)
        ? String(prefillAmount)
        : '';
    return {
      date: prefillDate ?? null,
      amount: amountStr,
      memo: prefillMemo ?? 'Charge',
      allocations: [
        {
          id: createId(),
          account_id: prefillAccountId ?? '',
          amount: amountStr,
        },
      ],
    };
  }, [initialValues, prefillAccountId, prefillAmount, prefillDate, prefillMemo]);

  const [form, setForm] = useState<FormState>(resolvedInitial);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & { allocations?: string }
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const updateAllocation = useCallback((id: string, changes: Partial<AllocationRow>) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    }));
    setErrors((prev) => ({ ...prev, allocations: undefined }));
  }, []);

  const addRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { id: createId(), account_id: '', amount: '' }],
    }));
  }, []);

  const removeRow = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations:
        prev.allocations.length > 1
          ? prev.allocations.filter((row) => row.id !== id)
          : prev.allocations,
    }));
  }, []);

  const allocationsTotal = useMemo(
    () => form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0),
    [form.allocations],
  );

  useEffect(() => {
    if (mode === 'edit' && initialValues) {
      setForm({
        date: initialValues.date ?? null,
        amount: initialValues.amount != null ? String(initialValues.amount) : '',
        memo: initialValues.memo ?? 'Charge',
        allocations:
          Array.isArray(initialValues.allocations) && initialValues.allocations.length
            ? initialValues.allocations.map((entry) => ({
                id: createId(),
                account_id: entry.account_id,
                amount: String(entry.amount ?? ''),
              }))
            : [{ id: createId(), account_id: '', amount: '' }],
      });
      setErrors({});
    }
  }, [mode, initialValues]);

  // Keep the first allocation amount in sync with the main Amount
  // when there is exactly one allocation row. This auto-fills the
  // accounts table Amount as the user types on the main field.
  useEffect(() => {
    setForm((prev) => {
      if (prev.allocations.length !== 1) return prev;
      const current = prev.allocations[0];
      const nextAmount = prev.amount;
      if (current.amount === nextAmount) return prev;
      return {
        ...prev,
        allocations: [{ ...current, amount: nextAmount }],
      };
    });
  }, [form.amount]);

  const accountDropdownOptions = useMemo(() => {
    if (!Array.isArray(accounts) || accounts.length === 0) return [];
    const buckets = new Map<string, { value: string; label: string }[]>();
    for (const account of accounts) {
      if (!account?.id) continue;
      const typeRaw = (account.type || '').trim();
      const normalized = typeRaw.toLowerCase();
      if (normalized !== 'income' && normalized !== 'liability') continue;
      const label = normalized === 'liability' ? 'Liability' : 'Income';
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label)!.push({ value: String(account.id), label: account.name || 'Account' });
    }

    const orderedLabels = ['Income', 'Liability'];
    const groups: { label: string; options: { value: string; label: string }[] }[] = [];
    for (const label of orderedLabels) {
      const options = buckets.get(label);
      if (!options?.length) continue;
      groups.push({ label, options: options.sort((a, b) => a.label.localeCompare(b.label)) });
    }
    return groups;
  }, [accounts]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setFormError(null);

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }));

      const payload = {
        date: form.date ?? '',
        amount: form.amount,
        memo: form.memo,
        allocations: allocationsParsed,
      };

      const parsed = EnterChargeSchema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path?.[0];
          if (key === 'allocations') fieldErrors.allocations = issue.message;
          else if (typeof key === 'string') fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }

      const amountValue = Number(form.amount || '0');
      if (allocationsTotal !== amountValue) {
        setErrors((prev) => ({
          ...prev,
          allocations: 'Allocated amounts must equal the charge amount',
        }));
        setSubmitting(false);
        return;
      }

      try {
        if (mode === 'edit' && (transactionId == null || Number.isNaN(Number(transactionId)))) {
          setFormError('Missing transaction reference; unable to edit this charge.');
          setSubmitting(false);
          return;
        }

        const endpoint =
          mode === 'edit' && transactionId != null
            ? `/api/leases/${leaseId}/transactions/${transactionId}`
            : `/api/leases/${leaseId}/charges`;
        const method = mode === 'edit' && transactionId != null ? 'PUT' : 'POST';
        const submitPayload =
          mode === 'edit'
            ? {
                transaction_type: 'Charge' as const,
                date: parsed.data.date,
                amount: amountValue,
                memo: parsed.data.memo || null,
                allocations: allocationsParsed,
              }
            : {
                date: parsed.data.date,
                amount: amountValue,
                memo: parsed.data.memo || null,
                allocations: allocationsParsed,
              };
        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitPayload),
        });

        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(
            body && typeof body?.error === 'string'
              ? body.error
              : 'Failed to record charge',
          );
        }

        if (mode === 'create') {
          setForm({
            date: null,
            amount: '',
            memo: 'Charge',
            allocations: [{ id: createId(), account_id: '', amount: '' }],
          });
          setErrors({});
        }
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        const resultPayload = transactionRecord ? { transaction: transactionRecord } : undefined;
        onSubmitSuccess?.(resultPayload);
        onSuccess?.(resultPayload);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while saving charge',
        );
        onSubmitError?.(
          error instanceof Error ? error.message : 'Unexpected error while saving charge',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [form, leaseId, onSuccess, onSubmitError, onSubmitSuccess, allocationsTotal, mode, transactionId],
  );

  return (
    <div
      className={
        layout === 'embedded'
          ? 'space-y-6'
          : 'mx-auto w-full max-w-screen-xl space-y-8 pb-10'
      }
    >
      {layout === 'standalone' && !hideTitle ? (
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold">
            {mode === 'edit' ? 'Edit charge' : 'Add charge'}
          </h1>
        </div>
      ) : null}

      {layout === 'embedded' ? (
        <div className="border-border/70 bg-card space-y-6 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-lg font-semibold">Charge</h2>
              <p className="text-muted-foreground text-sm">
                Update the transaction details and allocations.
              </p>
            </div>
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              {form.date || 'Set date'}
            </span>
          </div>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Date *
                </span>
                <DateInput
                  value={form.date || ''}
                  onChange={(nextValue) => updateField('date', nextValue)}
                />
                {errors.date ? <p className="text-destructive text-xs">{errors.date}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Amount *
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  placeholder="$0.00"
                />
                {errors.amount ? <p className="text-destructive text-xs">{errors.amount}</p> : null}
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Memo
                </span>
                <Textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => updateField('memo', event.target.value)}
                  maxLength={200}
                />
              </label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm font-semibold">Attachment</span>
                <span className="text-muted-foreground text-xs">1 file up to 20MB</span>
              </div>
              <div className="border-muted-foreground/40 bg-muted/10 rounded-lg border border-dashed px-6 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  Drag & drop file here or{' '}
                  <button type="button" className="text-primary underline" disabled>
                    browse
                  </button>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-foreground text-sm font-semibold">Apply to accounts</h2>
              <div className="border-border overflow-hidden rounded-lg border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-12 text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.allocations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Dropdown
                            value={row.account_id}
                            onChange={(value) => updateAllocation(row.id, { account_id: value })}
                            options={accountDropdownOptions}
                            placeholder="Select account"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="w-28"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) =>
                              updateAllocation(row.id, { amount: event.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row.id)}
                            aria-label="Remove allocation"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(allocationsTotal)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="link" className="px-0" type="button" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add row
              </Button>
              {errors.allocations ? (
                <p className="text-destructive text-xs">{errors.allocations}</p>
              ) : null}
            </section>

            {formError ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
                {formError}
              </div>
            ) : null}

            {footerRenderer ? (
              footerRenderer({ submitting, onCancel })
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save charge'}
                </Button>
                <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                  Add another charge
                </Button>
                <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                  Save and prepare invoice
                </Button>
                <Button
                  type="button"
                  variant="cancel"
                  className="text-muted-foreground"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </div>
      ) : (
        <form className="space-y-6 md:space-y-8" onSubmit={handleSubmit}>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:gap-6">
            <label className="space-y-2">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Date *
              </span>
              <DateInput
                value={form.date || ''}
                onChange={(nextValue) => updateField('date', nextValue)}
              />
              {errors.date ? <p className="text-destructive text-xs">{errors.date}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Amount *
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateField('amount', event.target.value)}
                placeholder="$0.00"
              />
              {errors.amount ? <p className="text-destructive text-xs">{errors.amount}</p> : null}
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Memo
              </span>
              <Textarea
                rows={3}
                value={form.memo}
                onChange={(event) => updateField('memo', event.target.value)}
                maxLength={200}
              />
            </label>
          </section>

          <section className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Apply to accounts
              </h2>
              <Button
                variant="ghost"
                className="h-9 px-2 text-sm font-semibold"
                type="button"
                onClick={addRow}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add row
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Account
                    </TableHead>
                    <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="w-12 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Remove
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.allocations.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-middle">
                        <Dropdown
                          value={row.account_id}
                          onChange={(value) => updateAllocation(row.id, { account_id: value })}
                          options={accountDropdownOptions}
                          placeholder="Select account"
                        />
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <Input
                          className="w-28 text-right"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={row.amount}
                          onChange={(event) =>
                            updateAllocation(row.id, { amount: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(row.id)}
                          aria-label="Remove allocation"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/20 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(allocationsTotal)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {errors.allocations ? (
              <p className="text-destructive text-xs">{errors.allocations}</p>
            ) : null}
          </section>

          {formError ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
              {formError}
            </div>
          ) : null}

          {footerRenderer ? (
            footerRenderer({ submitting, onCancel })
          ) : (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Total:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(allocationsTotal)}
                </span>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button type="button" variant="outline" disabled>
                  Add another charge
                </Button>
                <Button type="button" variant="outline" disabled>
                  Save and prepare invoice
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save charge'}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
