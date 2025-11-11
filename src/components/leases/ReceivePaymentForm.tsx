'use client';

import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { Info, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { Card, CardContent } from '@/components/ui/card';
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
  getTenantOptionValue,
  type LeaseAccountOption,
  type LeaseFormSuccessPayload,
  type LeaseTenantOption,
} from '@/components/leases/types';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_METHOD_VALUES } from '@/lib/enums/payment-method';
import type { PaymentMethodValue } from '@/lib/enums/payment-method';

const ReceivePaymentSchema = z.object({
  date: z.string().min(1, 'Date required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(PAYMENT_METHOD_VALUES, { required_error: 'Payment method required' }),
  resident_id: z.string().optional(),
  memo: z.string().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account required'),
        amount: z.number().nonnegative(),
      }),
    )
    .min(1, 'Add at least one allocation'),
  send_email: z.boolean().optional(),
  print_receipt: z.boolean().optional(),
});

type AllocationRow = {
  id: string;
  account_id: string;
  amount: string;
};

type FormState = {
  date: string | null;
  amount: string;
  payment_method: PaymentMethodValue;
  resident_id: string;
  memo: string;
  allocations: AllocationRow[];
  send_email: boolean;
  print_receipt: boolean;
};

type ReceivePaymentFormProps = {
  leaseId: number | string;
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  accounts: LeaseAccountOption[];
  tenants: LeaseTenantOption[];
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  density?: 'comfortable' | 'compact';
  hideHeader?: boolean;
};

export default function ReceivePaymentForm({
  leaseId,
  leaseSummary,
  accounts,
  tenants,
  onCancel,
  onSuccess,
  density = 'comfortable',
  hideHeader = false,
}: ReceivePaymentFormProps) {
  const createId = () =>
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const defaultTenantValue =
    tenants && tenants.length > 0 ? getTenantOptionValue(tenants[0]) : '';

  const [form, setForm] = useState<FormState>({
    date: null,
    amount: '',
    payment_method: (PAYMENT_METHOD_OPTIONS[0]?.value ?? 'Check') as PaymentMethodValue,
    resident_id: defaultTenantValue,
    memo: 'Payment',
    allocations: [{ id: createId(), account_id: '', amount: '' }],
    send_email: false,
    print_receipt: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & { allocations?: string }
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isCompact = density === 'compact';

  const shouldAutoFillFirstAllocation = useCallback((state: FormState) => {
    if (!state.allocations.length) return false;
    const [first, ...rest] = state.allocations;
    const otherRowsHaveValues = rest.some((row) => Number(row.amount || '0') > 0);
    if (otherRowsHaveValues) return false;
    const firstAmount = (first.amount || '').trim();
    if (!firstAmount || Number(first.amount || '0') === 0) return true;
    const previousPaymentAmount = (state.amount || '').trim();
    if (!previousPaymentAmount) return false;
    const firstNumeric = Number(first.amount || '0');
    const previousNumeric = Number(previousPaymentAmount || '0');
    return (
      firstAmount === previousPaymentAmount ||
      (Number.isFinite(firstNumeric) && Number.isFinite(previousNumeric) && firstNumeric === previousNumeric)
    );
  }, []);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      if (key === 'amount') {
        const normalized =
          typeof value === 'string'
            ? value
            : value == null
              ? ''
              : String(value);
        setForm((previous) => {
          const next: FormState = { ...previous, amount: normalized };
          if (shouldAutoFillFirstAllocation(previous)) {
            next.allocations = previous.allocations.map((row, index) =>
              index === 0 ? { ...row, amount: normalized } : row,
            );
          }
          return next;
        });
      } else {
        setForm((prev) => ({ ...prev, [key]: value }));
      }
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [shouldAutoFillFirstAllocation],
  );

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
        payment_method: form.payment_method,
        resident_id: form.resident_id || undefined,
        memo: form.memo,
        allocations: allocationsParsed,
        send_email: form.send_email,
        print_receipt: form.print_receipt,
      };

      const parsed = ReceivePaymentSchema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path?.[0];
          if (key === 'allocations') fieldErrors.allocations = issue.message;
          else if (typeof key === 'string') fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors as any);
        setSubmitting(false);
        return;
      }

      const amountValue = Number(form.amount || '0');
      if (allocationsTotal !== amountValue) {
        setErrors((prev) => ({
          ...prev,
          allocations: 'Allocated amounts must equal the payment amount',
        }));
        setSubmitting(false);
        return;
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...parsed.data,
            amount: amountValue,
            allocations: allocationsParsed,
          }),
        });

        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            body && typeof (body as any)?.error === 'string'
              ? ((body as any).error as string)
              : 'Failed to record payment',
          );
        }

        setForm({
          date: null,
          amount: '',
          payment_method: (PAYMENT_METHOD_OPTIONS[0]?.value ?? 'Check') as PaymentMethodValue,
          resident_id: defaultTenantValue,
          memo: 'Payment',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
          send_email: false,
          print_receipt: false,
        });
        setErrors({});
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        onSuccess?.(transactionRecord ? { transaction: transactionRecord } : undefined);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while saving payment',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [form, leaseId, onSuccess, defaultTenantValue, allocationsTotal],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {hideHeader ? null : (
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold">
            Receive payment{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
            {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
          </h1>
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Info className="h-4 w-4 flex-none" />
            <span>
              Record payments received for this lease and allocate them to outstanding balances.
            </span>
          </div>
        </div>
      )}

      <Card className="border-border/70 border shadow-sm">
        <CardContent className={cn('p-8', isCompact && 'p-6 sm:p-7')}>
          <form className={cn('space-y-10', isCompact && 'space-y-6')} onSubmit={handleSubmit}>
            <section className={cn('grid gap-6 lg:grid-cols-2', isCompact && 'gap-5')}>
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
              <label className="space-y-2">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Payment method *
                </span>
                <Dropdown
                  value={form.payment_method}
                  onChange={(value) => updateField('payment_method', value as PaymentMethodValue)}
                  options={PAYMENT_METHOD_OPTIONS}
                  placeholder="Select payment method"
                />
                {errors.payment_method ? (
                  <p className="text-destructive text-xs">{errors.payment_method}</p>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Received from
                </span>
                <Dropdown
                  value={form.resident_id}
                  onChange={(value) => updateField('resident_id', value)}
                  options={tenants.map((tenant) => ({
                    value: getTenantOptionValue(tenant),
                    label: tenant.name,
                  }))}
                  placeholder="Select resident"
                />
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

            <section className={cn('space-y-4', isCompact && 'space-y-3')}>
              <h2 className="text-foreground text-sm font-semibold">Apply payment to balances</h2>
              <div className="border-border overflow-hidden rounded-lg border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-32 text-right">Balance</TableHead>
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
                        <TableCell className="text-muted-foreground text-right text-sm">
                          $0.00
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
                      <TableCell className="text-muted-foreground text-right text-sm">
                        $0.00
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ${allocationsTotal.toFixed(2)}
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

            <div className={cn('flex flex-wrap items-center gap-4', isCompact && 'gap-3')}>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.print_receipt}
                  onChange={(event) => updateField('print_receipt', event.target.checked)}
                  className="h-4 w-4"
                />
                Print receipt
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.send_email}
                  onChange={(event) => updateField('send_email', event.target.checked)}
                  className="h-4 w-4"
                />
                Email receipt
              </label>
            </div>

            {formError ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
                {formError}
              </div>
            ) : null}

            <div className={cn('flex flex-wrap items-center gap-3', isCompact && 'gap-2')}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save payment'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Add another payment
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
