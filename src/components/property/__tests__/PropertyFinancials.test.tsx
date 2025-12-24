import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

import { PropertyFinancials } from '../PropertyFinancials';

describe('PropertyFinancials', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);
    mockFetch.mockReset();
  });

  it('fetches and displays financials from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cash_balance: 1200,
          security_deposits: 200,
          reserve: 100,
          available_balance: 900,
        }),
    });

    render(<PropertyFinancials propertyId="prop-1" />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText('$1,200.00')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getAllByText('$900.00')[0]).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));

    render(<PropertyFinancials propertyId="prop-1" />);

    expect(await screen.findByText(/Error loading financials/)).toBeInTheDocument();
  });
});
