import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { emitLeaseTelemetry } from '../lease-telemetry';

vi.mock('../analytics', () => ({
  track: vi.fn(),
}));

describe('emitLeaseTelemetry', () => {
  const fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve({ ok: true } as Response));
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts payload to lease telemetry endpoint', async () => {
    await emitLeaseTelemetry({
      event: 'lease_view',
      orgId: 'org1',
      leaseId: 123,
      source: 'route',
      returnTo: '/leases',
      prefills: { propertyId: 'p1' },
      durationMs: 42,
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/telemetry/leases', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as { body?: string })?.body || '{}');
    expect(body.event).toBe('lease_view');
    expect(body.orgId).toBe('org1');
    expect(body.leaseId).toBe(123);
    expect(body.prefills).toEqual({ propertyId: 'p1' });
    expect(body.durationMs).toBe(42);
  });
});
