import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

const hoisted = vi.hoisted(() => {
  const updateMock = vi.fn().mockReturnThis();
  const maybeSingleOrg = vi.fn(async () => ({ data: { id: 'org-1' }, error: null }));
  const maybeSingleIntegration = vi.fn(async () => ({ data: { is_enabled: false }, error: null }));
  const stubForTable = (table: string) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    maybeSingle: table === 'organizations' ? maybeSingleOrg : maybeSingleIntegration,
    update: updateMock,
    insert: vi.fn().mockReturnThis(),
  });
  const supabaseStub = {
    from: vi.fn((table: string) => stubForTable(table)),
  };
  return { updateMock, supabaseStub };
});

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  supabase: hoisted.supabaseStub,
  supabaseAdmin: hoisted.supabaseStub,
}));

vi.mock('../../../../../supabase/functions/_shared/webhookEvents', () => ({
  insertBuildiumWebhookEventRecord: vi.fn(async () => ({
    status: 'inserted',
    normalized: {
      buildiumWebhookId: 'evt-1',
      eventName: 'LeaseTransactionCreated',
      eventCreatedAt: '2024-01-01T00:00:00Z',
    },
  })),
  deadLetterBuildiumEvent: vi.fn(),
}));

vi.mock('../../../../../supabase/functions/_shared/eventValidation', () => ({
  validateBuildiumEvent: vi.fn(() => ({ ok: true, normalized: {} })),
}));

vi.mock('@/lib/buildium-webhook-status', () => ({
  markWebhookError: vi.fn(),
  markWebhookTombstone: vi.fn(),
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

import { POST } from '../route';

describe('Buildium webhook route (disabled state)', () => {
  it('returns 200 and marks events as ignored_disabled when integration is disabled', async () => {
    const payload = {
      Events: [
        {
          Id: 'evt-1',
          EventName: 'LeaseTransactionCreated',
          EventDateTime: '2024-01-01T00:00:00Z',
          AccountId: 999,
          Data: { OrgId: 'org-1' },
        },
      ],
    };
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha256', 'secret').update(raw).digest('hex');
    const request = new NextRequest('http://localhost/api/webhooks/buildium', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-buildium-signature': signature },
      body: raw,
    });

    const res = await POST(request);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: boolean; reason?: string };
    expect(body.ignored).toBe(true);
    expect(body.reason).toBe('integration_disabled');
    expect(hoisted.updateMock).toHaveBeenCalled();
  });
});
