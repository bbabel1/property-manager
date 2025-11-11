'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { Dialog, DialogHeader, DialogTitle, LargeDialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ReceivePaymentForm from '@/components/leases/ReceivePaymentForm';
import EnterChargeForm from '@/components/leases/EnterChargeForm';
import IssueCreditForm from '@/components/leases/IssueCreditForm';
import IssueRefundForm from '@/components/leases/IssueRefundForm';
import WithholdDepositForm from '@/components/leases/WithholdDepositForm';
import CreateBillForm from '@/components/monthly-logs/CreateBillForm';
import type {
  LeaseAccountOption,
  LeaseFormSuccessPayload,
  LeaseTenantOption,
} from '@/components/leases/types';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

export type TransactionMode = 'payment' | 'charge' | 'credit' | 'refund' | 'deposit' | 'bill';

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
  tenantOptions: LeaseTenantOption[];
  hasActiveLease: boolean;
  monthlyLogId: string;
  addAssignedTransaction: (transaction: MonthlyLogTransaction) => void;
  removeAssignedTransaction: (transactionId: string) => void;
  refetchAssigned: () => Promise<void>;
  refetchFinancial: () => Promise<void>;
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

export default function MonthlyLogTransactionOverlay({
  isOpen,
  mode,
  onModeChange,
  onClose,
  allowedModes,
  leaseId,
  leaseSummary,
  tenantOptions,
  hasActiveLease,
  monthlyLogId,
  addAssignedTransaction,
  removeAssignedTransaction,
  refetchAssigned,
  refetchFinancial,
}: MonthlyLogTransactionOverlayProps) {
  const [assigningTransactionId, setAssigningTransactionId] = useState<string | null>(null);
  const leaseResourceId = encodeURIComponent(String(leaseId));
  const shouldLoadFinancialOptions = isOpen && Boolean(leaseId);
  const {
    data: financialOptions,
    isLoading: loadingFinancialOptions,
  } = useSWR<FinancialOptionsResponse>(
    shouldLoadFinancialOptions ? `/api/leases/${leaseResourceId}/financial-options` : null,
  );

  const shouldLoadBillOptions = isOpen;
  const {
    data: billOptions,
    isLoading: loadingBillOptions,
  } = useSWR<BillOptionsResponse>(
    shouldLoadBillOptions ? `/api/monthly-logs/${monthlyLogId}/bill-options` : null,
  );

  const leaseAccountOptions = useMemo(
    () =>
      (financialOptions?.accountOptions ?? []).filter(
        (option) => option.buildiumGlAccountId != null,
      ),
    [financialOptions?.accountOptions],
  );
  const billAccountOptions = useMemo(
    () =>
      (billOptions?.accountOptions ?? []).filter(
        (option) => option.buildiumGlAccountId != null,
      ),
    [billOptions?.accountOptions],
  );
  const accountOptions =
    leaseAccountOptions.length > 0 ? leaseAccountOptions : billAccountOptions;
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
          const errorData = await response.json().catch(() => ({}));
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

  const handleOverlayClose = useCallback(() => {
    if (assigningTransactionId) return;
    onClose();
  }, [assigningTransactionId, onClose]);

  const refundDisabled =
    !hasActiveLease || !leaseOptionsReady || bankAccountOptions.length === 0 || leaseAccountOptions.length === 0;

  const billDisabledReason = (() => {
    if (!billOptionsReady) return loadingBillOptions ? 'Loading bill settings…' : 'Unable to load bill options.';
    if (!billOptions?.vendors?.length)
      return 'Add a vendor with a Buildium mapping before creating bills.';
    if (!accountOptions.length)
      return 'Map at least one expense account in Settings before creating bills.';
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
        label: 'Bill (unit)',
        disabled: Boolean(billDisabledReason),
        reason: billDisabledReason,
      },
    ],
    [
      billDisabledReason,
      disabledLeaseReason,
      hasActiveLease,
      leaseOptionsReady,
      refundDisabled,
    ],
  );

  const modeOptions: ModeOption[] = useMemo(() => {
    if (!allowedModes || allowedModes.length === 0) {
      return baseModeOptions;
    }
    return baseModeOptions.filter((option) => allowedModes.includes(option.value));
  }, [allowedModes, baseModeOptions]);

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
    if (mode !== 'bill' && !leaseOptionsReady) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          {loadingFinancialOptions
            ? 'Loading lease accounts…'
            : 'Unable to load lease accounts for this lease.'}
        </div>
      );
    }

    if (mode === 'bill' && !billOptionsReady) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          {loadingBillOptions ? 'Loading bill settings…' : 'Unable to load bill configuration.'}
        </div>
      );
    }

    const modeRequiresAccounts =
      mode === 'payment' || mode === 'charge' || mode === 'credit' || mode === 'refund' || mode === 'deposit';

    if (modeRequiresAccounts && leaseOptionsReady && leaseAccountOptions.length === 0) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>No mapped general ledger accounts are available for this lease.</p>
          <p className="mt-1">
            Update the GL account mapping in Settings before recording this transaction.
          </p>
          {financialOptionsWarning ? (
            <p className="mt-1 text-xs text-amber-800">
              {financialOptionsWarning} account
              {financialOptionsWarning === 1 ? '' : 's'} were hidden because a Buildium account mapping is missing.
            </p>
          ) : null}
        </div>
      );
    }

    switch (mode) {
      case 'payment':
        return (
          <ReceivePaymentForm
            key="payment"
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            tenants={tenantOptions}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
            density="compact"
            hideHeader
          />
        );
      case 'charge':
        return (
          <EnterChargeForm
            key="charge"
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
          />
        );
      case 'credit':
        return (
          <IssueCreditForm
            key="credit"
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
          />
        );
      case 'refund':
        return (
          <IssueRefundForm
            key="refund"
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            bankAccounts={bankAccountOptions}
            accounts={accountOptions}
            parties={tenantOptions}
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
          />
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
            categories={billOptions?.categories ?? []}
            accounts={
              billAccountOptions.length > 0 ? billAccountOptions : leaseAccountOptions
            }
            onCancel={handleOverlayClose}
            onSuccess={handleTransactionSuccess}
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
      <LargeDialogContent>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <DialogHeader className="items-start space-y-1 text-left">
              <p className="text-muted-foreground text-sm">
                {leaseSummary.propertyUnit || 'Lease'}
                {leaseSummary.tenants ? ` • ${leaseSummary.tenants}` : ''}
              </p>
              <DialogTitle className="text-foreground text-2xl font-semibold">
                Add transaction
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase">
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
                        <span className="text-muted-foreground text-xs">{option.reason}</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>{renderForm()}</div>
        </div>
      </LargeDialogContent>
    </Dialog>
  );
}
