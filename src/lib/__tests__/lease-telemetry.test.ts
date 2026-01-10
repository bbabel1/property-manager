import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { emitLeaseTelemetry } from '../lease-telemetry';
import type { LeaseTelemetryPayload } from '../lease-telemetry';

vi.mock('../analytics', () => ({
  track: vi.fn(),
}));

describe('emitLeaseTelemetry', () => {
  const fetchSpy = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>(() =>
    Promise.resolve({ ok: true } as Response),
  );
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts payload to lease telemetry endpoint', async () => {
    const payload: LeaseTelemetryPayload = {
      event: 'lease_view',
      orgId: 'org1',
      leaseId: 123,
      source: 'route',
      returnTo: '/leases',
      prefills: { propertyId: 'p1' },
      durationMs: 42,
    };

    await emitLeaseTelemetry(payload);

    expect(fetchSpy).toHaveBeenCalledWith('/api/telemetry/leases', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const fetchCall = fetchSpy.mock.calls[0] as Parameters<typeof fetch> | undefined;
    const requestInit = fetchCall?.[1];
    const body = JSON.parse(typeof requestInit?.body === 'string' ? requestInit.body : '{}');
    expect(body).toEqual(payload);
  });
});
