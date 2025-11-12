import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
}));

import PropertyTaxEscrowForm from '@/components/monthly-logs/PropertyTaxEscrowForm';

const mockedUseSWR = useSWR as unknown as Mock;

const defaultProps = {
  propertyId: 'property-1',
  propertyName: 'Demo Property',
  unitId: 'unit-1',
  unitLabel: 'Unit 1',
  orgId: 'org-1',
  onCancel: vi.fn(),
  onSuccess: vi.fn(),
};

describe('PropertyTaxEscrowForm', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
  });

  it('shows a property warning when propertyId is missing', () => {
    render(
      <PropertyTaxEscrowForm
        {...defaultProps}
        propertyId={null}
      />,
    );

    expect(screen.getByText(/Property required/i)).toBeInTheDocument();
  });

  it('surfaces organization error when orgId is missing', () => {
    render(
      <PropertyTaxEscrowForm
        {...defaultProps}
        orgId={null}
      />,
    );

    expect(screen.getByText(/Organization missing/i)).toBeInTheDocument();
  });

  it('renders owner draw missing callout when account is not configured', () => {
    mockedUseSWR.mockReturnValue({
      data: [
        { id: '2', name: 'Other Account', type: 'Expense' },
      ],
      error: undefined,
      isLoading: false,
    });

    render(<PropertyTaxEscrowForm {...defaultProps} />);

    expect(screen.getByText(/Owner Draw account not found/i)).toBeInTheDocument();
  });

  it('renders the journal entry form when owner draw is available', () => {
    mockedUseSWR.mockReturnValue({
      data: [
        { id: '1', name: 'Owner Draw', type: 'Equity' },
        { id: '2', name: 'Other Account', type: 'Expense' },
      ],
      error: undefined,
      isLoading: false,
    });

    render(<PropertyTaxEscrowForm {...defaultProps} />);

    expect(screen.getByRole('combobox', { name: /Select property or company/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });
});

