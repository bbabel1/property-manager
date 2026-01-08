'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import IssueCreditForm from '@/components/leases/IssueCreditForm';
import type { LeaseAccountOption } from '@/components/leases/types';
import { emitChargeTelemetry } from '@/lib/charge-telemetry';

export default function IssueCreditFormShell({
  leaseId,
  accounts,
  leaseSummary,
  returnTo,
  orgId,
  prefillAccountId,
  prefillAmount,
  prefillMemo,
  prefillDate,
}: {
  leaseId: string;
  accounts: LeaseAccountOption[];
  leaseSummary: { propertyUnit?: string | null; tenants?: string | null };
  returnTo: string;
  orgId?: string | null;
  prefillAccountId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
}) {
  const router = useRouter();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const goHome = () => {
    router.push(returnTo);
    router.refresh();
  };

  useEffect(() => {
    void emitChargeTelemetry({
      event: 'credit_view',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      prefills: {
        accountId: prefillAccountId ?? null,
        amount: prefillAmount ?? null,
        memo: prefillMemo ?? null,
        date: prefillDate ?? null,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    const duration =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
    void emitChargeTelemetry({
      event: 'credit_cancel',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      durationMs: duration,
      prefills: {
        accountId: prefillAccountId ?? null,
        amount: prefillAmount ?? null,
        memo: prefillMemo ?? null,
        date: prefillDate ?? null,
      },
    });
    goHome();
  };

  return (
    <IssueCreditForm
      leaseId={leaseId}
      leaseSummary={leaseSummary}
      accounts={accounts}
      onCancel={handleCancel}
      onSuccess={goHome}
      onSubmitError={(message) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'credit_submit_error',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            accountId: prefillAccountId ?? null,
            amount: prefillAmount ?? null,
            memo: prefillMemo ?? null,
            date: prefillDate ?? null,
          },
          errorMessage: message ?? null,
        });
      }}
      onSubmitSuccess={(payload) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'credit_submit_success',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            accountId: prefillAccountId ?? null,
            amount: prefillAmount ?? null,
            memo: prefillMemo ?? null,
            date: prefillDate ?? null,
          },
          metadata: payload ? { transactionId: payload.transaction?.id } : undefined,
        });
        goHome();
      }}
      prefillAccountId={prefillAccountId ?? undefined}
      prefillAmount={prefillAmount ?? undefined}
      prefillMemo={prefillMemo ?? undefined}
      prefillDate={prefillDate ?? undefined}
    />
  );
}
