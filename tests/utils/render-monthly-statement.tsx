import React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MonthlyStatementTemplate, {
  type StatementData,
} from '@/components/monthly-logs/MonthlyStatementTemplate';

process.env.PLAYWRIGHT_TEST = '1';

export const sampleStatementData: StatementData = {
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
    address: '123 Main, City, ST 12345',
    phone: '555-123-4567',
    email: 'info@example.com',
  },
};

export function renderStatementHtml(data: StatementData = sampleStatementData): string {
  const element = createElement(MonthlyStatementTemplate, { data });
  const markup = renderToStaticMarkup(element);
  return `<!DOCTYPE html>${markup}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(renderStatementHtml());
}
