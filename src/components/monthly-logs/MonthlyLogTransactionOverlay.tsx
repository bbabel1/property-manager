'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LeaseTenantOption } from '@/components/leases/types';
import WithholdDepositForm from '@/components/leases/WithholdDepositForm';
import CreateBillForm from '@/components/monthly-logs/CreateBillForm';
import ManagementFeesStage from '@/components/monthly-logs/ManagementFeesStage';
import OwnerDrawForm, { type OwnerDrawSuccessPayload } from '@/components/monthly-logs/OwnerDrawForm';
import PropertyTaxEscrowForm, {
  type PropertyTaxEscrowSuccessPayload,
} from '@/components/monthly-logs/PropertyTaxEscrowForm';
import type { LeaseAccountOption, LeaseFormSuccessPayload } from '@/components/leases/types';
import {
  normalizeMonthlyLogTransaction,
  type MonthlyLogFinancialSummary,
  type MonthlyLogTransaction,
} from '@/types/monthly-log';
import { parseCurrencyInput } from '@/lib/journal-entries';
import TransactionModalContent from '@/components/transactions/TransactionModalContent';
import { Body, Heading, Label } from '@/ui/typography';

export type TransactionMode =
  | 'payment'
  | 'charge'
  | 'credit'
  | 'refund'
  | 'deposit'
  | 'bill'
  | 'managementFee'
  | 'propertyTaxEscrow'
  | 'ownerDraw';

interface MonthlyLogTransactionOverlayProps {
  isOpen: boolean;
  mode: TransactionMode;
  onModeChange: (mode: TransactionMode) => void;
  onClose: () => void;
  allowedModes?: TransactionMode[];
  leaseId: number | string;
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  tenantOptions?: LeaseTenantOption[];
  hasActiveLease: boolean;
  monthlyLogId: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  orgId: string | null;
  addAssignedTransaction: (transaction: MonthlyLogTransaction) => void;
  removeAssignedTransaction: (transactionId: string) => void;
  refetchAssigned: () => Promise<void>;
  refetchFinancial: () => Promise<void>;
  financialSummary?: MonthlyLogFinancialSummary | null;
  periodStart: string | null;
  activeLease?: { rent_amount: number | null } | null;
}

