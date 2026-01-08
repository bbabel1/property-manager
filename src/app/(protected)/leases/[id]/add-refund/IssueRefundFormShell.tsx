'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import IssueRefundForm from '@/components/leases/IssueRefundForm';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';
import { emitChargeTelemetry } from '@/lib/charge-telemetry';

export default function IssueRefundFormShell({
  leaseId,
  bankAccounts,
  accounts,
  parties,
  leaseSummary,
  returnTo,
  orgId,
  prefillAccountId,
  prefillBankAccountId,
  prefillPartyId,
  prefillAmount,
  prefillMemo,
  prefillDate,
  prefillMethod,
}: {
  leaseId: string;
  bankAccounts: Array<{ id: string; name: string }>;
  accounts: LeaseAccountOption[];
  parties: LeaseTenantOption[];
  leaseSummary: { propertyUnit?: string | null; tenants?: string | null };
  returnTo: string;
  orgId?: string | null;
  prefillAccountId?: string | null;
  prefillBankAccountId?: string | null;
  prefillPartyId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
  prefillMethod?: 'check' | 'eft' | null;
}) {
  const router = useRouter();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const goHome = () => {
    router.push(returnTo);
    router.refresh();
  };

  useEffect(() => {
    void emitChargeTelemetry({
      event: 'refund_view',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      prefills: {
        accountId: prefillAccountId ?? null,
        bankAccountId: prefillBankAccountId ?? null,
        partyId: prefillPartyId ?? null,
        amount: prefillAmount ?? null,
        memo: prefillMemo ?? null,
        date: prefillDate ?? null,
        method: prefillMethod ?? null,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    const duration =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
    void emitChargeTelemetry({
      event: 'refund_cancel',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      durationMs: duration,
      prefills: {
        accountId: prefillAccountId ?? null,
        bankAccountId: prefillBankAccountId ?? null,
        partyId: prefillPartyId ?? null,
        amount: prefillAmount ?? null,
        memo: prefillMemo ?? null,
        date: prefillDate ?? null,
        method: prefillMethod ?? null,
      },
    });
    goHome();
  };

  return (
    <IssueRefundForm
      leaseId={leaseId}
      leaseSummary={leaseSummary}
      bankAccounts={bankAccounts}
      accounts={accounts}
      parties={parties}
      onCancel={handleCancel}
      onSuccess={goHome}
      onSubmitError={(message) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'refund_submit_error',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            accountId: prefillAccountId ?? null,
            bankAccountId: prefillBankAccountId ?? null,
            partyId: prefillPartyId ?? null,
            amount: prefillAmount ?? null,
            memo: prefillMemo ?? null,
            date: prefillDate ?? null,
            method: prefillMethod ?? null,
          },
          errorMessage: message ?? null,
        });
      }}
      onSubmitSuccess={(payload) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'refund_submit_success',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            accountId: prefillAccountId ?? null,
            bankAccountId: prefillBankAccountId ?? null,
            partyId: prefillPartyId ?? null,
            amount: prefillAmount ?? null,
            memo: prefillMemo ?? null,
            date: prefillDate ?? null,
            method: prefillMethod ?? null,
          },
          metadata: payload ? { transactionId: payload.transaction?.id } : undefined,
        });
        goHome();
      }}
      prefillAccountId={prefillAccountId ?? undefined}
      prefillBankAccountId={prefillBankAccountId ?? undefined}
      prefillPartyId={prefillPartyId ?? undefined}
      prefillAmount={prefillAmount ?? undefined}
      prefillMemo={prefillMemo ?? undefined}
      prefillDate={prefillDate ?? undefined}
      prefillMethod={prefillMethod ?? undefined}
    />
  );
}
