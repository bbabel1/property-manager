import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { EntityPicker } from '@/components/files/upload/EntityPicker';

const mockResponse = (
  items: Array<{ id: string; label: string; description?: string }>,
  hasMore = false,
) => ({
  ok: true,
  json: () =>
    Promise.resolve({
      data: items,
      pagination: {
        page: 1,
        limit: items.length,
        hasMore,
      },
    }),
});

const ADVANCE_DELAY = 350;

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    mockResponse([
      { id: '1', label: 'Item 1' },
      { id: '2', label: 'Item 2' },
    ]) as Response,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('debounces search input requests', async () => {
  const user = userEvent.setup();

  render(
    <EntityPicker
      entityType="property"
      value=""
      onChange={() => {}}
      label="Property"
      placeholder="Search properties"
      debounceMs={10}
    />,
  );

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const searchInput = screen.getByPlaceholderText(/search properties/i);

  await user.type(searchInput, 'Main Street');
  expect(global.fetch).toHaveBeenCalledTimes(1);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });

  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('loads additional pages when Load more is clicked', async () => {
  (global.fetch as vi.Mock).mockResolvedValueOnce(
    mockResponse(
      [
        { id: '1', label: 'Alpha' },
        { id: '2', label: 'Beta' },
      ],
      true,
    ) as Response,
  );
  (global.fetch as vi.Mock).mockResolvedValueOnce(
    mockResponse([{ id: '3', label: 'Gamma' }], false) as Response,
  );

  const user = userEvent.setup();

  render(
    <EntityPicker
      entityType="property"
      value=""
      onChange={() => {}}
      label="Property"
      placeholder="Search properties"
      debounceMs={10}
    />,
  );

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const loadMoreButton = await screen.findByRole('button', { name: /load more/i });
  await user.click(loadMoreButton);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(global.fetch).toHaveBeenCalledTimes(2);

  expect(await screen.findByText('Gamma')).toBeInTheDocument();
});

test('invokes onChange when an option is selected', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();

  render(
    <EntityPicker
      entityType="tenant"
      value=""
      onChange={handleChange}
      label="Tenant"
      placeholder="Search tenants"
      debounceMs={10}
    />,
  );

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const optionButton = await screen.findByText('Item 1');
  await user.click(optionButton);

  expect(handleChange).toHaveBeenCalledWith('1');
});