const toNumber = (value: number | string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type ModeOption = {
  value: TransactionMode;
  label: string;
  disabled?: boolean;
  reason?: string | null;
};

type FinancialOptionsResponse = {
  accountOptions: LeaseAccountOption[];
  bankAccountOptions: Array<{ id: string; name: string }>;
  unmappedAccountCount?: number;
};

type BillOptionsResponse = {
  vendors: Array<{ id: string; name: string; buildiumVendorId?: number | null }>;
  categories: Array<{ id: string; name: string; buildiumCategoryId?: number | null }>;
  accountOptions: LeaseAccountOption[];
  unmappedAccountCount?: number;
};

type OwnerDrawOptionsResponse = {
  owners: Array<{
    id: string;
    name: string;
    buildiumOwnerId: number;
    disbursementPercentage: number | null;
  }>;
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

const LEASE_MODE_VALUES: TransactionMode[] = ['payment', 'charge', 'credit', 'refund', 'deposit'];

export default function MonthlyLogTransactionOverlay({
  isOpen,
  mode,
  onModeChange,
  onClose,
  allowedModes,
  leaseId,
  leaseSummary,
  hasActiveLease,
  monthlyLogId,
  propertyId,
  propertyName,
  unitId,
  unitLabel,
  orgId,
  addAssignedTransaction,
  removeAssignedTransaction,
  refetchAssigned,
  refetchFinancial,
  financialSummary,
  periodStart: _periodStart,
  activeLease: _activeLease,
}: MonthlyLogTransactionOverlayProps) {
  const router = useRouter();
  const [assigningTransactionId, setAssigningTransactionId] = useState<string | null>(null);
  const leaseResourceId = encodeURIComponent(String(leaseId));
  const isLeaseMode = LEASE_MODE_VALUES.includes(mode);
  const shouldLoadFinancialOptions = isOpen && Boolean(leaseId) && isLeaseMode;
  const {
    data: financialOptions,
    isLoading: loadingFinancialOptions,
    error: financialOptionsError,
    mutate: reloadFinancialOptions,
  } = useSWR<FinancialOptionsResponse>(
    shouldLoadFinancialOptions ? `/api/leases/${leaseResourceId}/financial-options` : null,
  );

  const shouldLoadBillOptions = isOpen && mode === 'bill';
  const {
    data: billOptions,
    isLoading: loadingBillOptions,
    error: billOptionsError,
    mutate: reloadBillOptions,
  } = useSWR<BillOptionsResponse>(
    shouldLoadBillOptions ? `/api/monthly-logs/${monthlyLogId}/bill-options` : null,
  );

  const shouldLoadOwnerDrawOptions = isOpen && mode === 'ownerDraw';
  const {
    data: ownerDrawOptions,
    isLoading: loadingOwnerDrawOptions,
    error: ownerDrawOptionsError,
  } = useSWR<OwnerDrawOptionsResponse>(
    shouldLoadOwnerDrawOptions ? `/api/monthly-logs/${monthlyLogId}/owner-draw-options` : null,
  );

  const leaseAccountOptions = useMemo(
    () =>
      (financialOptions?.accountOptions ?? []).filter(
        (option) => option.buildiumGlAccountId != null,
      ),
    [financialOptions?.accountOptions],
  );
  const billAccountOptions = useMemo(
    () => billOptions?.accountOptions ?? [],
    [billOptions?.accountOptions],
  );
  const mappedBillAccounts = billAccountOptions.filter(
    (option) => option.buildiumGlAccountId != null,
  );
  const accountOptions =
    leaseAccountOptions.length > 0 ? leaseAccountOptions : mappedBillAccounts;
  const bankAccountOptions = financialOptions?.bankAccountOptions ?? [];
  const leaseOptionsReady = Boolean(financialOptions);
  const billOptionsReady = Boolean(billOptions);
  const accountWarningSource =
    leaseAccountOptions.length > 0 ? financialOptions?.unmappedAccountCount ?? 0 : billOptions?.unmappedAccountCount ?? 0;
  const financialOptionsWarning = accountWarningSource > 0 ? accountWarningSource : null;

  const settleData = useCallback(async () => {
    await Promise.allSettled([refetchAssigned(), refetchFinancial()]);
  }, [refetchAssigned, refetchFinancial]);

  const handleTransactionSuccess = useCallback(
    async (payload?: LeaseFormSuccessPayload) => {
      if (!payload?.transaction) {
        await settleData();
        onClose();
        return;
      }

      const leaseIdNumber = Number(payload.transaction.lease_id ?? leaseId);
      const normalizedLeaseId = Number.isFinite(leaseIdNumber) ? leaseIdNumber : toNumber(leaseId);
      const transactionId = String(payload.transaction.id);
      const normalizedTransaction: MonthlyLogTransaction = {
        id: transactionId,
        total_amount: Number(payload.transaction.total_amount ?? 0) || 0,
        memo: payload.transaction.memo ?? '',
        date: payload.transaction.date,
        transaction_type: payload.transaction.transaction_type,
        lease_id: normalizedLeaseId,
        monthly_log_id: monthlyLogId,
        reference_number:
          payload.transaction.reference_number != null
            ? String(payload.transaction.reference_number)
            : null,
      };

      addAssignedTransaction(normalizedTransaction);
      setAssigningTransactionId(transactionId);

      try {
        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/transactions/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [transactionId] }),
        });

        if (!response.ok) {
          const text = await response.text();
          let errorData: { error?: { message?: string } } = {};
          try {
            errorData = text ? JSON.parse(text) : {};
          } catch {
            errorData = { error: { message: `Request failed with status ${response.status}` } };
          }
          throw new Error(errorData.error?.message || 'Failed to assign transaction');
        }

        toast.success('Transaction assigned');
      } catch (error) {
        removeAssignedTransaction(transactionId);
        console.error('Error assigning transaction', error);
        toast.error(error instanceof Error ? error.message : 'Failed to assign transaction');
        await settleData();
        setAssigningTransactionId(null);
        return;
      }

      await settleData();
      setAssigningTransactionId(null);
      onClose();
    },
    [addAssignedTransaction, leaseId, monthlyLogId, onClose, removeAssignedTransaction, settleData],
  );

  const handlePropertyTaxEscrowSuccess = useCallback(
    async (payload?: PropertyTaxEscrowSuccessPayload) => {
      const transactionIdRaw = payload?.transactionId;
      if (!transactionIdRaw) {
        await settleData();
        onClose();
        return;
      }

      const transactionId = String(transactionIdRaw);
      setAssigningTransactionId(transactionId);

      const amount =
        payload?.amount ??
        parseCurrencyInput(
          payload?.values.lines?.[1]?.credit ?? payload?.values.lines?.[0]?.debit ?? '',
        );
      const memo = payload?.values.memo ?? null;
      const date = payload?.values.date ?? new Date().toISOString().slice(0, 10);
      const accountName = payload?.accountLabel ?? 'Escrow';

      addAssignedTransaction({
        id: transactionId,
        total_amount: amount,
        memo,
        date,
        transaction_type: 'GeneralJournalEntry',
        lease_id: null,
        monthly_log_id: monthlyLogId,
        reference_number: null,
        account_name: accountName,
      });

      try {
        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/transactions/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [transactionId] }),
        });

        if (!response.ok) {
          const text = await response.text();
          let errorData: { error?: { message?: string } } = {};
          try {
            errorData = text ? JSON.parse(text) : {};
          } catch {
            errorData = { error: { message: `Request failed with status ${response.status}` } };
          }
          throw new Error(errorData.error?.message || 'Failed to assign transaction');
        }

        toast.success('Transaction assigned');
      } catch (error) {
        removeAssignedTransaction(transactionId);
        console.error('Error assigning transaction', error);
        toast.error(error instanceof Error ? error.message : 'Failed to assign transaction');
        await settleData();
        setAssigningTransactionId(null);
        return;
      }

      await settleData();
      setAssigningTransactionId(null);
      onClose();
    },
    [addAssignedTransaction, monthlyLogId, onClose, removeAssignedTransaction, settleData],
  );

  const handleOwnerDrawSuccess = useCallback(
    async (payload?: OwnerDrawSuccessPayload) => {
      const normalizedTransaction = normalizeMonthlyLogTransaction(payload?.transaction, {
        id: payload?.transactionId,
        total_amount:
          payload?.amount ??
          (typeof payload?.values?.amount === 'number' || typeof payload?.values?.amount === 'string'
            ? parseCurrencyInput(String(payload.values.amount))
            : undefined),
        date: payload?.date,
        reference_number: payload?.referenceNumber ?? null,
        memo: payload?.memo ?? null,
        account_name: payload?.accountName ?? ownerDrawOptions?.ownerDrawAccount?.name ?? 'Owner Draw',
        transaction_type: payload?.transactionType ?? 'GeneralJournalEntry',
        monthly_log_id: monthlyLogId,
      });

      const transactionIdRaw = payload?.transactionId ?? normalizedTransaction?.id ?? null;

      if (!transactionIdRaw) {
        await settleData();
        onClose();
        return;
      }

      const transactionId = String(transactionIdRaw);
      setAssigningTransactionId(transactionId);

      const derivedAmount =
        normalizedTransaction?.total_amount ??
        payload?.amount ??
        (typeof payload?.values?.amount === 'number' || typeof payload?.values?.amount === 'string'
          ? parseCurrencyInput(String(payload.values.amount))
          : 0);
      const memo = normalizedTransaction?.memo ?? payload?.memo ?? null;
      const date =
        normalizedTransaction?.date ??
        payload?.date ??
        new Date().toISOString().slice(0, 10);
      const referenceNumber =
        normalizedTransaction?.reference_number ??
        payload?.referenceNumber ??
        null;
      const accountName =
        normalizedTransaction?.account_name ??
        payload?.accountName ??
        ownerDrawOptions?.ownerDrawAccount?.name ??
        'Owner Draw';
      const transactionType =
        normalizedTransaction?.transaction_type ??
        payload?.transactionType ??
        'GeneralJournalEntry';

      addAssignedTransaction({
        id: transactionId,
        total_amount: derivedAmount,
        memo,
        date,
        transaction_type: transactionType,
        lease_id: null,
        monthly_log_id: monthlyLogId,
        reference_number: referenceNumber ?? null,
        account_name: accountName,
      });

      await settleData();
      setAssigningTransactionId(null);
      onClose();
    },
    [
      addAssignedTransaction,
      monthlyLogId,
      onClose,
      ownerDrawOptions?.ownerDrawAccount?.name,
      settleData,
    ],
  );

  const handleOverlayClose = useCallback(() => {
    if (assigningTransactionId) return;
    onClose();
  }, [assigningTransactionId, onClose]);

  const refundDisabled =
    !hasActiveLease || !leaseOptionsReady || bankAccountOptions.length === 0 || leaseAccountOptions.length === 0;

  const billDisabledReason = (() => {
    if (!shouldLoadBillOptions && !billOptions && !billOptionsError) return null;
    if (loadingBillOptions) return 'Loading bill settings…';
    if (billOptionsError) return 'Unable to load bill options.';
    if (!billOptions?.vendors?.length)
      return 'Add a vendor with a Buildium mapping before creating bills.';
    if (!billAccountOptions.length) return 'Add GL expense accounts before creating bills.';
    return null;
  })();

  const managementFeeDisabledReason = (() => {
    if (!propertyId || !unitId)
      return 'Link this monthly log to a property and unit to record management fees.';
    return null;
  })();

  const disabledLeaseReason = hasActiveLease
    ? null
    : 'Link an active lease to create lease transactions.';

  const baseModeOptions: ModeOption[] = useMemo(
    () => [
      {
        value: 'payment',
        label: 'Lease payment',
        disabled: !hasActiveLease,
        reason: disabledLeaseReason,
      },
      {
        value: 'charge',
        label: 'Lease charge',
        disabled: !hasActiveLease,
        reason: disabledLeaseReason,
      },
      {
        value: 'credit',
        label: 'Lease credit',
        disabled: !hasActiveLease,
        reason: disabledLeaseReason,
      },
      {
        value: 'refund',
        label: 'Issue refund',
        disabled: refundDisabled,
        reason: refundDisabled
          ? disabledLeaseReason ?? (!leaseOptionsReady ? 'Loading bank accounts…' : 'Add a bank account before issuing refunds.')
          : null,
      },
      {
        value: 'deposit',
        label: 'Withhold deposit',
        disabled: !hasActiveLease,
        reason: disabledLeaseReason,
      },
      {
        value: 'bill',
        label: 'Bill',
        disabled: Boolean(billDisabledReason),
        reason: billDisabledReason,
      },
      {
        value: 'managementFee',
        label: 'Management fee',
        disabled: Boolean(managementFeeDisabledReason),
        reason: managementFeeDisabledReason,
      },
      {
        value: 'propertyTaxEscrow',
        label: 'Escrow',
        disabled: !propertyId || !orgId,
        reason: !propertyId
          ? 'Link this monthly log to a property to record escrow.'
          : !orgId
            ? 'Add this property to an organization to record escrow.'
            : null,
      },
      {
        value: 'ownerDraw',
        label: 'Owner Draw',
        disabled: !propertyId || !unitId,
        reason: !propertyId
          ? 'Link this monthly log to a property and unit to record owner draw.'
          : !unitId
            ? 'Link this monthly log to a unit to record owner draw.'
            : null,
      },
    ],
    [
      billDisabledReason,
      managementFeeDisabledReason,
      disabledLeaseReason,
      hasActiveLease,
      orgId,
      propertyId,
      leaseOptionsReady,
      refundDisabled,
      unitId,
    ],
  );

  const modeOptions: ModeOption[] = useMemo(() => {
    if (!allowedModes || allowedModes.length === 0) {
      return baseModeOptions;
    }
    return baseModeOptions.filter((option) => allowedModes.includes(option.value));
  }, [allowedModes, baseModeOptions]);

  useEffect(() => {
    if (!mode || !leaseId) return;
    const redirectModes: TransactionMode[] = ['charge', 'payment', 'credit', 'refund'];
    if (!redirectModes.includes(mode)) return;
    const current =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '';
    const fallbackReturn = `/monthly-logs/${monthlyLogId}`;
    const returnTo = current || fallbackReturn;
    const base =
      mode === 'payment'
        ? `/leases/${leaseId}/add-payment`
        : mode === 'credit'
          ? `/leases/${leaseId}/add-credit`
          : mode === 'refund'
            ? `/leases/${leaseId}/add-refund`
            : `/leases/${leaseId}/add-charge`;
    const target = `${base}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    router.push(target);
    onClose();
  }, [leaseId, mode, monthlyLogId, onClose, router]);

  useEffect(() => {
    const activeOption = modeOptions.find((option) => option.value === mode);
    if (activeOption?.disabled) {
      const fallback = modeOptions.find((option) => !option.disabled);
      if (fallback && fallback.value !== mode) {
        onModeChange(fallback.value);
      }
    }
  }, [mode, modeOptions, onModeChange]);

  const renderForm = () => {
    if (LEASE_MODE_VALUES.includes(mode) && !leaseOptionsReady) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
          <div className="flex flex-col items-center gap-2 text-center">
            <Body as="span" size="sm" tone="muted">
              {loadingFinancialOptions
                ? 'Loading lease accounts…'
                : 'Unable to load lease accounts for this lease.'}
            </Body>
            {!loadingFinancialOptions && financialOptionsError ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void reloadFinancialOptions()}
              >
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (mode === 'bill' && !billOptionsReady) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
          <div className="flex flex-col items-center gap-2 text-center">
            <Body as="span" size="sm" tone="muted">
              {loadingBillOptions ? 'Loading bill settings…' : 'Unable to load bill configuration.'}
            </Body>
            {!loadingBillOptions && billOptionsError ? (
              <Button size="sm" variant="outline" onClick={() => void reloadBillOptions()}>
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (mode === 'ownerDraw' && loadingOwnerDrawOptions) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
          <Body as="span" size="sm" tone="muted">
            Loading owner draw options…
          </Body>
        </div>
      );
    }

    const modeRequiresAccounts = LEASE_MODE_VALUES.includes(mode);

    if (modeRequiresAccounts && leaseOptionsReady && leaseAccountOptions.length === 0) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Body as="p" size="sm">
            No mapped general ledger accounts are available for this lease.
          </Body>
          <Body as="p" size="xs" tone="muted" className="mt-1">
            Update the GL account mapping in Settings before recording this transaction.
          </Body>
          {financialOptionsWarning ? (
            <Body as="p" size="xs" tone="muted" className="mt-1">
              {financialOptionsWarning} account
              {financialOptionsWarning === 1 ? '' : 's'} were hidden because a Buildium account mapping is missing.
            </Body>
          ) : null}
        </div>
      );
    }

    switch (mode) {
      case 'payment':
        return (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
            <Body as="span" size="sm" tone="muted">
              Redirecting to payment form…
            </Body>
          </div>
        );
      case 'charge':
        return (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
            <Body as="span" size="sm" tone="muted">
              Redirecting to charge form…
            </Body>
          </div>
        );
      case 'credit':
        return (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
            <Body as="span" size="sm" tone="muted">
              Redirecting to credit form…
            </Body>
          </div>
        );
      case 'refund':
        return (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100">
            <Body as="span" size="sm" tone="muted">
              Redirecting to refund form…
            </Body>
          </div>
        );
      case 'deposit':
        return (
          <WithholdDepositForm
            key="deposit"
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
          />
        );
      case 'bill':
        return (
          <CreateBillForm
            key="bill"
            monthlyLogId={monthlyLogId}
            vendors={billOptions?.vendors ?? []}
            accounts={billAccountOptions}
            mappedAccountCount={mappedBillAccounts.length}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
          />
        );
      case 'managementFee':
        return <ManagementFeesStage key="management-fee" monthlyLogId={monthlyLogId} />;
      case 'propertyTaxEscrow':
        return (
          <PropertyTaxEscrowForm
            key="property-tax-escrow"
            propertyId={propertyId}
            propertyName={propertyName}
            unitId={unitId}
            unitLabel={unitLabel}
            orgId={orgId}
            onCancel={handleOverlayClose}
            onSuccess={handlePropertyTaxEscrowSuccess}
          />
        );
      case 'ownerDraw':
        return (
          <OwnerDrawForm
            key="owner-draw"
            monthlyLogId={monthlyLogId}
            propertyId={propertyId}
            unitId={unitId}
            propertyName={propertyName}
            unitLabel={unitLabel}
            options={ownerDrawOptions}
            loading={loadingOwnerDrawOptions}
            error={ownerDrawOptionsError}
            defaultAmount={financialSummary?.netToOwner ?? null}
            onCancel={handleOverlayClose}
            onSuccess={handleOwnerDrawSuccess}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleOverlayClose();
        }
      }}
    >
      <TransactionModalContent className="max-w-4xl">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <DialogHeader className="items-start space-y-1 text-left">
              <Body as="p" size="sm" tone="muted">
                {leaseSummary.propertyUnit || 'Lease'}
                {leaseSummary.tenants ? ` • ${leaseSummary.tenants}` : ''}
              </Body>
              <DialogTitle>
                <Heading as="p" size="h4">
                  Add transaction
                </Heading>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-1.5">
            <Label size="xs" tone="muted" className="uppercase">
              Transaction type
            </Label>
            <Select value={mode} onValueChange={(value) => onModeChange(value as TransactionMode)}>
              <SelectTrigger aria-label="Transaction type">
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                {modeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    <span className="flex flex-col">
                      <span>{option.label}</span>
                      {option.reason ? (
                        <Body as="span" size="xs" tone="muted">
                          {option.reason}
                        </Body>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>{renderForm()}</div>
        </div>
      </TransactionModalContent>
    </Dialog>
  );
}
