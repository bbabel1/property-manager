'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { Dropdown } from '@/components/ui/Dropdown';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export type OwnerDrawOptions = {
  owners: Array<{ id: string; name: string; buildiumOwnerId: number; disbursementPercentage: number | null }>;
  bankAccount: {
    id: string;
    name: string | null;
    buildiumBankId: number | null;
    glAccountId: string | null;
    glAccountBuildiumId: number | null;
  } | null;
  ownerDrawAccount: {
    id: string;
    name: string;
    buildiumGlAccountId: number | null;
  } | null;
  propertyContext: {
    propertyId: string | null;
    unitId: string | null;
    buildiumPropertyId: number | null;
    buildiumUnitId: number | null;
  };
};

export type OwnerDrawSuccessPayload = {
  transactionId?: string;
  amount?: number;
  memo?: string | null;
  date?: string;
  referenceNumber?: string | null;
  accountName?: string | null;
  transactionType?: string;
  transaction?: Record<string, unknown>;
  values?: Record<string, unknown>;
};

type OwnerDrawFormProps = {
  monthlyLogId: string;
  propertyId: string | null;
  unitId: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  options?: OwnerDrawOptions | null;
  loading?: boolean;
  error?: unknown;
  defaultAmount?: number | null;
  onCancel?: () => void;
  onSuccess?: (payload?: OwnerDrawSuccessPayload) => void;
};

const FormSchema = z.object({
  payeeId: z.string().min(1, 'Select a payee'),
  date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  memo: z.string().optional(),
  checkNumber: z.string().optional(),
  referenceNumber: z.string().optional(),
});

const formatError = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Something went wrong while loading owner draw options.';
};

