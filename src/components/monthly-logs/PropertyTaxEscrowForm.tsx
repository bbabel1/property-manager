'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import {
  GeneralJournalEntryForm,
  type AccountOption,
  type GeneralJournalEntryFormProps,
  type JournalEntryFieldControls,
  type JournalEntryFormValues,
  type JournalEntrySuccessPayload,
} from '@/components/financials/GeneralJournalEntryForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { parseCurrencyInput, sanitizeCurrencyInput } from '@/lib/journal-entries';

type GlAccountRow = {
  id: string | number;
  name: string;
  type?: string | null;
};

type GlAccountApiResponse =
  | {
      success: true;
      data: GlAccountRow[];
    }
  | {
      success?: false;
      error?: string;
    };

const OWNER_DRAW_NORMALIZED = 'owner draw';
const PROPERTY_TAX_ESCROW_NORMALIZED = 'property tax escrow';

const fetchGlAccounts = async (url: string): Promise<GlAccountRow[]> => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  let payload: GlAccountApiResponse | null = null;
  try {
    payload = (await response.json()) as GlAccountApiResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    const message =
      payload && payload.error ? String(payload.error) : 'Failed to load GL accounts.';
    throw new Error(message);
  }

  if (!('success' in payload) || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error('Unexpected GL accounts response format.');
  }

  return payload.data;
};

type PropertyTaxEscrowFormProps = {
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  orgId: string | null;
  onCancel: () => void;
  onSuccess: (payload?: PropertyTaxEscrowSuccessPayload) => void;
};

const fallbackLabel = (value: string | null, placeholder: string): string =>
  value && value.trim().length > 0 ? value : placeholder;

export type PropertyTaxEscrowSuccessPayload = JournalEntrySuccessPayload & {
  amount: number;
  accountLabel: string;
};

type PropertyTaxEscrowLinesContext = Parameters<
  NonNullable<GeneralJournalEntryFormProps['renderLines']>
>[0];

