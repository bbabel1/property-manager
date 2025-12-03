'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GeneralJournalEntryForm, {
  type GeneralJournalEntryFormProps,
  type AccountOption,
  type JournalEntryFieldControls,
  type JournalEntryFormValues,
  type PropertyOption,
  type UnitOption,
} from '@/components/financials/GeneralJournalEntryForm';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import TransactionModalContent from '@/components/transactions/TransactionModalContent';
import { sanitizeCurrencyInput } from '@/lib/journal-entries';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

type JournalEntryDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MonthlyLogTransaction | null;
  onSaved?: () => void;
};

type JournalEntryData = {
  transaction: {
    id: string;
    date: string;
    memo: string | null;
    transaction_type: string;
  };
  lines: Array<{
    id: string;
    property_id: string | null;
    gl_account_id: string | null;
    amount: number;
    posting_type: string | null;
    memo: string | null;
    unit_id: string | null;
    gl_accounts?: { name?: string | null; account_number?: string | null } | null;
    units?: { unit_number?: string | null; unit_name?: string | null } | null;
  }>;
  property: {
    id: string;
    name: string | null;
    org_id: string | null;
  } | null;
  units: Array<{
    id: string;
    unit_number: string | null;
    unit_name: string | null;
  }>;
  accounts: Array<{
    id: string;
    name: string | null;
    account_number: string | null;
    type: string | null;
  }>;
};

type PropertyTaxEscrowLinesContext = Parameters<
  NonNullable<GeneralJournalEntryFormProps['renderLines']>
>[0];

const formatAmountString = (amount: number): string => {
  return Math.abs(amount).toFixed(2);
};

