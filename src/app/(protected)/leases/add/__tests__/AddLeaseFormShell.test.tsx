/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import AddLeaseFormShell from '../AddLeaseFormShell';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const telemetryMock = vi.fn();
vi.mock('@/lib/lease-telemetry', () => ({
  emitLeaseTelemetry: (...args: unknown[]) => telemetryMock(...args),
}));

vi.mock('@/components/leases/AddLeaseModal', () => ({
  default: ({
    onCancel,
    onSubmitSuccess,
    onSubmitError,
    onSuccess,
  }: {
    onCancel: () => void;
    onSubmitSuccess: (leaseId?: number | null) => void;
    onSubmitError: (message?: string | null) => void;
    onSuccess: () => void;
  }) => (
    <div>
      <button onClick={() => onCancel()}>cancel</button>
      <button onClick={() => onSubmitSuccess(123)}>submit-success</button>
      <button onClick={() => onSubmitError('fail')}>submit-error</button>
      <button onClick={() => onSuccess()}>complete</button>
    </div>
  ),
}));

describe('AddLeaseFormShell telemetry/navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('emits lease_view on mount with prefills', async () => {
    render(
      <AddLeaseFormShell
        returnTo="/leases"
        orgId="org1"
        data={{ propertyId: 'p1', unitId: 'u1', rent: 1000 }}
      />,
    );

    await waitFor(() =>
      expect(telemetryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'lease_view',
          orgId: 'org1',
          returnTo: '/leases',
          prefills: expect.objectContaining({ propertyId: 'p1', rent: 1000 }),
        }),
      ),
    );
  });

  it('emits cancel and navigates back on cancel', () => {
    render(<AddLeaseFormShell returnTo="/leases?tab=1" />);

    fireEvent.click(screen.getAllByText('cancel')[0]);

    expect(telemetryMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'lease_cancel' }),
    );
    expect(pushMock).toHaveBeenCalledWith('/leases?tab=1');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('emits success with lease id and navigates on completion', () => {
    render(<AddLeaseFormShell returnTo="/leases" orgId="org1" />);

    fireEvent.click(screen.getAllByText('submit-success')[0]);
    expect(telemetryMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'lease_submit_success', leaseId: 123 }),
    );
    // final completion triggers navigation
    fireEvent.click(screen.getAllByText('complete')[0]);
    expect(pushMock).toHaveBeenCalledWith('/leases');
  });

  it('emits error on submit error', () => {
    render(<AddLeaseFormShell returnTo="/leases" />);

    fireEvent.click(screen.getAllByText('submit-error')[0]);

    expect(telemetryMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'lease_submit_error', errorMessage: 'fail' }),
    );
  });
});
