'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EnterChargeForm from '@/components/leases/EnterChargeForm';
import type { LeaseAccountOption } from '@/components/leases/types';
import { emitChargeTelemetry } from '@/lib/charge-telemetry';

export default function EnterChargeFormShell({
  leaseId,
  accounts,
  returnTo,
  orgId,
  prefillAccountId,
  prefillAmount,
  prefillMemo,
  prefillDate,
  mode = 'create',
  transactionId,
  initialValues,
  hideTitle,
}: {
  leaseId: string;
  accounts: LeaseAccountOption[];
  returnTo: string;
  orgId?: string | null;
  prefillAccountId?: string | null;
  prefillAmount?: number | null;
  prefillMemo?: string | null;
  prefillDate?: string | null;
  mode?: 'create' | 'edit';
  transactionId?: number | null;
  initialValues?: Parameters<typeof EnterChargeForm>[0]['initialValues'];
  hideTitle?: boolean;
}) {
  const router = useRouter();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  useEffect(() => {
    void emitChargeTelemetry({
      event: 'charge_view',
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

  const goHome = () => {
    router.push(returnTo);
    router.refresh();
  };

  const handleCancel = () => {
    const duration =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
    void emitChargeTelemetry({
      event: 'charge_cancel',
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
    <EnterChargeForm
      leaseId={leaseId}
      accounts={accounts}
      onCancel={handleCancel}
      onSuccess={goHome}
      onSubmitError={(message) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'charge_submit_error',
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
          event: 'charge_submit_success',
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
      mode={mode}
      transactionId={transactionId ?? undefined}
      initialValues={initialValues}
      prefillAccountId={prefillAccountId ?? undefined}
      prefillAmount={prefillAmount ?? undefined}
      prefillMemo={prefillMemo ?? undefined}
      prefillDate={prefillDate ?? undefined}
      hideTitle={hideTitle}
    />
  );
}
