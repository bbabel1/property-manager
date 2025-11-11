import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, afterEach, beforeEach, expect, test } from 'vitest';
import FilesPage, { MAX_RETRY_ATTEMPTS } from '@/app/(protected)/files/page';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock('@/components/files/FilesTable', () => ({
  default: (props: any) => (
    <div data-testid="files-table">{props.isLoading ? 'loading' : 'loaded'}</div>
  ),
}));

vi.mock('@/components/files/FilesFilters', () => ({
  default: () => <div data-testid="files-filters" />,
}));

vi.mock('@/components/files/FileUploadDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/files/FileViewDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/files/FileEmailDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/files/FileEditDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/files/FileSharingDialog', () => ({
  default: () => null,
}));

vi.mock('@/lib/supabase/fetch', () => ({
  fetchWithSupabaseAuth: vi.fn(),
}));

const networkErrorMessage = 'Network down';

const createJsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;
const fetchWithSupabaseAuthMock = vi.mocked(fetchWithSupabaseAuth);
let fetchMock: ReturnType<typeof vi.fn>;
let listAttempt = 0;
let timeoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchWithSupabaseAuthMock.mockReset();
  listAttempt = 0;

  fetchWithSupabaseAuthMock.mockImplementation((input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.includes('/api/files/categories')) {
      return Promise.resolve(createJsonResponse({ success: true, data: [] }));
    }
    if (typeof input === 'string' && input.includes('/api/files/list')) {
      listAttempt += 1;
      if (listAttempt <= MAX_RETRY_ATTEMPTS) {
        return Promise.reject(new TypeError(networkErrorMessage));
      }
      return Promise.reject(new Error('Permanent failure'));
    }
    return Promise.reject(new Error('Unexpected request'));
  });

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.includes('/api/files/categories')) {
      return createJsonResponse({ success: true, data: [] });
    }
    if (typeof input === 'string' && input.includes('/api/files/list')) {
      if (listAttempt <= MAX_RETRY_ATTEMPTS) {
        throw new TypeError(networkErrorMessage);
      }
      throw new Error('Permanent failure');
    }
    throw new Error('Unexpected request');
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(
    ((callback: TimerHandler, delay?: number, ...args: any[]) => {
      if (typeof delay === 'number' && delay >= 2000 && typeof callback === 'function') {
        callback(...args);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(callback as any, delay, ...args);
    }) as typeof setTimeout,
  );
});

afterEach(() => {
  timeoutSpy.mockRestore();
  if (originalFetch) {
    global.fetch = originalFetch;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as any).fetch;
  }
});

test('stops retrying after capped attempts and keeps error visible', async () => {
  render(<FilesPage />);

  await waitFor(() => {
    const listCalls = fetchWithSupabaseAuthMock.mock.calls.filter(([input]) =>
      typeof input === 'string' && input.includes('/api/files/list'),
    );
    expect(listCalls.length).toBeGreaterThan(0);
  });

  const listCallCount = fetchMock.mock.calls.filter(
    ([input]) => typeof input === 'string' && input.includes('/api/files/list'),
  ).length;
  expect(listCallCount).toBe(MAX_RETRY_ATTEMPTS + 1);

  expect(await screen.findByText('Permanent failure', { selector: 'p' })).toBeInTheDocument();
  const retrySchedules = timeoutSpy.mock.calls.filter(
    ([, delay]) => typeof delay === 'number' && delay >= 2000,
  ).length;
  expect(retrySchedules).toBe(MAX_RETRY_ATTEMPTS);
}, 10000);
