'use client';

import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Body, Heading, Label } from '@/ui/typography';

const WithholdDepositSchema = z.object({
  date: z.string().min(1, 'Date required'),
  deposit_account_id: z.string().min(1, 'Deposit account required'),
  memo: z.string().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account required'),
        amount: z.number().nonnegative(),
      }),
    )
    .min(1, 'Add at least one allocation'),
});

type AllocationRow = {
  id: string;
  account_id: string;
  amount: string;
};

type FormState = {
  date: string | null;
  deposit_account_id: string;
  memo: string;
  allocations: AllocationRow[];
};

type FormErrors = Partial<Record<keyof FormState, string>> & { allocations?: string };

export interface WithholdDepositFormProps {
  leaseId: number | string;
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  accounts: LeaseAccountOption[];
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
}

export default function WithholdDepositForm({
  leaseId,
  leaseSummary,
  accounts,
  onCancel,
  onSuccess,
}: WithholdDepositFormProps) {
  const createId = () =>
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const [form, setForm] = useState<FormState>({
    date: null,
    deposit_account_id: accounts?.[0]?.id ?? '',
    memo: 'Deposit applied to balances',
    allocations: [{ id: createId(), account_id: accounts?.[0]?.id ?? '', amount: '' }],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setFormError(null);

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }));

      const totalAmount = allocationsTotal;
      const payload = {
        date: form.date ?? '',
        deposit_account_id: form.deposit_account_id,
        memo: form.memo,
        allocations: allocationsParsed,
      };

      const parsed = WithholdDepositSchema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: FormErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path?.[0];
          if (key === 'allocations') fieldErrors.allocations = issue.message;
          else if (typeof key === 'string' && key in form) {
            const typedKey = key as keyof FormState;
            fieldErrors[typedKey] = issue.message;
          }
        }
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }

      const amountValue = totalAmount;

      try {
        const res = await fetch(`/api/leases/${leaseId}/withheld-deposits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: parsed.data.date,
            deposit_account_id: parsed.data.deposit_account_id,
            amount: amountValue,
            memo: parsed.data.memo || null,
            allocations: allocationsParsed,
          }),
        });

        const body = (await res.json().catch(() => null)) as {
          error?: string;
          data?: unknown;
          transaction?: unknown;
          lease?: unknown;
          lease_id?: string | number;
          leaseId?: string | number;
        } | null;
        if (!res.ok) {
          throw new Error(
            body && typeof body.error === 'string'
              ? body.error
              : 'Failed to withhold deposit',
          );
        }

        setForm({
          date: null,
          deposit_account_id: accounts?.[0]?.id ?? '',
          memo: 'Deposit applied to balances',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
        });
        setErrors({});
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        onSuccess?.(
          transactionRecord ? { transaction: transactionRecord } : undefined,
        );
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while withholding deposit',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [accounts, allocationsTotal, form, leaseId, onSuccess],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-1">
        <Heading as="h1" size="h3">
          Withhold deposit{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
          {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
        </Heading>
      </div>

      <Card className="border-border/70 border shadow-sm">
        <CardContent className="space-y-10 p-8">
          <form className="space-y-10" onSubmit={handleSubmit}>
            <section className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Date *
                </Label>
                <DatePicker
                  value={form.date}
                  onChange={(value) => updateField('date', value)}
                  placeholder="mm/dd/yyyy"
                />
                {errors.date ? (
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.date}
                  </Body>
                ) : null}
              </label>
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Deposit *
                </Label>
                <Dropdown
                  value={form.deposit_account_id}
                  onChange={(value) => updateField('deposit_account_id', value)}
                  options={(accounts ?? []).map((account) => ({
                    value: String(account.id),
                    label: account.name,
                  }))}
                  placeholder="Select account"
                />
                {errors.deposit_account_id ? (
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.deposit_account_id}
                  </Body>
                ) : null}
              </label>
              <label className="space-y-2 lg:col-span-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Memo
                </Label>
                <Textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => updateField('memo', event.target.value)}
                  maxLength={200}
                />
                <Body as="div" tone="muted" size="sm" className="text-right text-xs">
                  {form.memo.length}/200
                </Body>
              </label>
            </section>

            <div className="space-y-4">
              <div>
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Attachment
                </Label>
                <Body
                  as="div"
                  size="sm"
                  tone="muted"
                  className="border-border mt-2 rounded-md border border-dashed px-6 py-10 text-center"
                >
                  Drag & drop file here or{' '}
                  <button type="button" className="text-primary underline">
                    browse
                  </button>
                </Body>
              </div>
            </div>

            <section className="space-y-4">
              <Label as="h2" className="text-foreground" size="sm">
                Apply deposit to balances
              </Label>
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
                            options={(accounts ?? []).map((account) => ({
                              value: String(account.id),
                              label: account.name,
                            }))}
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
                <Body as="p" size="sm" className="text-destructive text-xs">
                  {errors.allocations}
                </Body>
              ) : null}
            </section>

            {formError ? (
              <Body
                as="div"
                size="sm"
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3"
              >
                {formError}
              </Body>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Withhold deposit'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Withhold another deposit
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
