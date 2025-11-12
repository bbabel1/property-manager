import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
}));

import MonthlyLogTransactionOverlay, {
  type TransactionMode,
} from '@/components/monthly-logs/MonthlyLogTransactionOverlay';

const mockedUseSWR = useSWR as unknown as Mock;

const baseProps = {
  isOpen: true,
  onModeChange: vi.fn(),
  onClose: vi.fn(),
  allowedModes: [
    'payment',
    'charge',
    'credit',
    'refund',
    'deposit',
    'bill',
    'propertyTaxEscrow',
  ] as TransactionMode[],
  leaseId: 1,
  leaseSummary: {
    propertyUnit: 'Unit 1',
    tenants: 'Test Tenant',
  },
  tenantOptions: [{ id: 'tenant-1', name: 'Tenant One' }],
  hasActiveLease: true,
  monthlyLogId: 'log-1',
  propertyId: 'property-1',
  propertyName: 'Property',
  unitId: 'unit-1',
  unitLabel: 'Unit 1',
  orgId: 'org-1',
  addAssignedTransaction: vi.fn(),
  removeAssignedTransaction: vi.fn(),
  refetchAssigned: vi.fn().mockResolvedValue(undefined),
  refetchFinancial: vi.fn().mockResolvedValue(undefined),
};

const renderOverlay = (mode: TransactionMode) => {
  return render(<MonthlyLogTransactionOverlay {...baseProps} mode={mode} />);
};

describe('MonthlyLogTransactionOverlay account filtering', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
    mockedUseSWR.mockImplementation((key: unknown) => {
      if (typeof key === 'string' && key.includes('financial-options')) {
        return {
          data: {
            accountOptions: [],
            bankAccountOptions: [],
            unmappedAccountCount: 0,
          },
          isLoading: false,
        };
      }
      if (typeof key === 'string' && key.includes('bill-options')) {
        return {
          data: {
            vendors: [],
            categories: [],
            accountOptions: [],
            unmappedAccountCount: 0,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });
  });

  it('surfaces guidance when no mapped accounts are available', () => {
    mockedUseSWR.mockImplementation((key: unknown) => {
      if (typeof key === 'string' && key.includes('financial-options')) {
        return {
          data: {
            accountOptions: [],
            bankAccountOptions: [{ id: 'bank-1', name: 'Operating' }],
            unmappedAccountCount: 2,
          },
          isLoading: false,
        };
      }
      if (typeof key === 'string' && key.includes('bill-options')) {
        return {
          data: {
            vendors: [],
            categories: [],
            accountOptions: [],
            unmappedAccountCount: 0,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderOverlay('payment');

    expect(
      screen.getByText(/No mapped general ledger accounts are available for this lease/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 accounts were hidden because a Buildium account mapping is missing/i),
    ).toBeInTheDocument();
  });

  it('renders the payment form when mapped accounts exist', () => {
    mockedUseSWR.mockImplementation((key: unknown) => {
      if (typeof key === 'string' && key.includes('financial-options')) {
        return {
          data: {
            accountOptions: [
              { id: '1', name: 'Rent', type: 'income', buildiumGlAccountId: 4000 },
            ],
            bankAccountOptions: [{ id: 'bank-1', name: 'Operating' }],
          },
          isLoading: false,
        };
      }
      if (typeof key === 'string' && key.includes('bill-options')) {
        return {
          data: {
            vendors: [],
            categories: [],
            accountOptions: [],
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderOverlay('payment');

    expect(screen.getByText(/Apply payment to balances/i)).toBeInTheDocument();
  });
});
