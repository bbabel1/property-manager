import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { register as registerInstrumentation } from '../../../instrumentation';

const originalFetch = global.fetch;

describe('Buildium egress guard (node runtime)', () => {
  beforeEach(() => {
    // Reset guard flag and stub fetch
    (globalThis as any).__buildiumEgressGuardRegistered = false;
    Object.defineProperty(global, 'fetch', {
      value: vi.fn(async () => new Response('ok')),
      writable: true,
    });
  });

  afterAll(() => {
    // Restore original fetch
    Object.defineProperty(global, 'fetch', {
      value: originalFetch,
      writable: true,
    });
  });

  it('blocks direct Buildium fetch without the egress header', async () => {
    await registerInstrumentation();

    await expect(
      fetch('https://api.buildium.com/v1/test'),
    ).rejects.toThrow(/Direct Buildium fetch blocked/i);
  });

  it('allows Buildium fetch when the egress header is set', async () => {
    const stub = vi.fn(async () => new Response('ok'));
    Object.defineProperty(global, 'fetch', { value: stub, writable: true });
    await registerInstrumentation();

    const res = await fetch('https://apisandbox.buildium.com/v1/test', {
      headers: { 'x-buildium-egress-allowed': '1' },
    });

    expect(res.ok).toBe(true);
    expect(stub).toHaveBeenCalledTimes(1);
  });
});
