import '@testing-library/jest-dom/vitest';
/// <reference types="vitest" />

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
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

    expect(screen.getAllByText('$2,000.00')[0]).toBeInTheDocument();
    expect(screen.getByText('-$750.00')).toBeInTheDocument();
    expect(screen.getByText('-$1,250.00')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