export default function OwnerDrawForm({
  monthlyLogId,
  propertyId,
  unitId,
  propertyName: _propertyName,
  unitLabel: _unitLabel,
  options,
  loading = false,
  error,
  defaultAmount,
  onCancel,
  onSuccess,
}: OwnerDrawFormProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    payeeId: '',
    date: today,
    amount: '',
    memo: '',
    checkNumber: '',
    referenceNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const ownerOptions = options?.owners ?? [];
  const propertyContext = options?.propertyContext ?? {
    propertyId,
    unitId,
    buildiumPropertyId: null,
    buildiumUnitId: null,
  };

  const bankAccount = options?.bankAccount ?? null;
  const ownerDrawAccount = options?.ownerDrawAccount ?? null;

  const readyOwners = useMemo(
    () =>
      ownerOptions
        .filter((owner) => Number.isFinite(owner.buildiumOwnerId))
        .map((owner) => ({
          value: owner.id,
          label: owner.name,
        })),
    [ownerOptions],
  );

  const payeeMissing =
    !ownerOptions.length ||
    readyOwners.length === 0 ||
    (form.payeeId && !ownerOptions.some((owner) => owner.id === form.payeeId));

  const selectedOwner = ownerOptions.find((owner) => owner.id === form.payeeId);
  const disbursementPercentage = selectedOwner?.disbursementPercentage ?? null;

  useEffect(() => {
    if (
      defaultAmount == null ||
      Number.isNaN(defaultAmount) ||
      disbursementPercentage == null ||
      Number.isNaN(disbursementPercentage) ||
      !form.payeeId
    ) {
      return;
    }
    const calculated = Number(defaultAmount) * (Number(disbursementPercentage) / 100);
    const formatted = Number.isFinite(calculated) ? calculated.toFixed(2) : '';
    setForm((prev) => ({ ...prev, amount: formatted }));
  }, [defaultAmount, disbursementPercentage, form.payeeId]);

  const amountNumber = useMemo(() => {
    const parsed = Number(form.amount);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [form.amount]);

  const hasPropertyAndUnit = Boolean(propertyContext.propertyId && propertyContext.unitId);

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Loading owner draw settings…
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load owner draw settings</AlertTitle>
        <AlertDescription>{formatError(error)}</AlertDescription>
      </Alert>
    );
  }

  if (!hasPropertyAndUnit) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Link required</AlertTitle>
        <AlertDescription>
          Link this monthly log to a property and unit before recording an owner draw.
        </AlertDescription>
      </Alert>
    );
  }

  if (!propertyContext.buildiumPropertyId || !propertyContext.buildiumUnitId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Missing Buildium mapping</AlertTitle>
        <AlertDescription>
          Ensure the property and unit are synced with Buildium before recording an owner draw.
        </AlertDescription>
      </Alert>
    );
  }

  if (!bankAccount?.buildiumBankId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Operating bank account required</AlertTitle>
        <AlertDescription>
          Add an operating bank account with a Buildium mapping to this property before recording an
          owner draw.
        </AlertDescription>
      </Alert>
    );
  }

  if (!bankAccount.glAccountBuildiumId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Bank account GL mapping missing</AlertTitle>
        <AlertDescription>
          Map the operating bank account to a Buildium GL account before creating an owner draw.
        </AlertDescription>
      </Alert>
    );
  }

  if (!ownerDrawAccount?.buildiumGlAccountId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Owner Draw account missing</AlertTitle>
        <AlertDescription>
          Add a GL account named &ldquo;Owner Draw&rdquo; with a Buildium mapping before creating an
          owner draw.
        </AlertDescription>
      </Alert>
    );
  }

  if (!ownerOptions.length || payeeMissing) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No eligible owners</AlertTitle>
        <AlertDescription>
          Add at least one owner with a Buildium Owner ID to this property before recording an owner
          draw.
        </AlertDescription>
      </Alert>
    );
  }

  const canSubmit =
    Boolean(form.payeeId) &&
    Boolean(form.date) &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    !submitting;

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((prev) => ({ ...prev, [key as string]: '' }));
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = FormSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.flatten().fieldErrors;
      const nextErrors: Record<string, string> = {};
      if (issue.payeeId?.[0]) nextErrors.payeeId = issue.payeeId[0];
      if (issue.date?.[0]) nextErrors.date = issue.date[0];
      if (issue.amount?.[0]) nextErrors.amount = issue.amount[0];
      setErrors(nextErrors);
      return;
    }

    const payee = ownerOptions.find((owner) => owner.id === parsed.data.payeeId);
    if (!payee || !Number.isFinite(payee.buildiumOwnerId)) {
      setFormError('Select an owner with a valid Buildium mapping.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/owner-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeeId: parsed.data.payeeId,
          date: parsed.data.date,
          amount: parsed.data.amount,
          memo: parsed.data.memo || null,
          checkNumber: parsed.data.checkNumber || null,
          referenceNumber: parsed.data.referenceNumber || null,
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
          'Unable to create owner draw. Double-check the entries and try again.';
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
      const transaction =
        payload?.data?.transaction ?? payload?.transaction ?? payload ?? undefined;
      const transactionId: string | undefined =
        transaction?.id ??
        transaction?.transactionId ??
        transaction?.transaction_id ??
        transaction?.transactionID;

      onSuccess?.({
        transactionId: transactionId ? String(transactionId) : undefined,
        amount: parsed.data.amount,
        memo: parsed.data.memo || null,
        date: parsed.data.date,
        referenceNumber: parsed.data.referenceNumber || null,
        accountName: ownerDrawAccount.name,
        transactionType: transaction?.transaction_type ?? undefined,
        transaction,
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unable to create owner draw right now.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {formError ? (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">
            Payee *
          </span>
          <Dropdown
            value={form.payeeId}
            onChange={(value) => updateField('payeeId', value)}
            options={readyOwners}
            placeholder="Select owner"
            className="w-full"
          />
          {disbursementPercentage != null ? (
            <span className="text-xs text-slate-600">
              Disbursement: {Number(disbursementPercentage).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              %
            </span>
          ) : null}
          {errors.payeeId ? <span className="text-destructive text-xs">{errors.payeeId}</span> : null}
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">
            Date *
          </span>
          <DateInput value={form.date} onChange={(value) => updateField('date', value)} />
          {errors.date ? <span className="text-destructive text-xs">{errors.date}</span> : null}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">
            Amount *
          </span>
          <Input
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
            inputMode="decimal"
            placeholder="$0.00"
          />
          {errors.amount ? <span className="text-destructive text-xs">{errors.amount}</span> : null}
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">
            Check number
          </span>
          <Input
            value={form.checkNumber}
            onChange={(event) => updateField('checkNumber', event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">
            Reference number
          </span>
          <Input
            value={form.referenceNumber}
            onChange={(event) => updateField('referenceNumber', event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs font-semibold uppercase">Memo</span>
          <Textarea
            value={form.memo}
            onChange={(event) => updateField('memo', event.target.value)}
            placeholder="Optional note"
            className="min-h-[86px]"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="sm:min-w-[160px]" disabled={!canSubmit}>
          {submitting ? 'Creating…' : 'Create owner draw'}
        </Button>
      </div>
    </form>
  );
}
