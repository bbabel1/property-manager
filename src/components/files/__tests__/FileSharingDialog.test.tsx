import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

import FileSharingDialog from '../FileSharingDialog';

const mockFetch = vi.fn();

describe('FileSharingDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch as any);
    mockFetch.mockReset();
  });

  it('fetches and renders shared entities when opened', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: '1', type: 'Tenant', name: 'Jane' }] }) });

    render(
      <FileSharingDialog
        open
        onOpenChange={() => {}}
        fileId="file-1"
        sharedEntities={[]}
      />,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText('Jane')).toBeInTheDocument();
  });

  it('falls back to provided sharedEntities on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    render(
      <FileSharingDialog
        open
        onOpenChange={() => {}}
        fileId="file-1"
        sharedEntities={[{ id: '2', type: 'Owner', name: 'Bob' }]}
      />,
    );

    expect(await screen.findByText('Bob')).toBeInTheDocument();
  });
});
