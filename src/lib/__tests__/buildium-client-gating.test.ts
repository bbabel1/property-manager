import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getOrgScopedBuildiumClient } from '../buildium-client';
import { BuildiumDisabledError } from '../buildium-gate';

const assertBuildiumEnabled = vi.fn();
const getOrgScopedBuildiumConfig = vi.fn();

vi.mock('../buildium-gate', async () => {
  const actual = await vi.importActual<any>('../buildium-gate');
  return {
    ...actual,
    assertBuildiumEnabled: (...args: any[]) => assertBuildiumEnabled(...args),
  };
});

vi.mock('../buildium/credentials-manager', () => ({
  getOrgScopedBuildiumConfig: (...args: any[]) => getOrgScopedBuildiumConfig(...args),
}));

describe('Buildium client gating', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    getOrgScopedBuildiumConfig.mockResolvedValue({
      baseUrl: 'https://apisandbox.buildium.com/v1',
      clientId: 'id',
      clientSecret: 'secret',
      webhookSecret: 'wh',
      isEnabled: true,
    });
    assertBuildiumEnabled.mockResolvedValue(undefined);
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ Id: 123 }))) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('re-checks enabled state on every Buildium request', async () => {
    const client = await getOrgScopedBuildiumClient('org-abc');
    assertBuildiumEnabled.mockClear();
    const fetchMock = global.fetch as unknown as Mock;

    await client.getProperty(1);
    await client.getUnit(1, 2);

    expect(assertBuildiumEnabled).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops outbound calls once integration is disabled mid-run', async () => {
    const client = await getOrgScopedBuildiumClient('org-abc');
    assertBuildiumEnabled.mockClear();
    const fetchMock = global.fetch as unknown as Mock;

    assertBuildiumEnabled.mockResolvedValueOnce(undefined);
    assertBuildiumEnabled.mockRejectedValueOnce(new BuildiumDisabledError('org-abc'));

    await client.getProperty(1);
    await expect(client.getProperty(2)).rejects.toThrow(/disabled/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not attempt outbound calls when integration is disabled upfront', async () => {
    const client = await getOrgScopedBuildiumClient('org-abc');
    assertBuildiumEnabled.mockClear();
    const fetchMock = global.fetch as unknown as Mock;

    assertBuildiumEnabled.mockRejectedValueOnce(new BuildiumDisabledError('org-abc'));

    await expect(client.getProperty(42)).rejects.toThrow(/disabled/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
