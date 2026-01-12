import { createHmac } from 'crypto';
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const insertMock = vi.fn();
const updateMock = vi.fn();
const integrationBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(async () => ({ data: { is_enabled: false }, error: null })),
};
const orgBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(async () => ({ data: { id: 'org-123' }, error: null })),
};
const webhookBuilder = {
  update: (values: any) => {
    updateMock(values);
    return webhookBuilder;
  },
  eq: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/db', () => ({
  supabase: null,
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'buildium_integrations') return integrationBuilder;
      if (table === 'organizations') return orgBuilder;
      if (table === 'buildium_webhook_events') return webhookBuilder;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      };
    },
  },
}));

vi.mock('../../supabase/functions/_shared/webhookEvents', () => ({
  insertBuildiumWebhookEventRecord: (...args: any[]) => {
    insertMock(...args);
    return Promise.resolve({
      status: 'inserted',
      normalized: {
        buildiumWebhookId: 'wh-evt-1',
        eventName: 'Lease.Created',
        eventCreatedAt: '2024-01-01T00:00:00.000Z',
      },
    });
  },
  deadLetterBuildiumEvent: vi.fn(),
}));

vi.mock('../../supabase/functions/_shared/eventValidation', () => ({
  validateBuildiumEvent: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/buildium/credentials-manager', () => ({
  getOrgScopedBuildiumConfig: vi.fn(async () => ({
    baseUrl: 'https://apisandbox.buildium.com/v1',
    clientId: 'id',
    clientSecret: 'secret',
    webhookSecret: 'secret',
    isEnabled: false,
  })),
}));

vi.mock('@/lib/pagerduty', () => ({
  sendPagerDutyEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Buildium webhook route - disabled integration', () => {
  beforeEach(() => {
    insertMock.mockClear();
    updateMock.mockClear();
    integrationBuilder.maybeSingle.mockClear();
    integrationBuilder.maybeSingle.mockResolvedValue({ data: { is_enabled: false }, error: null });
  });

  it('stores events as ignored_disabled and returns 200', async () => {
    const { POST } = await import('@/app/api/webhooks/buildium/route');
    const payload = { Events: [{ EventName: 'Lease.Created', AccountId: 42, Id: 'evt-1' }] };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', 'secret').update(rawBody).digest('base64');

    const res = await POST(
      new Request('http://localhost/api/webhooks/buildium', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-buildium-signature': signature,
        },
        body: rawBody,
      }) as any,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ignored: true, reason: 'integration_disabled' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ignored_disabled',
        processed: true,
      }),
    );
  });
});
