'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AddLeaseForm from '@/components/leases/AddLeaseModal';
import type { AddLeaseFormData } from '@/server/leases/load-add-lease-form-data';
import { emitLeaseTelemetry } from '@/lib/lease-telemetry';

type AddLeaseFormShellProps = {
  returnTo: string;
  orgId?: string | null;
  data?: AddLeaseFormData['prefill'];
  propertyOptions?: AddLeaseFormData['propertyOptions'];
  unitOptions?: AddLeaseFormData['unitOptions'];
  tenantOptions?: AddLeaseFormData['tenantOptions'];
};

export default function AddLeaseFormShell({
  returnTo,
  orgId,
  data,
  propertyOptions,
  unitOptions,
  tenantOptions,
}: AddLeaseFormShellProps) {
  const router = useRouter();
  const startedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());

  const prefills = useMemo(
    () =>
      data
        ? {
            propertyId: data.propertyId ?? null,
            unitId: data.unitId ?? null,
            from: data.from ?? null,
            to: data.to ?? null,
            rent: data.rent ?? null,
            rentCycle: data.rentCycle ?? null,
            nextDueDate: data.nextDueDate ?? null,
            depositAmt: data.depositAmt ?? null,
            depositDate: data.depositDate ?? null,
            depositMemo: data.depositMemo ?? null,
            leaseCharges: data.leaseCharges ?? null,
          }
        : null,
    [data],
  );

  useEffect(() => {
    void emitLeaseTelemetry({
      event: 'lease_view',
      orgId,
      source: 'route',
      returnTo,
      prefills,
    });
  }, [orgId, returnTo, prefills]);

  const goHome = () => {
    router.push(returnTo);
    router.refresh();
  };

  const duration = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAtRef.current;

  return (
    <AddLeaseForm
      onCancel={() => {
        void emitLeaseTelemetry({
          event: 'lease_cancel',
          orgId,
          source: 'route',
          returnTo,
          prefills,
          durationMs: duration(),
        });
        goHome();
      }}
      onSuccess={goHome}
      onSubmitSuccess={(leaseId) => {
        void emitLeaseTelemetry({
          event: 'lease_submit_success',
          orgId,
          leaseId: leaseId ?? null,
          source: 'route',
          returnTo,
          prefills,
          durationMs: duration(),
        });
      }}
      onSubmitError={(message) => {
        void emitLeaseTelemetry({
          event: 'lease_submit_error',
          orgId,
          source: 'route',
          returnTo,
          prefills,
          durationMs: duration(),
          errorMessage: message ?? null,
        });
      }}
      prefillPropertyId={data?.propertyId ?? undefined}
      prefillUnitId={data?.unitId ?? undefined}
      prefill={data}
      propertyOptions={propertyOptions}
      unitOptions={unitOptions}
      _tenantOptions={tenantOptions}
    />
  );
}
