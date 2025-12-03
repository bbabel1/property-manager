'use client';

import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  extractLeaseTransactionFromResponse,
  type LeaseAccountOption,
  type LeaseFormSuccessPayload,
} from '@/components/leases/types';

type VendorOption = {
  id: string;
  name: string;
  buildiumVendorId?: number | null;
};

type AllocationRow = {
  id: string;
  account_id: string;
  amount: string;
  memo: string;
};

const BillFormSchema = z.object({
  vendor_id: z.string().min(1, 'Select a vendor'),
  date: z.string().min(1, 'Date is required'),
  due_date: z.string().optional(),
  reference_number: z.string().optional(),
  memo: z.string().optional(),
  allocations: z
    .array(
      z.object({
        account_id: z.string().min(1, 'Account is required'),
        amount: z.coerce.number().positive('Amount must be greater than zero'),
        memo: z.string().optional(),
      }),
    )
    .min(1, 'Add at least one allocation'),
});

const createId = () =>
  typeof globalThis !== 'undefined' &&
  globalThis.crypto &&
  typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);

interface CreateBillFormProps {
  monthlyLogId: string;
  vendors: VendorOption[];
  accounts: LeaseAccountOption[];
  mappedAccountCount?: number;
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
}

export default function CreateBillForm({
  monthlyLogId,
  vendors,
  accounts,
  mappedAccountCount = 0,
  onCancel,
  onSuccess,
}: CreateBillFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    vendor_id: '',
    date: today,
    due_date: '',
    reference_number: '',
    memo: '',
    allocations: [
      {
        id: createId(),
        account_id: '',
        amount: '',
        memo: '',
      },
    ] as AllocationRow[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        label: vendor.name,
      })),
    [vendors],
  );

  const expenseAccounts = useMemo(() => {
    const expense = accounts.filter(
      (account) => (account.type ?? '').toLowerCase() === 'expense',
    );
    return expense.length > 0 ? expense : accounts;
  }, [accounts]);

  const accountById = useMemo(
    () => new Map(expenseAccounts.map((account) => [account.id, account])),
    [expenseAccounts],
  );

  const mappedExpenseAccounts = useMemo(
    () => expenseAccounts.filter((account) => account.buildiumGlAccountId != null),
    [expenseAccounts],
  );

  const unmappedExpenseAccounts = useMemo(
    () => expenseAccounts.filter((account) => account.buildiumGlAccountId == null),
    [expenseAccounts],
  );

  const accountDropdownOptions = useMemo(() => {
    const readyOptions = mappedExpenseAccounts.map((account) => ({
      value: account.id,
      label: account.name,
    }));
    const needsMappingOptions = unmappedExpenseAccounts.map((account) => ({
      value: account.id,
      label: `${account.name} (map to Buildium)`,
    }));

    if (readyOptions.length && needsMappingOptions.length) {
      return [
        { label: 'Ready to sync', options: readyOptions },
        { label: 'Needs Buildium mapping', options: needsMappingOptions },
      ];
    }

    if (readyOptions.length) {
      return readyOptions;
    }

    if (needsMappingOptions.length) {
      return [{ label: 'Needs Buildium mapping', options: needsMappingOptions }];
    }

    return [];
  }, [mappedExpenseAccounts, unmappedExpenseAccounts]);

  const allocationTotal = useMemo(
    () => form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0),
    [form.allocations],
  );

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key as string]: '' }));
  }, []);

  const updateAllocation = useCallback((id: string, changes: Partial<AllocationRow>) => {
    setForm((previous) => ({
      ...previous,
      allocations: previous.allocations.map((row) =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    }));
    setErrors((previous) => ({ ...previous, allocations: '' }));
  }, []);

  const addRow = useCallback(() => {
    setForm((previous) => ({
      ...previous,
      allocations: [
        ...previous.allocations,
        { id: createId(), account_id: '', amount: '', memo: '' },
      ],
    }));
  }, []);

  const removeRow = useCallback((id: string) => {
    setForm((previous) => {
      if (previous.allocations.length === 1) return previous;
      return { ...previous, allocations: previous.allocations.filter((row) => row.id !== id) };
    });
  }, []);

  const resetErrors = () => {
    setErrors({});
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetErrors();

    const parseResult = BillFormSchema.safeParse(form);
    if (!parseResult.success) {
      const fieldIssues = parseResult.error.flatten().fieldErrors;
      const nextErrors: Record<string, string> = {};
      if (fieldIssues.vendor_id?.[0]) nextErrors.vendor_id = fieldIssues.vendor_id[0];
      if (fieldIssues.date?.[0]) nextErrors.date = fieldIssues.date[0];
      if (fieldIssues.allocations?.[0]) nextErrors.allocations = fieldIssues.allocations[0];
      setErrors(nextErrors);
      return;
    }

    if (!vendorOptions.length) {
      setFormError('Add a vendor with a Buildium mapping before creating a bill.');
      return;
    }

    if (!mappedAccountCount) {
      setFormError('Map at least one expense account before creating a bill.');
      return;
    }

    try {
      const allocationWithMissingMapping = form.allocations.find((row) => {
        if (!row.account_id) return false;
        const account = accountById.get(row.account_id);
        return !account || account.buildiumGlAccountId == null;
      });

      if (allocationWithMissingMapping) {
        setFormError(
          'One or more selected accounts still need a Buildium mapping before you can create a bill.',
        );
        return;
      }

      setSubmitting(true);
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: form.vendor_id,
          date: form.date,
          due_date: form.due_date || null,
          reference_number: form.reference_number || null,
          memo: form.memo || null,
          allocations: form.allocations.map((row) => ({
            account_id: row.account_id,
            amount: Number(row.amount || '0'),
            memo: row.memo || null,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          payload?.error?.message ||
          payload?.error ||
          'Failed to create bill. Double-check the entries and try again.';
        setFormError(message);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const transaction = extractLeaseTransactionFromResponse(payload);
      if (transaction) {
        onSuccess?.({ transaction });
      } else {
        onSuccess?.();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create bill right now.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !vendors.length || !accounts.length || !mappedAccountCount;

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {formError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {formError}
        </div>
      ) : null}
      <Card className="border-border border shadow-none">
        <CardContent className="space-y-6 px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground block text-xs font-semibold uppercase">
                Date *
              </span>
              <DateInput
                value={form.date}
                onChange={(value) => updateField('date', value)}
                className="w-full"
              />
              {errors.date ? (
                <span className="text-destructive text-xs">{errors.date}</span>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground block text-xs font-semibold uppercase">
                Due date
              </span>
              <DateInput
                value={form.due_date || ''}
                onChange={(value) => updateField('due_date', value)}
                className="w-full"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground block text-xs font-semibold uppercase">
                Pay to *
              </span>
              <Dropdown
                value={form.vendor_id}
                onChange={(value) => updateField('vendor_id', value)}
                options={vendorOptions}
                placeholder={
                  vendorOptions.length
                    ? 'Select vendor'
                    : 'Add a vendor with a Buildium ID to begin'
                }
                className="w-full"
              />
              {errors.vendor_id ? (
                <span className="text-destructive text-xs">{errors.vendor_id}</span>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground block text-xs font-semibold uppercase">
                Reference number
              </span>
              <Input
                value={form.reference_number}
                onChange={(event) => updateField('reference_number', event.target.value)}
                placeholder="INV-12345"
              />
            </label>
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground block text-xs font-semibold uppercase">
              Memo
            </span>
            <Textarea
              value={form.memo}
              onChange={(event) => updateField('memo', event.target.value)}
              placeholder="Add a memo for this entry"
              rows={3}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="border-border border shadow-none">
        <CardContent className="space-y-4 px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Line items</p>
              <p className="text-muted-foreground text-xs">
                Select the expense accounts for this bill. Amounts are automatically summed.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>
          {!mappedAccountCount ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Map at least one GL expense account to a Buildium account before saving. You can still
              view all accounts here.
            </div>
          ) : null}
          {errors.allocations ? (
            <div className="text-destructive text-xs">{errors.allocations}</div>
          ) : null}
          <div className="rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[14rem]">Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[10rem] text-right">Amount</TableHead>
                  <TableHead className="w-[4rem] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.allocations.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Dropdown
                        value={row.account_id}
                        onChange={(value) => updateAllocation(row.id, { account_id: value })}
                        options={accountDropdownOptions}
                        placeholder={
                          accountDropdownOptions.length
                            ? 'Select account'
                            : 'Map expense accounts to Buildium'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.memo}
                        onChange={(event) => updateAllocation(row.id, { memo: event.target.value })}
                        placeholder="Optional memo"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(event) => updateAllocation(row.id, { amount: event.target.value })}
                        className="text-right"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove line"
                        disabled={form.allocations.length === 1}
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-6 text-sm font-medium">
            <span className="text-muted-foreground uppercase">Total</span>
            <span>${allocationTotal.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" disabled={submitDisabled}>
          {submitting ? 'Saving…' : 'Save bill'}
        </Button>
          {submitDisabled && !submitting ? (
            <span className="text-xs text-muted-foreground">
              Add vendors and mapped expense accounts to enable saving.
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