export default function JournalEntryDetailDialog({
  open,
  onOpenChange,
  transaction,
  onSaved,
}: JournalEntryDetailDialogProps) {
  const [data, setData] = useState<JournalEntryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !transaction || transaction.transaction_type !== 'GeneralJournalEntry') {
      setData(null);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/journal-entries/${transaction.id}/details`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch journal entry details');
        }
        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Error fetching journal entry data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load journal entry details');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [open, transaction]);

  const initialValues = useMemo<JournalEntryFormValues | undefined>(() => {
    if (!data || !data.lines.length) return undefined;

    const lines = data.lines;
    const unitId = lines.find((line) => line.unit_id)?.unit_id
      ? String(lines.find((line) => line.unit_id)!.unit_id)
      : '';

    return {
      date: (data.transaction.date || '').slice(0, 10),
      propertyId: data.property?.id || '',
      unitId,
      memo: data.transaction.memo || '',
      lines: lines.map((line) => {
        const posting = (line.posting_type || '').toLowerCase();
        return {
          accountId: line.gl_account_id ? String(line.gl_account_id) : '',
          description: line.memo || '',
          debit: posting === 'debit' ? formatAmountString(line.amount) : '',
          credit: posting === 'credit' ? formatAmountString(line.amount) : '',
        };
      }),
    };
  }, [data]);

  const propertyOptions = useMemo<PropertyOption[]>(() => {
    if (!data?.property) return [];
    return [
      {
        id: data.property.id,
        label: data.property.name || 'Property',
      },
    ];
  }, [data]);

  const unitOptions = useMemo<UnitOption[]>(() => {
    if (!data?.units) return [];
    return data.units.map((unit) => ({
      id: unit.id,
      label: unit.unit_number || unit.unit_name || 'Unit',
    }));
  }, [data]);

  const accountOptions = useMemo<AccountOption[]>(() => {
    if (!data?.accounts) return [];
    return data.accounts.map((account) => ({
      value: account.id,
      label: account.name || account.account_number || 'Account',
      group: account.type || null,
      groupLabel: account.type || null,
    }));
  }, [data]);

  const accountOptionsForView = useMemo<AccountOption[]>(() => {
    if (accountOptions.length > 0) return accountOptions;
    if (!data?.lines?.length) return [];
    return data.lines.map((line, index) => ({
      value: line.gl_account_id ? String(line.gl_account_id) : `line-${index}`,
      label:
        line.gl_accounts?.name ||
        line.gl_accounts?.account_number ||
        `Account ${index + 1}`,
      group: null,
      groupLabel: null,
    }));
  }, [accountOptions, data?.lines]);

  const propertyTaxFieldControls = useMemo<JournalEntryFieldControls | undefined>(() => {
    if (!initialValues) return undefined;
    return {
      propertyDisabled: true,
      unitDisabled: Boolean(initialValues.unitId),
      disableAddLines: true,
      minLines: 2,
      lockedLineIndices: [0, 1],
      lineControls: {
        0: { creditDisabled: true, accountDisabled: true },
        1: { debitDisabled: true, accountDisabled: true },
      },
    };
  }, [initialValues]);

  const generalFieldControls = useMemo<JournalEntryFieldControls | undefined>(() => {
    if (!initialValues) return undefined;
    return {
      propertyDisabled: true,
      unitDisabled: Boolean(initialValues.unitId),
      minLines: initialValues.lines.length,
    };
  }, [initialValues]);

  const propertyTaxEscrowDetails = useMemo(() => {
    if (!data?.lines?.length) return null;
    const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
    const ownerLine = data.lines.find((line) => normalize(line.gl_accounts?.name) === 'owner draw');
    const escrowLine = data.lines.find(
      (line) => normalize(line.gl_accounts?.name) === 'property tax escrow',
    );
    if (!ownerLine || !escrowLine) return null;
    return {
      propertyTaxEscrowLabel: escrowLine.gl_accounts?.name || 'Escrow',
    };
  }, [data?.lines]);

  const handleSuccess = useCallback(() => {
    onOpenChange(false);
    onSaved?.();
  }, [onOpenChange, onSaved]);

  const isGeneralJournalEntry = transaction?.transaction_type === 'GeneralJournalEntry';

  if (!transaction || !isGeneralJournalEntry) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TransactionModalContent className="max-h-[90vh]">
        <DialogHeader className="sr-only">
          <DialogTitle>Journal Entry Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-sm text-slate-500">Loading journal entry details…</div>
          </div>
        ) : error ? (
          <div className="space-y-4 p-6">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : data && initialValues ? (
          propertyTaxEscrowDetails && propertyTaxFieldControls ? (
            <PropertyTaxEscrowDetail
              initialValues={initialValues}
              propertyOptions={propertyOptions}
              unitOptions={unitOptions}
              accountOptions={accountOptionsForView}
              fieldControls={propertyTaxFieldControls}
              propertyTaxEscrowLabel={propertyTaxEscrowDetails.propertyTaxEscrowLabel}
              transactionId={transaction.id}
              onSaved={handleSuccess}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <GeneralJournalEntryForm
              mode="edit"
              layout="modal"
              propertyOptions={propertyOptions}
              unitOptions={unitOptions}
              accountOptions={accountOptionsForView}
              initialValues={initialValues}
              transactionId={transaction.id}
              buildiumLocked={false}
              fieldControls={generalFieldControls}
              onCancel={() => onOpenChange(false)}
              onClose={() => onOpenChange(false)}
              onSuccess={handleSuccess}
            />
          )
        ) : data ? (
          <div className="space-y-4 p-6">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              This journal entry does not have any lines stored locally. It may not have synced yet or was created externally.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </TransactionModalContent>
    </Dialog>
  );
}

type PropertyTaxEscrowDetailProps = {
  initialValues: JournalEntryFormValues;
  propertyOptions: PropertyOption[];
  unitOptions: UnitOption[];
  accountOptions: AccountOption[];
  fieldControls: JournalEntryFieldControls;
  propertyTaxEscrowLabel: string;
  transactionId: string;
  onSaved: () => void;
  onClose: () => void;
};

function PropertyTaxEscrowDetail({
  initialValues,
  propertyOptions,
  unitOptions,
  accountOptions,
  fieldControls,
  propertyTaxEscrowLabel,
  transactionId,
  onSaved,
  onClose,
}: PropertyTaxEscrowDetailProps) {
  const renderLines = useCallback(
    ({ control, setValue, buildiumLocked }: PropertyTaxEscrowLinesContext) => (
      <div className="space-y-3">
        <FormField
          control={control}
          name="lines.1.credit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{propertyTaxEscrowLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  onChange={(event) => {
                    const sanitized = sanitizeCurrencyInput(event.target.value);
                    field.onChange(sanitized);
                    setValue('lines.1.debit', '', { shouldDirty: true, shouldValidate: true });
                    setValue('lines.0.credit', '', { shouldDirty: true, shouldValidate: true });
                    setValue('lines.0.debit', sanitized, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  inputMode="decimal"
                  placeholder="$0.00"
                  disabled={buildiumLocked}
                  aria-label={`${propertyTaxEscrowLabel} amount`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    ),
    [propertyTaxEscrowLabel],
  );

  return (
    <GeneralJournalEntryForm
      mode="edit"
      layout="modal"
      density="compact"
      propertyOptions={propertyOptions}
      unitOptions={unitOptions}
      accountOptions={accountOptions}
      initialValues={initialValues}
      transactionId={transactionId}
      buildiumLocked={false}
      fieldControls={fieldControls}
      renderLines={renderLines}
      onCancel={onClose}
      onClose={onClose}
      onSuccess={onSaved}
    />
  );
}
