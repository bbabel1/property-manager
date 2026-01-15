'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  getTenantOptionValue,
  type LeaseAccountOption,
  type LeaseFormSuccessPayload,
  type LeaseTenantOption,
} from '@/components/leases/types';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Checkbox } from '@/ui/checkbox';
import { Body, Heading, Label } from '@/ui/typography';

const IssueRefundSchema = z.object({
  date: z.string().min(1, 'Date required'),
  bank_gl_account_id: z.string().min(1, 'Bank account required'),
  payment_method: z.enum(['check', 'eft']),
  party_id: z.string().nullable().optional(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  check_number: z.string().optional(),
  memo: z.string().optional(),
  queue_print: z.boolean().optional(),
  address_option: z.enum(['current', 'tenant', 'forwarding', 'custom']),
  custom_address: z.string().optional(),
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
  bank_gl_account_id: string;
  payment_method: 'check' | 'eft';
  party_id: string;
  amount: string;
  check_number: string;
  memo: string;
  queue_print: boolean;
  address_option: 'current' | 'tenant' | 'forwarding' | 'custom';
  custom_address: string;
  allocations: AllocationRow[];
};

export interface IssueRefundFormProps {
  leaseId: number | string;
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  bankAccounts: Array<{ id: string; name: string }>;
  accounts: LeaseAccountOption[];
  parties: LeaseTenantOption[];
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  onSubmitSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  onSubmitError?: (message?: string | null) => void;
  prefillAccountId?: string | null;
  prefillBankAccountId?: string | null;
  prefillPartyId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
  prefillMethod?: 'check' | 'eft' | null;
}

const AddressOptions = [
  { value: 'current', label: 'Current unit address' },
  { value: 'tenant', label: 'Tenant address' },
  { value: 'forwarding', label: 'Forwarding address' },
  { value: 'custom', label: 'Custom' },
];

export default function IssueRefundForm({
  leaseId,
  leaseSummary,
  bankAccounts,
  accounts,
  parties,
  onCancel,
  onSuccess,
  onSubmitSuccess,
  onSubmitError,
  prefillAccountId,
  prefillBankAccountId,
  prefillPartyId,
  prefillAmount,
  prefillMemo,
  prefillDate,
  prefillMethod,
}: IssueRefundFormProps) {
  const createId = useCallback(
    () =>
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    [],
  );

  const prefillPartyValue = useMemo(() => {
    if (!prefillPartyId) return '';
    const match = parties?.find((party) => String(party.id) === String(prefillPartyId));
    return match ? getTenantOptionValue(match) : '';
  }, [parties, prefillPartyId]);

  const defaultPartyValue = useMemo(() => {
    if (prefillPartyValue) return prefillPartyValue;
    return parties && parties.length > 0 ? getTenantOptionValue(parties[0]) : '';
  }, [parties, prefillPartyValue]);

  const initialFormState = useMemo<FormState>(() => {
    const amountString =
      typeof prefillAmount === 'number' && Number.isFinite(prefillAmount)
        ? String(prefillAmount)
        : '';
    return {
      date: prefillDate ?? null,
      bank_gl_account_id: prefillBankAccountId ?? bankAccounts?.[0]?.id ?? '',
      payment_method: prefillMethod ?? 'check',
      party_id: defaultPartyValue,
      amount: amountString,
      check_number: '',
      memo: prefillMemo ?? 'Refund',
      queue_print: false,
      address_option: 'current',
      custom_address: '',
      allocations: [
        {
          id: createId(),
          account_id: prefillAccountId ?? accounts?.[0]?.id ?? '',
          amount: amountString,
        },
      ],
    };
  }, [
    accounts,
    bankAccounts,
    createId,
    defaultPartyValue,
    prefillAccountId,
    prefillAmount,
    prefillBankAccountId,
    prefillDate,
    prefillMemo,
    prefillMethod,
  ]);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & { allocations?: string }
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(initialFormState);
    setErrors({});
    setFormError(null);
  }, [initialFormState]);

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
  }, [createId]);

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
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setFormError(null);

    const allocationsParsed = form.allocations
      .filter((row) => row.account_id)
      .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }));

    const payload = {
      date: form.date ?? '',
      bank_gl_account_id: form.bank_gl_account_id,
      payment_method: form.payment_method,
      party_id: form.party_id || undefined,
      amount: form.amount,
        check_number: form.check_number || undefined,
        memo: form.memo || undefined,
        queue_print: form.queue_print,
        address_option: form.address_option,
        custom_address: form.address_option === 'custom' ? form.custom_address : undefined,
        allocations: allocationsParsed,
      };

      const parsed = IssueRefundSchema.safeParse(payload);
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
          allocations: 'Allocated amounts must equal the refund amount',
        }));
        setSubmitting(false);
        return;
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/refunds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...parsed.data,
            amount: amountValue,
            allocations: allocationsParsed,
          }),
        });

        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(
            body && typeof body?.error === 'string'
              ? body.error
              : 'Failed to issue refund',
          );
        }

        setForm({
          ...initialFormState,
          allocations: [
            {
              id: createId(),
              account_id: initialFormState.allocations[0]?.account_id ?? '',
              amount: initialFormState.amount,
            },
          ],
        });
        setErrors({});
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        const payload = transactionRecord ? { transaction: transactionRecord } : undefined;
        onSubmitSuccess?.(payload);
        onSuccess?.(payload);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while issuing refund',
        );
        onSubmitError?.(
          error instanceof Error ? error.message : 'Unexpected error while issuing refund',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [form, leaseId, onSuccess, onSubmitError, onSubmitSuccess, allocationsTotal, initialFormState, createId],
  );

  const party = parties.find((item) => getTenantOptionValue(item) === form.party_id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row">
      <div className="flex-1 space-y-8">
        <div className="space-y-1">
          <Heading as="h1" size="h3">
            Issue refund{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
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
                    Bank account *
                  </Label>
                  <Dropdown
                    value={form.bank_gl_account_id}
                    onChange={(value) => updateField('bank_gl_account_id', value)}
                    options={(bankAccounts ?? []).map((account) => ({
                      value: account.id,
                      label: account.name,
                    }))}
                    placeholder="Select bank account"
                  />
                  {errors.bank_gl_account_id ? (
                    <Body as="p" size="sm" className="text-destructive text-xs">
                      {errors.bank_gl_account_id}
                    </Body>
                  ) : null}
                </label>
                <div className="space-y-2">
                  <Label size="xs" tone="muted" className="tracking-wide uppercase">
                    Refund method *
                  </Label>
                  <div className="flex flex-col gap-2">
                    {['check', 'eft'].map((value) => (
                      <Label
                        key={value}
                        as="label"
                        size="sm"
                        className="text-foreground flex items-center gap-2"
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={value}
                          checked={form.payment_method === value}
                          onChange={() =>
                            updateField('payment_method', value as FormState['payment_method'])
                          }
                          className="h-4 w-4"
                        />
                        {value === 'check' ? 'Check' : 'EFT (learn more)'}
                      </Label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label size="xs" tone="muted" className="tracking-wide uppercase">
                    Refund amount *
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => updateField('amount', event.target.value)}
                    placeholder="$0.00"
                  />
                </div>
                <label className="space-y-2">
                  <Label size="xs" tone="muted" className="tracking-wide uppercase">
                    Check number
                  </Label>
                  <Input
                    value={form.check_number}
                    onChange={(event) => updateField('check_number', event.target.value)}
                  />
                </label>
                <Label as="label" size="sm" className="text-foreground flex items-center gap-2">
                  <Checkbox
                    checked={form.queue_print}
                    onChange={(event) => updateField('queue_print', event.target.checked)}
                    className="h-4 w-4"
                  />
                  Queue for printing
                </Label>
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
                </label>
              </section>

              <section className="space-y-4">
                <Label as="h2" className="text-foreground" size="sm">
                  Refunding accounts
                </Label>
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
                              options={(accounts ?? []).map((account) => ({
                                value: String(account.id),
                                label: account.name,
                              }))}
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
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.allocations}
                  </Body>
                ) : null}
              </section>

              <section className="space-y-4">
                <Label as="h2" className="text-foreground" size="sm">
                  Refund check address
                </Label>
                <div className="space-y-2">
                  {AddressOptions.map((option) => (
                    <Label
                      key={option.value}
                      as="label"
                      size="sm"
                      className="text-foreground flex items-start gap-2"
                    >
                      <input
                        type="radio"
                        name="refund-address"
                        value={option.value}
                        checked={form.address_option === option.value}
                        onChange={() =>
                          updateField('address_option', option.value as FormState['address_option'])
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </Label>
                  ))}
                </div>
                {form.address_option === 'custom' ? (
                  <Textarea
                    rows={3}
                    value={form.custom_address}
                    onChange={(event) => updateField('custom_address', event.target.value)}
                    placeholder="Enter custom address"
                  />
                ) : party ? (
                  <Body
                    as="div"
                    size="sm"
                    tone="muted"
                    className="border-border rounded-md border border-dashed px-4 py-3"
                  >
                    {party.name}
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
                  {submitting ? 'Saving…' : 'Save refund'}
                </Button>
                <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                  Issue refund(s)
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

      <aside className="border-border bg-muted/30 text-muted-foreground w-full max-w-sm space-y-4 rounded-lg border p-5 text-sm">
        <div className="space-y-2">
          <Label as="h2" className="text-foreground" size="sm">
            Refund summary
          </Label>
          <div className="flex items-center justify-between">
            <span>Available refund amount</span>
            <Body as="span" size="sm" className="text-foreground font-semibold">
              $0.00
            </Body>
          </div>
          <div className="flex items-center justify-between">
            <span>Refunded</span>
            <Body as="span" size="sm" className="text-destructive">
              $0.00
            </Body>
          </div>
          <div className="flex items-center justify-between">
            <span>Remaining balance</span>
            <Body as="span" size="sm" className="text-foreground font-semibold">
              $0.00
            </Body>
          </div>
        </div>
      </aside>
    </div>
  );
}
