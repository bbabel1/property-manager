'use client';

import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { Info, Plus, X } from 'lucide-react';
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

const IssueRefundSchema = z.object({
  date: z.string().min(1, 'Date required'),
  bank_account_id: z.string().min(1, 'Bank account required'),
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
  bank_account_id: string;
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
}: IssueRefundFormProps) {
  const createId = () =>
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const defaultPartyValue =
    parties && parties.length > 0 ? getTenantOptionValue(parties[0]) : '';

  const [form, setForm] = useState<FormState>({
    date: null,
    bank_account_id: bankAccounts?.[0]?.id ?? '',
    payment_method: 'check',
    party_id: defaultPartyValue,
    amount: '',
    check_number: '',
    memo: '',
    queue_print: false,
    address_option: 'current',
    custom_address: '',
    allocations: [{ id: createId(), account_id: accounts?.[0]?.id ?? '', amount: '' }],
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & { allocations?: string }
  >({});
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
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setFormError(null);

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }));

      const payload = {
        date: form.date ?? '',
        bank_account_id: form.bank_account_id,
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
        setErrors(fieldErrors as any);
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

        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            body && typeof (body as any)?.error === 'string'
              ? ((body as any).error as string)
              : 'Failed to issue refund',
          );
        }

        setForm({
          date: null,
          bank_account_id: bankAccounts?.[0]?.id ?? '',
          payment_method: 'check',
          party_id: defaultPartyValue,
          amount: '',
          check_number: '',
          memo: '',
          queue_print: false,
          address_option: 'current',
          custom_address: '',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
        });
        setErrors({});
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        onSuccess?.(
          transactionRecord ? { transaction: transactionRecord } : undefined,
        );
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while issuing refund',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [form, leaseId, onSuccess, allocationsTotal, bankAccounts, defaultPartyValue],
  );

  const party = parties.find((item) => getTenantOptionValue(item) === form.party_id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row">
      <div className="flex-1 space-y-8">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold">
            Issue refund{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
            {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
          </h1>
        </div>

        <Card className="border-border/70 border shadow-sm">
          <CardContent className="space-y-10 p-8">
            <form className="space-y-10" onSubmit={handleSubmit}>
              <section className="grid gap-6 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Date *
                  </span>
                  <DatePicker
                    value={form.date}
                    onChange={(value) => updateField('date', value)}
                    placeholder="mm/dd/yyyy"
                  />
                  {errors.date ? <p className="text-destructive text-xs">{errors.date}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Bank account *
                  </span>
                  <Dropdown
                    value={form.bank_account_id}
                    onChange={(value) => updateField('bank_account_id', value)}
                    options={(bankAccounts ?? []).map((account) => ({
                      value: account.id,
                      label: account.name,
                    }))}
                    placeholder="Select bank account"
                  />
                  {errors.bank_account_id ? (
                    <p className="text-destructive text-xs">{errors.bank_account_id}</p>
                  ) : null}
                </label>
                <div className="space-y-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Refund method *
                  </span>
                  <div className="flex flex-col gap-2">
                    {['check', 'eft'].map((value) => (
                      <label
                        key={value}
                        className="text-foreground flex items-center gap-2 text-sm"
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
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Refund amount *
                  </span>
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
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Check number
                  </span>
                  <Input
                    value={form.check_number}
                    onChange={(event) => updateField('check_number', event.target.value)}
                  />
                </label>
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.queue_print}
                    onChange={(event) => updateField('queue_print', event.target.checked)}
                    className="h-4 w-4"
                  />
                  Queue for printing
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

              <section className="space-y-4">
                <h2 className="text-foreground text-sm font-semibold">Refunding accounts</h2>
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

              <section className="space-y-4">
                <h2 className="text-foreground text-sm font-semibold">Refund check address</h2>
                <div className="space-y-2">
                  {AddressOptions.map((option) => (
                    <label
                      key={option.value}
                      className="text-foreground flex items-start gap-2 text-sm"
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
                    </label>
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
                  <div className="border-border text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
                    {party.name}
                  </div>
                ) : null}
              </section>

              {formError ? (
                <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
                  {formError}
                </div>
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
          <h2 className="text-foreground text-sm font-semibold">Refund summary</h2>
          <div className="flex items-center justify-between">
            <span>Available refund amount</span>
            <span className="text-foreground font-semibold">$0.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Refunded</span>
            <span className="text-destructive">$0.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Remaining balance</span>
            <span className="text-foreground font-semibold">$0.00</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
