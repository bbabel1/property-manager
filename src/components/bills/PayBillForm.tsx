'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Dropdown } from '@/components/ui/Dropdown';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';

type BankAccountOption = {
  id: string;
  name: string;
  maskedAccountNumber: string | null;
  buildiumBankAccountId: number | null;
  isActive: boolean;
};

type PayBillFormProps = {
  bill: {
    id: string;
    buildiumBillId: number | null;
    totalAmount: number;
    vendorName: string;
    dueDate: string | null;
    date: string;
    memo: string | null;
    referenceNumber: string | null;
    propertyName: string | null;
  };
  bankAccounts: BankAccountOption[];
  defaultBankAccountId: string | null;
};

type FormState = {
  bankAccountId: string;
  date: string;
  amount: string;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  const numeric = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(numeric);
}

export default function PayBillForm({
  bill,
  bankAccounts,
  defaultBankAccountId,
}: PayBillFormProps) {
  const router = useRouter();

  const billTotal = useMemo(
    () => Math.abs(Number(bill.totalAmount ?? 0)),
    [bill.totalAmount],
  );
  const resolvedDefaultBankAccountId = useMemo(() => {
    if (!bankAccounts.length) return '';
    if (
      defaultBankAccountId &&
      bankAccounts.some((account) => account.id === defaultBankAccountId)
    ) {
      return defaultBankAccountId;
    }
    return bankAccounts[0]?.id ?? '';
  }, [bankAccounts, defaultBankAccountId]);

  const [form, setForm] = useState<FormState>(() => {
    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10);
    const amount = billTotal;
    return {
      bankAccountId: resolvedDefaultBankAccountId,
      date: isoDate,
      amount: amount > 0 ? amount.toFixed(2) : '',
    };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((prev) => {
      if (prev.bankAccountId === resolvedDefaultBankAccountId) return prev;
      return { ...prev, bankAccountId: resolvedDefaultBankAccountId };
    });
  }, [resolvedDefaultBankAccountId]);

  const paymentAmountValue = useMemo(() => {
    const parsed = Number.parseFloat(form.amount || '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [form.amount]);

  const remainingAmount = useMemo(() => {
    const remaining = billTotal - paymentAmountValue;
    return remaining > 0 ? remaining : 0;
  }, [billTotal, paymentAmountValue]);

  const bankAccountOptions = useMemo(
    () =>
      bankAccounts.map((account) => {
        const suffix = account.maskedAccountNumber ? ` • ${account.maskedAccountNumber}` : '';
        const status = account.isActive ? '' : ' (inactive)';
        return {
          value: account.id,
          label: `${account.name}${suffix}${status}`,
        };
      }),
    [bankAccounts],
  );

  const selectedBankAccount = useMemo(
    () => bankAccounts.find((account) => account.id === form.bankAccountId) ?? null,
    [bankAccounts, form.bankAccountId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!bill.buildiumBillId) {
      setFormError('This bill is not linked to Buildium, so payments cannot be submitted yet.');
      return;
    }

    if (!form.bankAccountId) {
      setFormError('Select a bank account for this payment.');
      return;
    }

    const account = bankAccounts.find((item) => item.id === form.bankAccountId);
    if (!account) {
      setFormError('Selected bank account could not be found.');
      return;
    }
    if (!account.buildiumBankAccountId) {
      setFormError('Selected bank account is missing a Buildium ID.');
      return;
    }

    if (!form.date) {
      setFormError('Enter a payment date.');
      return;
    }

    const amountValue = Number.parseFloat(form.amount || '0');
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Enter a payment amount greater than zero.');
      return;
    }

    const isoDate = new Date(`${form.date}T00:00:00`).toISOString();

    try {
      setSubmitting(true);
      const response = await fetch(`/api/buildium/bills/${bill.buildiumBillId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BankAccountId: account.buildiumBankAccountId,
          Amount: amountValue,
          Date: isoDate,
          ReferenceNumber: bill.referenceNumber?.trim() || undefined,
          Memo: bill.memo?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let message = 'Failed to submit payment.';
        try {
          const body = await response.json();
          if (body?.error) message = body.error;
          else if (body?.details?.error) message = body.details.error;
        } catch {
          // ignore JSON parse issues
        }
        setFormError(message);
        return;
      }

      router.push(`/bills/${bill.id}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to submit payment right now.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to submit payment</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {!bankAccounts.length ? (
          <Alert>
            <AlertTitle>No bank accounts found</AlertTitle>
            <AlertDescription>
              Add a bank account to continue. Once an operating account is assigned to the property,
              it will appear here automatically.
            </AlertDescription>
          </Alert>
        ) : null}

        {!bill.buildiumBillId ? (
          <Alert>
            <AlertTitle>Bill not synced to Buildium</AlertTitle>
            <AlertDescription>
              Payments must be created in Buildium. Sync this bill before recording a payment from
              Property Manager.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form className="mt-4 space-y-8" onSubmit={handleSubmit}>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment date</Label>
            <DateInput
              id="paymentDate"
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Payment amount</Label>
            <Input
              id="paymentAmount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              disabled={submitting}
              placeholder="0.00"
            />
            <p className="text-muted-foreground text-xs">
              Bill total: {formatCurrency(billTotal)}
            </p>
            {paymentAmountValue > billTotal && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <span>⚠️</span>
                <span>
                  Amount exceeds bill total by{' '}
                  {formatCurrency(paymentAmountValue - billTotal)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankAccount">Bank account</Label>
            <Dropdown
              value={form.bankAccountId}
              onChange={(value) => setForm((prev) => ({ ...prev, bankAccountId: value }))}
              options={bankAccountOptions}
              placeholder={
                bankAccounts.length ? 'Select a bank account' : 'No bank accounts available'
              }
              className={`w-full${bankAccounts.length ? '' : 'pointer-events-none opacity-60'}`}
            />
            {bill.propertyName ? (
              <p className="text-muted-foreground text-xs">
                Defaulted to the operating account for {bill.propertyName}.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2 sm:max-w-sm">
          <div>
            <span className="text-muted-foreground block text-xs tracking-wide uppercase">
              Bill total
            </span>
            <span className="text-foreground font-medium">
              {formatCurrency(billTotal)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs tracking-wide uppercase">
              Remaining
            </span>
            <span className="text-foreground font-medium">
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-3">
          <Button
            type="submit"
            disabled={
              submitting ||
              !bankAccounts.length ||
              !form.bankAccountId ||
              !selectedBankAccount ||
              !selectedBankAccount.buildiumBankAccountId ||
              !bill.buildiumBillId
            }
          >
            {submitting ? 'Submitting…' : 'Submit payment'}
          </Button>
          <Button
            type="button"
            variant="cancel"
            disabled={submitting}
            onClick={() => {
              router.push(`/bills/${bill.id}`);
              router.refresh();
            }}
            className="text-sm"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
