'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
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

type ManagementServicesInfo = {
  assignmentLevel: string | null;
  servicePlan: string | null;
  activeServices: string[];
};

type ManagementFeesInfo = {
  assignmentLevel: string | null;
  feeType: string | null;
  feePercent: number | null;
  feePercentage?: number | null;
  feeAmount: number | null;
  billingFrequency: string | null;
  propertyFeeType?: string | null;
  propertyFeePercent?: number | null;
  unitFeeType?: string | null;
  unitFeePercent?: number | null;
};

const BillFormSchema = z.object({
  vendor_id: z.string().min(1, 'Select a vendor'),
  date: z.string().min(1, 'Date is required'),
  due_date: z.string().optional(),
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

interface ManagementFeeFormProps {
  monthlyLogId: string;
  vendors: VendorOption[];
  accounts: LeaseAccountOption[];
  mappedAccountCount?: number;
  managementServices: ManagementServicesInfo;
  managementFees: ManagementFeesInfo;
  periodStart: string | null;
  activeLeaseRent: number | null | undefined;
  onCancel?: () => void;
  onSuccess?: (payload?: LeaseFormSuccessPayload) => void;
}

export default function ManagementFeeForm({
  monthlyLogId,
  vendors,
  accounts,
  mappedAccountCount = 0,
  managementServices,
  managementFees,
  periodStart,
  activeLeaseRent,
  onCancel,
  onSuccess,
}: ManagementFeeFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    vendor_id: '',
    date: today,
    due_date: '',
    memo: '',
    allocations: [
      {
        id: createId(),
        account_id: '',
        amount: '',
        memo: '',
      },
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

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const readyAccounts = useMemo(
    () => accounts.filter((account) => account.buildiumGlAccountId != null),
    [accounts],
  );

  const needsMappingAccounts = useMemo(
    () => accounts.filter((account) => account.buildiumGlAccountId == null),
    [accounts],
  );

  const accountDropdownOptions = useMemo(() => {
    const readyOptions = readyAccounts.map((account) => ({
      value: account.id,
      label: account.name,
    }));
    const needsMappingOptions = needsMappingAccounts.map((account) => ({
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
  }, [needsMappingAccounts, readyAccounts]);

  const allocationTotal = useMemo(
    () => form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0),
    [form.allocations],
  );

  const hasInitializedDefaults = useRef(false);

  const managementFeesIsPercentage = useMemo(() => {
    const resolved = (managementFees.feeType ?? '').toLowerCase();
    if (resolved === 'percentage') return true;
    const unitType = (managementFees.unitFeeType ?? '').toLowerCase();
    const propertyType = (managementFees.propertyFeeType ?? '').toLowerCase();
    return !resolved && (unitType === 'percentage' || propertyType === 'percentage');
  }, [managementFees.feeType, managementFees.propertyFeeType, managementFees.unitFeeType]);

  const shouldPresetManagementAccount = useMemo(() => {
    const plan = (managementServices.servicePlan ?? '').toLowerCase();
    return plan === 'full' || plan === 'basic';
  }, [managementServices.servicePlan]);

  const firstDayOfPeriod = useMemo(() => {
    if (!periodStart) return today;
    const d = startOfMonth(new Date(periodStart));
    if (Number.isNaN(d.getTime())) return today;
    return d.toISOString().slice(0, 10);
  }, [periodStart, today]);

  const defaultDueDate = useMemo(() => {
    const source = form.date || firstDayOfPeriod;
    const d = addDays(new Date(source), 30);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }, [firstDayOfPeriod, form.date]);

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key as string]: '' }));
  }, []);

  const formatCurrency = useCallback((value: number | null | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value));
  }, []);

  const buildMemo = useCallback(
    (rowAccountId: string): string | null => {
      const account = accountById.get(rowAccountId);
      const name = account?.name?.toLowerCase() ?? '';
      const isManagementFeeAccount = name.includes('management fee');
      if (!isManagementFeeAccount) return null;

      if (!managementFeesIsPercentage) return null;

      const feePercent =
        managementFees.unitFeePercent ??
        managementFees.propertyFeePercent ??
        managementFees.feePercent ??
        managementFees.feePercentage ??
        null;
      if (feePercent == null) return null;
      if (!periodStart) return null;

      const startDate = new Date(periodStart);
      if (Number.isNaN(startDate.getTime())) return null;
      const endDate = endOfMonth(startDate);
      const rentAmount = activeLeaseRent ?? null;
      if (rentAmount == null) return null;

      const startLabel = format(startDate, 'MM/dd/yyyy');
      const endLabel = format(endDate, 'MM/dd/yyyy');
      const percentValue = feePercent <= 1 ? feePercent * 100 : feePercent;
      const feeLabel =
        percentValue % 1 === 0
          ? `${percentValue}%`
          : `${Number(percentValue).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;

      return `Management Fee ${startLabel} - ${endLabel} (${feeLabel} of ${formatCurrency(rentAmount)})`;
    },
    [
      accountById,
      activeLeaseRent,
      formatCurrency,
      managementFees.feePercent,
      managementFees.feePercentage,
      managementFees.propertyFeePercent,
      managementFees.unitFeePercent,
      managementFeesIsPercentage,
      periodStart,
    ],
  );

  useEffect(() => {
    if (hasInitializedDefaults.current) return;
    const managementAccountId =
      accounts.find((account) => (account.name ?? '').toLowerCase() === 'management fees')?.id ??
      '';
    const autoMemo =
      managementFeesIsPercentage && managementAccountId
        ? buildMemo(managementAccountId) ?? ''
        : '';

    setForm({
      vendor_id: '',
      date: firstDayOfPeriod,
      due_date: addDays(new Date(firstDayOfPeriod), 30).toISOString().slice(0, 10),
      memo: '',
      allocations: [
        {
          id: createId(),
          account_id: shouldPresetManagementAccount ? managementAccountId : '',
          amount: '',
          memo: autoMemo,
        },
        {
          id: createId(),
          account_id: '',
          amount: '',
          memo: '',
        },
      ],
    });
    hasInitializedDefaults.current = true;
  }, [accounts, buildMemo, firstDayOfPeriod, managementFeesIsPercentage, shouldPresetManagementAccount]);

  const updateAllocation = useCallback(
    (id: string, changes: Partial<AllocationRow>) => {
      setForm((previous) => ({
        ...previous,
        allocations: previous.allocations.map((row) => {
          if (row.id !== id) return row;

          const nextRow = { ...row, ...changes };

          if (changes.account_id && managementFeesIsPercentage) {
            const autoMemo = row.memo
              ? row.memo
              : buildMemo(changes.account_id) ?? buildMemo(row.account_id);
            if (autoMemo && !row.memo) {
              nextRow.memo = autoMemo;
            }
          }

          return nextRow;
        }),
      }));
      setErrors((previous) => ({ ...previous, allocations: '' }));
    },
    [buildMemo],
  );

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

    const allocations = form.allocations.filter((row) => {
      const hasAccount = Boolean((row.account_id ?? '').trim());
      const hasAmount = Boolean(String(row.amount ?? '').trim());
      const hasMemo = Boolean((row.memo ?? '').trim());
      return hasAccount || hasAmount || hasMemo;
    });

    const parseResult = BillFormSchema.safeParse({ ...form, allocations });
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
      setFormError('Map at least one management fee account before creating a bill.');
      return;
    }

    try {
      const allocationWithMissingMapping = parseResult.data.allocations.find((row) => {
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
          vendor_id: parseResult.data.vendor_id,
          date: parseResult.data.date,
          due_date: parseResult.data.due_date || null,
          reference_number: null,
          memo: parseResult.data.memo || null,
          allocations: parseResult.data.allocations.map((row) => ({
            account_id: row.account_id,
            amount: row.amount,
            memo: row.memo || null,
          })),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let payload: any = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = {};
        }
        const message =
          payload?.error?.message ||
          payload?.error ||
          'Failed to create bill. Double-check the entries and try again.';
        setFormError(message);
        return;
      }

      const text = await response.text();
      let payload: any = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = {};
      }
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
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Management Services</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Assignment Level</p>
                <p className="text-sm font-medium text-foreground">
                  {managementServices.assignmentLevel || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Service Plan</p>
                <p className="text-sm font-medium text-foreground">
                  {managementServices.servicePlan || '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Active Services</p>
                <p className="text-sm font-medium text-foreground">
                  {managementServices.activeServices?.length
                    ? managementServices.activeServices.join(', ')
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Management Fees</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Fee Assignment</p>
                <p className="text-sm font-medium text-foreground">
                  {managementFees.assignmentLevel || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Fee Type</p>
                <p className="text-sm font-medium text-foreground">
                  {managementFees.feeType || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Fee Dollar Amount</p>
                <p className="text-sm font-medium text-foreground">
                  {managementFees.feeAmount != null && !Number.isNaN(Number(managementFees.feeAmount))
                    ? formatCurrency(managementFees.feeAmount)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Billing Frequency
                </p>
                <p className="text-sm font-medium text-foreground">
                  {managementFees.billingFrequency || '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border border shadow-none">
        <CardContent className="space-y-6 px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground block text-xs font-semibold uppercase">
                Date *
              </span>
              <DateInput
                value={form.date}
                onChange={(value) =>
                  setForm((previous) => {
                    const nextDate = value;
                    const nextDue = (() => {
                      const parsed = addDays(new Date(nextDate || firstDayOfPeriod), 30);
                      return Number.isNaN(parsed.getTime()) ? previous.due_date : parsed.toISOString().slice(0, 10);
                    })();
                    return { ...previous, date: nextDate, due_date: nextDue };
                  })
                }
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
                value={form.due_date || defaultDueDate}
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
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground block text-xs font-semibold uppercase">Memo</span>
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
          <div>
            <p className="text-sm font-medium text-foreground">Line items</p>
            <p className="text-muted-foreground text-xs">
              Only management fee accounts are available for selection.
            </p>
          </div>
          {!mappedAccountCount ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Map at least one management fee account to a Buildium account before saving. You can
              still view all accounts here.
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
                {form.allocations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Dropdown
                        value={row.account_id}
                        onChange={(value) => updateAllocation(row.id, { account_id: value })}
                        options={accountDropdownOptions}
                        placeholder={
                          accountDropdownOptions.length
                            ? 'Select account'
                            : 'Map management fee accounts to Buildium'
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
          <div className="flex items-center justify-between gap-3 text-sm font-medium">
            <Button
              type="button"
              size="sm"
              variant="link"
              className="gap-2 px-0 text-primary hover:text-primary"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
            <div className="flex items-center gap-6">
              <span className="text-muted-foreground uppercase">Total</span>
              <span>${allocationTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" disabled={submitDisabled}>
            {submitting ? 'Saving…' : 'Save management fee'}
          </Button>
          {submitDisabled && !submitting ? (
            <span className="text-xs text-muted-foreground">
              Add vendors and mapped management fee accounts to enable saving.
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
