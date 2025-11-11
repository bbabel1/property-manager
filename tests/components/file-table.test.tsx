import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { BulkActionsBar } from '@/components/files/BulkActionsBar';

vi.mock('sonner', () => {
  const toastMock = vi.fn();
  toastMock.success = vi.fn();
  toastMock.error = vi.fn();
  return { toast: toastMock };
});

vi.mock('@/lib/supabase/fetch', () => ({
  fetchWithSupabaseAuth: vi.fn(),
}));

import { toast } from 'sonner';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

const toastFn = toast as unknown as ((...args: any[]) => void) & {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

const fetchWithSupabaseAuthMock = fetchWithSupabaseAuth as unknown as vi.Mock;

function TestHarness({
  initialIds,
  onRefresh,
}: {
  initialIds: string[];
  onRefresh?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  return (
    <div>
      <BulkActionsBar
        selectedFiles={selected}
        onSelectionChange={setSelected}
        onRefresh={onRefresh}
      />
      <div data-testid="selection">{Array.from(selected).join(',')}</div>
    </div>
  );
}

describe('BulkActionsBar', () => {
  beforeEach(() => {
    toastFn.mockClear();
    toastFn.success.mockClear();
    toastFn.error.mockClear();
    fetchWithSupabaseAuthMock.mockReset();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    (window.confirm as vi.Mock).mockRestore();
  });

  test('keeps failed deletions selected and shows error toast', async () => {
    const user = userEvent.setup();
    const successResponse = { ok: true, json: async () => ({}) };
    const failureResponse = {
      ok: false,
      json: async () => ({ error: 'Failed to delete' }),
    };

    fetchWithSupabaseAuthMock
      .mockResolvedValueOnce(successResponse as any)
      .mockResolvedValueOnce(failureResponse as any);

    render(<TestHarness initialIds={['a', 'b']} />);

    const deleteButton = screen.getByRole('button', { name: /delete selected/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(fetchWithSupabaseAuthMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId('selection').textContent).toBe('b');
    expect(toastFn.success).toHaveBeenCalledWith('Deleted 1 file.');
    expect(toastFn.error).toHaveBeenCalledWith('1 file could not be deleted. Please retry.');
  });
});
