import React from 'react';
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceOfferingConfig from '../ServiceOfferingConfig';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

expect.extend(matchers);

const jsonResponse = (data: any, ok = true) => ({
  ok,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

describe('ServiceOfferingConfig failure states', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an inline error when initial fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'));
    // @ts-expect-error - vi mock
    global.fetch = fetchMock;

    render(<ServiceOfferingConfig propertyId="prop-1" servicePlan={null} />);

    await waitFor(() => expect(screen.getByText(/network failure/i)).toBeInTheDocument());
  });

  it('rolls back selection and shows error when toggle fails', async () => {
    const fetchMock = vi
      .fn()
      // catalog
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'o-1',
              name: 'Offering One',
              category: 'Financial Management',
              billing_basis: 'per_property',
              default_freq: 'monthly',
              bill_on: 'calendar_day',
            },
          ],
        }),
      )
      // management-service/config
      .mockResolvedValueOnce(jsonResponse({ data: { service_offerings: [] } }))
      // service-pricing
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      // toggle POST failure
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
        text: async () => 'failed to save pricing',
      });

    // @ts-expect-error - vi mock
    global.fetch = fetchMock;

    render(<ServiceOfferingConfig propertyId="prop-1" servicePlan={null} />);

    await screen.findByText('Offering One');

    await userEvent.click(screen.getAllByText(/Edit Services/i)[0]);
    await userEvent.click(screen.getByLabelText(/Select Offering One/i));

    await waitFor(() =>
      expect(
        screen.getByText(/failed to save pricing/i),
      ).toBeInTheDocument(),
    );

    // Checkbox should roll back to unchecked
    const checkbox = screen.getByRole('checkbox', { name: /Select Offering One/i });
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });
});
