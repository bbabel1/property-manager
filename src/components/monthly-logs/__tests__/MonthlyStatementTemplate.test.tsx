import '@testing-library/jest-dom/vitest';
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Vitest globals for test runtime (see https://typescript-eslint.io/rules/triple-slash-reference/)
/// <reference types="vitest" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

vi.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/image', () => {
  type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean };
  const MockImage = ({ alt = '', unoptimized: _omit, ...props }: MockImageProps) =>
    React.createElement('img', { alt, ...props });
  return { __esModule: true, default: MockImage };
});

import MonthlyStatementTemplate from '../MonthlyStatementTemplate';
import type { StatementData } from '../MonthlyStatementTemplate';

const baseData: StatementData = {
  monthlyLogId: 'log-1',
  periodStart: '2025-10-01',
  generatedAt: '2025-10-31T00:00:00.000Z',
  property: {
    name: 'Test Property',
    address: '123 Main',
    city: 'City',
    state: 'ST',
    zipCode: '12345',
  },
  unit: {
    unitNumber: '1A',
    unitName: null,
  },
  tenant: { name: 'Tenant' },
  propertyOwners: [],
  financialSummary: {
    totalCharges: 2000,
    totalCredits: 0,
    totalPayments: 2000,
    totalBills: 500,
    escrowAmount: 0,
    managementFees: 250,
    ownerDraw: 1250,
    netToOwner: 0,
    balance: 0,
    previousLeaseBalance: 0,
  },
  charges: [],
  payments: [],
  bills: [],
  escrowMovements: [],
  accountTotals: [],
  incomeItems: [{ label: 'Rent Income', amount: 2000, date: '' }],
  expenseItems: [
    { label: 'Management Fees', amount: -250, date: '' },
    { label: 'Bills Paid', amount: -500, date: '' },
  ],
  escrowItems: [{ label: 'Property Tax Escrow', amount: 0, date: '' }],
  company: {
    name: 'Company',
    address: 'Addr',
    phone: '123',
    email: 'test@example.com',
    logo: undefined,
  },
};

describe('MonthlyStatementTemplate', () => {
  it('renders totals that match the financial summary', () => {
    render(<MonthlyStatementTemplate data={baseData} />);

    const incomeRow = screen.getByText('Total Income').closest('tr');
    expect(incomeRow && within(incomeRow).getByText('$2,000.00')).toBeInTheDocument();

    const expensesRow = screen.getByText('Total Expenses').closest('tr');
    expect(expensesRow && within(expensesRow).getByText('-$750.00')).toBeInTheDocument();

    const ownerDrawRow = screen.getByText('Owner Draw').closest('tr');
    expect(ownerDrawRow && within(ownerDrawRow).getByText('-$1,250.00')).toBeInTheDocument();

    const endingBalanceRow = screen.getByText('Ending Balance').closest('tr');
    expect(endingBalanceRow && within(endingBalanceRow).getByText('$0.00')).toBeInTheDocument();
  });
});
