import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnitFinancialServicesCard from '../UnitFinancialServicesCard';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('UnitFinancialServicesCard', () => {
  it('shows deposits held as a positive number while available balance reflects the deduction', () => {
    render(
      <UnitFinancialServicesCard
        fin={{
          cash_balance: -5000,
          security_deposits: -2500,
          reserve: 0,
          available_balance: -7500,
          as_of: '2026-01-11',
        }}
        property={{
          id: 'prop-1',
          reserve: 0,
          operating_account: { id: 'op', name: 'Operating', last4: '6789' },
          deposit_trust_account: { id: 'tr', name: 'Trust', last4: '4321' },
        }}
      />,
    );

    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    expect(screen.queryByText('-$2,500.00')).not.toBeInTheDocument();
    expect(screen.getByText('-$7,500.00')).toBeInTheDocument();
  });
});
