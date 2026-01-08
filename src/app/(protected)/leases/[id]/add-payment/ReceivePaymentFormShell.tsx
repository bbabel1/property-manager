'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReceivePaymentForm from '@/components/leases/ReceivePaymentForm';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';
import { emitChargeTelemetry } from '@/lib/charge-telemetry';

export default function ReceivePaymentFormShell({
  leaseId,
  accounts,
  tenants,
  leaseSummary,
  returnTo,
  orgId,
  prefillTenantId,
  prefillAccountId,
  prefillAmount,
  prefillMemo,
  prefillDate,
}: {
  leaseId: string;
  accounts: LeaseAccountOption[];
  tenants: LeaseTenantOption[];
  leaseSummary: { propertyUnit?: string | null; tenants?: string | null };
  returnTo: string;
  orgId?: string | null;
  prefillTenantId?: string | null;
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
      event: 'payment_view',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      prefills: {
        tenantId: prefillTenantId ?? null,
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
      event: 'payment_cancel',
      leaseId,
      orgId,
      source: 'route',
      returnTo,
      durationMs: duration,
      prefills: {
        tenantId: prefillTenantId ?? null,
        accountId: prefillAccountId ?? null,
        amount: prefillAmount ?? null,
        memo: prefillMemo ?? null,
        date: prefillDate ?? null,
      },
    });
    goHome();
  };

  return (
    <ReceivePaymentForm
      leaseId={leaseId}
      leaseSummary={leaseSummary}
      accounts={accounts}
      tenants={tenants}
      onCancel={handleCancel}
      onSuccess={goHome}
      onSubmitError={(message) => {
        const duration =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        void emitChargeTelemetry({
          event: 'payment_submit_error',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            tenantId: prefillTenantId ?? null,
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
          event: 'payment_submit_success',
          leaseId,
          orgId,
          source: 'route',
          returnTo,
          durationMs: duration,
          prefills: {
            tenantId: prefillTenantId ?? null,
            accountId: prefillAccountId ?? null,
            amount: prefillAmount ?? null,
            memo: prefillMemo ?? null,
            date: prefillDate ?? null,
          },
          metadata: payload ? { transactionId: payload.transaction?.id } : undefined,
        });
        goHome();
      }}
      prefillTenantId={prefillTenantId ?? undefined}
      prefillAccountId={prefillAccountId ?? undefined}
      prefillAmount={prefillAmount ?? undefined}
      prefillMemo={prefillMemo ?? undefined}
      prefillDate={prefillDate ?? undefined}
    />
  );
}