export default function PropertyTaxEscrowForm({
  propertyId,
  propertyName,
  unitId,
  unitLabel,
  orgId,
  onCancel,
  onSuccess,
}: PropertyTaxEscrowFormProps) {
  const accountEndpoint = useMemo(() => {
    if (!orgId) {
      return null;
    }
    const params = new URLSearchParams({
      orgId,
      isActive: 'true',
    });
    return `/api/gl-accounts?${params.toString()}`;
  }, [orgId]);

  const {
    data: accounts,
    error: accountError,
    isLoading: loadingAccounts,
  } = useSWR(accountEndpoint, fetchGlAccounts);

  const accountOptions: AccountOption[] = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((account) => {
      const label = fallbackLabel(account.name, 'GL account');
      const group = account.type || 'Other';
      return {
        value: String(account.id),
        label,
        group,
        groupLabel: account.type ? `${account.type} accounts` : 'Other accounts',
      };
    });
  }, [accounts]);

  const ownerDrawAccount = useMemo(() => {
    if (!accounts) return null;
    return accounts.find(
      (account) => account.name?.trim().toLowerCase() === OWNER_DRAW_NORMALIZED,
    );
  }, [accounts]);
  const propertyTaxEscrowAccount = useMemo(() => {
    if (!accounts) return null;
    return accounts.find(
      (account) => account.name?.trim().toLowerCase() === PROPERTY_TAX_ESCROW_NORMALIZED,
    );
  }, [accounts]);

  const ownerDrawAccountId = ownerDrawAccount ? String(ownerDrawAccount.id) : '';
  const propertyTaxEscrowAccountId = propertyTaxEscrowAccount
    ? String(propertyTaxEscrowAccount.id)
    : '';

  const initialValues = useMemo<JournalEntryFormValues>(
    () => ({
      date: new Date().toISOString().slice(0, 10),
      propertyId,
      unitId: unitId ?? '',
      memo: '',
      lines: [
        {
          accountId: ownerDrawAccountId,
          description: '',
          debit: '',
          credit: '',
        },
        {
          accountId: propertyTaxEscrowAccountId,
          description: '',
          debit: '',
          credit: '',
        },
      ],
    }),
    [ownerDrawAccountId, propertyId, propertyTaxEscrowAccountId, unitId],
  );

  const propertyOptions = useMemo(
    () => [
      {
        id: propertyId,
        label: fallbackLabel(propertyName, 'Property'),
      },
    ],
    [propertyId, propertyName],
  );

  const unitOptions = useMemo(() => {
    if (!unitId) return [];
    return [
      {
        id: unitId,
        label: fallbackLabel(unitLabel, 'Unit'),
      },
    ];
  }, [unitId, unitLabel]);

  const unitsByProperty = useMemo(() => {
    if (!unitId) return undefined;
    return {
      [propertyId]: unitOptions,
    };
  }, [propertyId, unitId, unitOptions]);

  const fieldControls: JournalEntryFieldControls = useMemo(
    () => ({
      propertyDisabled: true,
      unitDisabled: Boolean(unitId),
      disableAddLines: true,
      minLines: 2,
      lockedLineIndices: [0, 1],
      lineControls: {
        0: { creditDisabled: true, accountDisabled: true },
        1: { debitDisabled: true, accountDisabled: true },
      },
    }),
    [unitId],
  );

  const propertyTaxEscrowLabel = fallbackLabel(
    propertyTaxEscrowAccount?.name ?? null,
    'Property Tax Escrow',
  );

  const renderLines = useCallback(
    ({ control, setValue, buildiumLocked }: PropertyTaxEscrowLinesContext) => {
      return (
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
      );
    },
    [propertyTaxEscrowLabel],
  );

  const renderFooter: GeneralJournalEntryFormProps['renderFooter'] = ({
    onCancel,
    cancelButtonLabel,
    submitButtonLabel,
    additionalActions,
    canSubmit,
  }) => {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelButtonLabel || 'Cancel'}
          </Button>
        ) : null}
        <Button type="submit" disabled={!canSubmit} className="sm:min-w-[140px]">
          {submitButtonLabel || 'Save'}
        </Button>
        {additionalActions}
      </div>
    );
  };

  if (!propertyId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Property required</AlertTitle>
        <AlertDescription>
          Link this monthly log to a property before recording a property tax escrow entry.
        </AlertDescription>
      </Alert>
    );
  }

  if (!orgId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Organization missing</AlertTitle>
        <AlertDescription>
          We couldn&apos;t determine the organization for this property. Contact support to finish
          configuring GL accounts before recording this entry.
        </AlertDescription>
      </Alert>
    );
  }

  if (accountEndpoint && loadingAccounts) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Loading GL accounts…
      </div>
    );
  }

  if (accountError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load GL accounts</AlertTitle>
        <AlertDescription>{accountError instanceof Error ? accountError.message : String(accountError)}</AlertDescription>
      </Alert>
    );
  }

  if (!ownerDrawAccount && accountEndpoint) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Owner Draw account not found</AlertTitle>
        <AlertDescription>
          Add a GL account named &ldquo;Owner Draw&rdquo; to this organization before recording a
          property tax escrow entry.
        </AlertDescription>
      </Alert>
    );
  }

  if (!propertyTaxEscrowAccount && accountEndpoint) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Property Tax Escrow account not found</AlertTitle>
        <AlertDescription>
          Add a GL account named &ldquo;Property Tax Escrow&rdquo; to this organization before
          recording a property tax escrow entry.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSuccess = (payload?: JournalEntrySuccessPayload) => {
    if (!payload) {
      onSuccess(undefined);
      return;
    }

    const creditValue = payload.values.lines?.[1]?.credit ?? payload.values.lines?.[0]?.debit ?? '';
    const amount = parseCurrencyInput(creditValue);

    onSuccess({
      ...payload,
      amount,
      accountLabel: propertyTaxEscrowLabel,
    });
  };

  return (
    <GeneralJournalEntryForm
      mode="create"
      layout="modal"
      density="compact"
      propertyOptions={propertyOptions}
      unitOptions={unitOptions}
      unitsByProperty={unitsByProperty}
      accountOptions={accountOptions}
      defaultPropertyId={propertyId}
      defaultUnitId={unitId ?? ''}
      autoSelectDefaultProperty={false}
      initialValues={initialValues}
      onCancel={onCancel}
      onSuccess={handleSuccess}
      fieldControls={fieldControls}
      submitButtonLabel="Save"
      renderLines={renderLines}
      renderFooter={renderFooter}
    />
  );
}

