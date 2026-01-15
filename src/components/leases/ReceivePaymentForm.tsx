'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { PayerRestrictionsAlert } from '@/components/payments/PayerRestrictionsAlert';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/permissions';
import type { AppRole } from '@/lib/auth/roles';
import { PaymentIntentStatus } from '@/components/payments/PaymentIntentStatus';
import { PaymentEventsTimeline } from '@/components/payments/PaymentEventsTimeline';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Body, Heading, Label } from '@/ui/typography';

const ReceivePaymentSchema = z.object({
  date: z.string().min(1, 'Date required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(PAYMENT_METHOD_VALUES),
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
  override_buildium_tenant_id: string;
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
  onSubmitSuccess?: (payload?: LeaseFormSuccessPayload) => void;
  onSubmitError?: (message?: string | null) => void;
  density?: 'comfortable' | 'compact';
  hideHeader?: boolean;
  prefillTenantId?: string | null;
  prefillAccountId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
};

export default function ReceivePaymentForm({
  leaseId,
  leaseSummary,
  accounts,
  tenants,
  onCancel,
  onSuccess,
  onSubmitSuccess,
  onSubmitError,
  density = 'comfortable',
  hideHeader = false,
  prefillTenantId,
  prefillAccountId,
  prefillAmount,
  prefillMemo,
  prefillDate,
}: ReceivePaymentFormProps) {
  const createId = useCallback(
    () =>
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    [],
  );

  const { tenantsWithBuildiumId, tenantDropdownOptions } = useMemo(() => {
    const allTenants = tenants || [];
    const withBuildium = allTenants.filter(
      (tenant) => tenant?.buildiumTenantId != null && Number.isFinite(Number(tenant.buildiumTenantId)),
    );
    const withoutBuildium = allTenants.filter(
      (tenant) => !(tenant?.buildiumTenantId != null && Number.isFinite(Number(tenant.buildiumTenantId))),
    );

    const eligibleOptions = withBuildium.map((tenant) => ({
      value: getTenantOptionValue(tenant),
      label: tenant.name,
    }));
    const missingOptions = withoutBuildium.map((tenant) => ({
      value: getTenantOptionValue(tenant),
      label: tenant.name,
    }));

    const options =
      eligibleOptions.length || missingOptions.length
        ? [
            ...(eligibleOptions.length
              ? [{ label: 'Eligible', options: eligibleOptions }]
              : []),
            ...(missingOptions.length
              ? [{ label: 'Needs Buildium ID', options: missingOptions }]
              : []),
          ]
        : [];

    return { tenantsWithBuildiumId: withBuildium, tenantDropdownOptions: options };
  }, [tenants]);

  const prefillTenantValue = useMemo(() => {
    if (!prefillTenantId) return '';
    const match = tenants?.find((tenant) => String(tenant.id) === String(prefillTenantId));
    return match ? getTenantOptionValue(match) : '';
  }, [prefillTenantId, tenants]);

  const defaultTenantValue = useMemo(
    () =>
      prefillTenantValue ||
      (tenants && tenants.length > 0 ? getTenantOptionValue(tenants[0]) : ''),
    [prefillTenantValue, tenants],
  );

  const initialFormState = useMemo<FormState>(() => {
    const amountString =
      typeof prefillAmount === 'number' && Number.isFinite(prefillAmount)
        ? String(prefillAmount)
        : '';
    const defaultAccountId =
      prefillAccountId ??
      (Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0].id) : '');
    return {
      date: prefillDate ?? null,
      amount: amountString,
      payment_method: (PAYMENT_METHOD_OPTIONS[0]?.value ?? 'Check') as PaymentMethodValue,
      resident_id: defaultTenantValue,
      memo: prefillMemo ?? 'Payment',
      allocations: [{ id: createId(), account_id: defaultAccountId, amount: amountString }],
      send_email: false,
      print_receipt: false,
      override_buildium_tenant_id: '',
    };
  }, [accounts, createId, defaultTenantValue, prefillAccountId, prefillAmount, prefillDate, prefillMemo]);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & { allocations?: string }
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<
    { id: string; restriction_type: string; restricted_until: string | null; reason: string | null; methods: string[] }[]
  >([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [lastIntentState, setLastIntentState] = useState<string | null>(null);
  const [eventHistory, setEventHistory] = useState<any[]>([]);

  useEffect(() => {
    setForm(initialFormState);
    setErrors({});
    setFormError(null);
    setLastIntentState(null);
    setEventHistory([]);
  }, [initialFormState]);

  useEffect(() => {
    const payerOption = tenants?.find((t) => getTenantOptionValue(t) === form.resident_id);
    const payerId = payerOption?.id;
    if (!payerId) {
      setRestrictions([]);
      return;
    }

    let active = true;
    const fetchRestrictions = async () => {
      try {
        const res = await fetch(`/api/payers/${payerId}/restrictions`);
        if (!active) return;
        if (!res.ok) {
          setRestrictions([]);
          return;
        }
        const json = await res.json().catch(() => null);
        const data = Array.isArray(json?.data) ? json.data : [];
        setRestrictions(
          data.map((r: any) => ({
            id: r.id,
            restriction_type: r.restriction_type,
            restricted_until: r.restricted_until,
            reason: r.reason ?? null,
            methods: Array.isArray(r?.methods) ? r.methods : [],
          })),
        );
      } catch (err) {
        console.warn('Failed to fetch payer restrictions', err);
        setRestrictions([]);
      }
    };

    fetchRestrictions();
    return () => {
      active = false;
    };
  }, [form.resident_id, tenants]);

  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        const roleList =
          ((data.user?.app_metadata as any)?.roles ||
            (data.user?.user_metadata as any)?.roles ||
            []) as AppRole[];
        if (Array.isArray(roleList)) {
          setRoles(roleList.filter((r): r is AppRole => typeof r === 'string'));
        }
      })
      .catch(() => setRoles([]));
  }, []);

  const handleClearRestriction = useCallback(
    async (restrictionId: string) => {
      const payerOption = tenants?.find((t) => getTenantOptionValue(t) === form.resident_id);
      const payerId = payerOption?.id;
      if (!payerId) return;
      try {
        const res = await fetch(`/api/payers/${payerId}/restrictions/${restrictionId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message =
            res.status === 403
              ? 'You do not have permission to clear this restriction.'
              : res.status === 404
                ? 'Restriction not found or already cleared.'
                : (body as any)?.error ?? 'Failed to clear restriction.';
          setFormError(message);
          return;
        }
        setRestrictions((prev) => prev.filter((r) => r.id !== restrictionId));
      } catch (_err) {
        setFormError('Failed to clear restriction.');
      }
    },
    [form.resident_id, tenants],
  );

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
        const isResident = key === 'resident_id';
        setForm((prev) => ({
          ...prev,
          [key]: value,
          ...(isResident ? { override_buildium_tenant_id: '' } : null),
        }));
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

  const accountDropdownOptions = useMemo(() => {
    if (!Array.isArray(accounts) || accounts.length === 0) return [];
    const buckets = new Map<string, { value: string; label: string }[]>();
    for (const account of accounts) {
      if (!account?.id) continue;
      const typeRaw = (account.type || '').trim();
      const label = typeRaw ? typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1) : 'Other';
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label)!.push({ value: String(account.id), label: account.name || 'Account' });
    }

    const orderedLabels = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));
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
        setErrors(fieldErrors);
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

      // Prevent submissions with tenants missing Buildium IDs (API will reject).
      let resolvedResidentId = form.resident_id || undefined;
      if (form.resident_id) {
        const selectedTenant = tenants?.find(
          (tenant) => getTenantOptionValue(tenant) === form.resident_id,
        );
        const tenantHasBuildiumId =
          selectedTenant &&
          selectedTenant.buildiumTenantId != null &&
          Number.isFinite(Number(selectedTenant.buildiumTenantId));
        if (selectedTenant && !tenantHasBuildiumId) {
          const override = form.override_buildium_tenant_id.trim();
          const overrideNumber = Number(override);
          if (!override) {
            setFormError(
              'Enter the Buildium tenant ID to record a payment for this tenant.',
            );
            setSubmitting(false);
            return;
          }
          if (!Number.isFinite(overrideNumber)) {
            setFormError('Buildium tenant ID must be a number.');
            setSubmitting(false);
            return;
          }
          resolvedResidentId = override;
        }
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...parsed.data,
            resident_id: resolvedResidentId,
            amount: amountValue,
            allocations: allocationsParsed,
          }),
        });

        const body = (await res.json().catch(() => null)) as
          | { error?: string; data?: { intent_state?: string | null; intent_id?: string | null } }
          | null;
        if (!res.ok) {
          throw new Error(
            body && typeof body?.error === 'string'
              ? body.error
              : 'Failed to record payment',
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
        setLastIntentState(body?.data?.intent_state ?? 'submitted');
        if (body?.data?.intent_id) {
          fetch(`/api/payments/intents/${body.data.intent_id}/events`)
            .then((r) => r.json())
            .then((payload) => {
              setEventHistory(Array.isArray(payload?.data) ? payload.data : []);
            })
            .catch(() => setEventHistory([]));
        }
        const transactionRecord = extractLeaseTransactionFromResponse(body);
        const payload = transactionRecord ? { transaction: transactionRecord } : undefined;
        onSubmitSuccess?.(payload);
        onSuccess?.(payload);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Unexpected error while saving payment',
        );
        onSubmitError?.(
          error instanceof Error ? error.message : 'Unexpected error while saving payment',
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
    },
    [allocationsTotal, form, leaseId, onSuccess, onSubmitError, onSubmitSuccess, tenants, initialFormState, createId],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {hideHeader ? null : (
        <div className="space-y-1">
          <Heading as="h1" size="h3">
            Receive payment{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
            {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
          </Heading>
          <Body
            as="div"
            size="sm"
            className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900"
          >
            <Info className="h-4 w-4 flex-none" />
            <span>
              Record payments received for this lease and allocate them to outstanding balances.
            </span>
          </Body>
        </div>
      )}

      <PayerRestrictionsAlert
        restrictions={restrictions}
        onClearRestriction={
          hasPermission(roles, 'settings.write') ? handleClearRestriction : undefined
        }
      />
      <div className="flex flex-col gap-3">
        <PaymentIntentStatus state={lastIntentState} />
        <PaymentEventsTimeline events={eventHistory} />
      </div>

      <Card className="border-border/70 border shadow-sm">
        <CardContent className={cn('p-8', isCompact && 'p-6 sm:p-7')}>
          <form className={cn('space-y-10', isCompact && 'space-y-6')} onSubmit={handleSubmit}>
            <section className={cn('grid gap-6 lg:grid-cols-2', isCompact && 'gap-5')}>
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Date *
                </Label>
                <DateInput
                  value={form.date || ''}
                  onChange={(nextValue) => updateField('date', nextValue)}
                />
                {errors.date ? (
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.date}
                  </Body>
                ) : null}
              </label>
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Amount *
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  placeholder="$0.00"
                />
                {errors.amount ? (
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.amount}
                  </Body>
                ) : null}
              </label>
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Payment method *
                </Label>
                <Dropdown
                  value={form.payment_method}
                  onChange={(value) => updateField('payment_method', value as PaymentMethodValue)}
                  options={PAYMENT_METHOD_OPTIONS.filter(
                    (opt) => !restrictions.some((r) => r.methods.includes(opt.value)),
                  )}
                  placeholder="Select payment method"
                />
                {errors.payment_method ? (
                  <Body as="p" size="sm" className="text-destructive text-xs">
                    {errors.payment_method}
                  </Body>
                ) : null}
              </label>
              <label className="space-y-2">
                <Label size="xs" tone="muted" className="tracking-wide uppercase">
                  Received from
                </Label>
                <Dropdown
                  value={form.resident_id}
                  onChange={(value) => updateField('resident_id', value)}
                  options={tenantDropdownOptions}
                  placeholder="Select resident"
                />
              </label>
              {form.resident_id &&
              tenants?.find((tenant) => getTenantOptionValue(tenant) === form.resident_id) &&
              !tenants?.find(
                (tenant) =>
                  getTenantOptionValue(tenant) === form.resident_id &&
                  tenant.buildiumTenantId != null &&
                  Number.isFinite(Number(tenant.buildiumTenantId)),
              ) ? (
                <label className="space-y-2">
                  <Label size="xs" tone="muted" className="tracking-wide uppercase">
                    Buildium tenant ID (required for payments)
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.override_buildium_tenant_id}
                    onChange={(event) =>
                      updateField('override_buildium_tenant_id', event.target.value)
                    }
                    placeholder="e.g., 35003"
                  />
                </label>
              ) : null}
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

            <section className={cn('space-y-4', isCompact && 'space-y-3')}>
              <Label as="h2" className="text-foreground" size="sm">
                Apply to accounts
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
