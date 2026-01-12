import { describe, expect, it, beforeEach, vi } from 'vitest';
import { toggleBuildiumIntegration } from '../credentials-manager';
import { buildiumFetch } from '@/lib/buildium-http';

const mocks = vi.hoisted(() => {
  const updateMock = vi.fn();
  const selectMock = vi.fn();
  const eqMock = vi.fn().mockReturnThis();
  const isMock = vi.fn().mockReturnThis();
  const maybeSingleMock = vi.fn();
  const buildiumTableMock: any = {
    update: updateMock,
    select: selectMock,
    eq: eqMock,
    is: isMock,
    maybeSingle: maybeSingleMock,
    insert: vi.fn(),
  };
  const auditInsertMock = vi.fn();
  const auditLogMock = { insert: auditInsertMock };
  const fromMock = vi.fn((table: string) =>
    table === 'buildium_integrations' ? buildiumTableMock : auditLogMock,
  );
  return { updateMock, selectMock, eqMock, isMock, maybeSingleMock, buildiumTableMock, auditInsertMock, auditLogMock, fromMock };
});

vi.mock('@/lib/db', () => ({
  supabaseAdmin: { from: mocks.fromMock },
  supabase: null,
}));

vi.mock('@/lib/buildium-gate', async () => {
  const actual = await vi.importActual<any>('@/lib/buildium-gate');
  return {
    ...actual,
    assertBuildiumEnabled: vi.fn(async () => {
      throw new actual.BuildiumDisabledError('org-123');
    }),
  };
});

vi.mock('@/lib/buildium/credentials-manager', async () => {
  const actual = await vi.importActual<any>('@/lib/buildium/credentials-manager');
  return {
    ...actual,
    getOrgScopedBuildiumConfig: vi.fn(async () => ({
      baseUrl: 'https://apisandbox.buildium.com/v1',
      clientId: 'id',
      clientSecret: 'secret',
      webhookSecret: 'wh',
      isEnabled: false,
    })),
  };
});

describe('Buildium integration controls', () => {
  beforeEach(() => {
    mocks.updateMock.mockClear();
    mocks.auditInsertMock.mockClear();
    mocks.maybeSingleMock.mockReset();
    mocks.maybeSingleMock.mockResolvedValue({ data: { config_version: 2 }, error: null });
    mocks.buildiumTableMock.update = mocks.updateMock.mockReturnValue(mocks.buildiumTableMock);
    mocks.selectMock.mockReturnValue(mocks.buildiumTableMock);
    mocks.eqMock.mockReturnValue(mocks.buildiumTableMock);
    mocks.isMock.mockReturnValue(mocks.buildiumTableMock);
  });

  it('bumps config_version and disabled_at when toggling', async () => {
    await toggleBuildiumIntegration('org-1', false, 'user-1');

    expect(mocks.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config_version: 3,
        disabled_at: expect.any(String),
        is_enabled: false,
      }),
    );
    expect(mocks.auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        field_changes: expect.objectContaining({
          config_version: 3,
          disabled_at: expect.any(String),
        }),
      }),
    );
  });

  it('returns 403-style response when Buildium is disabled', async () => {
    const result = await buildiumFetch('GET', '/noop', undefined, undefined, 'org-123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.errorText).toMatch(/disabled/i);
  });
});
