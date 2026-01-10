import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/db';
import {
  insertBuildiumWebhookEventRecord,
  deadLetterBuildiumEvent,
  type NormalizedBuildiumWebhook,
} from '../../../../../supabase/functions/_shared/webhookEvents';
import { markWebhookError, markWebhookTombstone } from '@/lib/buildium-webhook-status';
import { looksLikeDelete } from '@/lib/buildium-delete-map';
import { validateBuildiumEvent } from '../../../../../supabase/functions/_shared/eventValidation';
import { sendPagerDutyEvent } from '@/lib/pagerduty';
import {
  getOrgScopedBuildiumConfig,
  type BuildiumConfig,
} from '@/lib/buildium/credentials-manager';
import {
  parseBuildiumGLAccountPayload,
  parseBuildiumPropertyPayload,
  parseBuildiumUnitPayload,
  parseBuildiumVendorPayload,
  parseBuildiumWorkOrderPayload,
} from '@/lib/buildium-webhook-validators';
import {
  upsertBillWithLines,
  resolveBankGlAccountId,
  mapGLAccountFromBuildiumWithSubAccounts,
  mapPropertyFromBuildiumWithBankAccount,
  mapTaskFromBuildiumWithRelations,
} from '@/lib/buildium-mappers';
import { mapUnitFromBuildium } from '@/lib/buildium-mappers';
import {
  mapVendorFromBuildiumWithCategory,
  findOrCreateVendorContact,
  mapWorkOrderFromBuildiumWithRelations,
  upsertOwnerFromBuildium,
  resolvePropertyIdByBuildiumPropertyId,
} from '@/lib/buildium-mappers';
import type { BuildiumLease, BuildiumLeasePerson, BuildiumOwner } from '@/types/buildium';
import type { Database, TablesInsert, TablesUpdate } from '@/types/database';
import PaymentIntentService from '@/lib/payments/payment-intent-service';
import PaymentService from '@/lib/payments/payment-service';

type UnknownRecord = Record<string, any>;
type IncomingBuildiumEvent = Record<string, any>;
type BuildiumWebhookUpdate = Database['public']['Tables']['buildium_webhook_events']['Update'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];

// Shared admin client for module-scope helpers (webhook toggles, etc.)
const admin = supabaseAdmin || supabase;
let buildiumCreds: BuildiumConfig | null = null;
const getBuildiumBaseUrl = (creds?: BuildiumConfig | null) =>
  (creds?.baseUrl || 'https://apisandbox.buildium.com/v1').replace(/\/+$/, '');
const orgCache = new Map<string, string | null>();

const toIncomingRecord = (value: unknown): IncomingBuildiumEvent => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as IncomingBuildiumEvent;
  }
  return {};
};

const normalizeIncomingEvent = (value: unknown): IncomingBuildiumEvent => {
  const base = toIncomingRecord(value);
  const data = toIncomingRecord(base?.Data);
  return { ...base, Data: data };
};

const extractIncomingEvents = (payload: unknown): IncomingBuildiumEvent[] => {
  const body = toIncomingRecord(payload);
  if (Array.isArray(body?.Events)) return body.Events.map(normalizeIncomingEvent);
  if (body?.Event) return [normalizeIncomingEvent(body.Event)];
  if (body?.EventName || body?.Id || body?.eventId) return [normalizeIncomingEvent(body)];
  return [];
};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const firstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const safeString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length ? value : null;

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const syncPaymentLifecycleFromTransaction = async (
  localTransactionId: string | null,
  buildiumTransactionId: number | null,
) => {
  if (!localTransactionId) return;
  const { data: tx, error: txError } = await admin
    .from('transactions')
    .select(
      'id, org_id, transaction_type, buildium_transaction_id, is_internal_transaction, internal_transaction_is_pending, internal_transaction_result_code, internal_transaction_result_date, created_at, total_amount, payment_method, payee_tenant_id',
    )
    .eq('id', localTransactionId)
    .maybeSingle();

  if (txError || !tx) {
    if (txError && txError.code !== 'PGRST116') {
      console.error('[buildium-webhook] Failed to load transaction for payment sync', txError);
    }
    return;
  }

  if ((tx.transaction_type || '').toLowerCase() !== 'payment') {
    return;
  }

  const orgId = tx.org_id;
  if (!orgId) return;

  const intentKey = `buildium:tx:${orgId}:${buildiumTransactionId ?? tx.buildium_transaction_id ?? tx.id}`;

  try {
    const { intent } = await PaymentIntentService.createIntent(
      {
        orgId,
        amount: Number(tx.total_amount ?? 0),
        paymentMethod: tx.payment_method as TransactionRow['payment_method'],
        payerId: tx.payee_tenant_id ? String(tx.payee_tenant_id) : null,
        payerType: tx.payee_tenant_id ? 'tenant' : null,
        gatewayProvider: 'buildium',
      },
      intentKey,
    );

    await PaymentIntentService.transitionStateFromBuildiumFields({
      orgId,
      intentId: intent.id,
      transaction: tx as TransactionRow,
    });

    await PaymentService.createFromTransaction({
      orgId,
      intentId: intent.id,
      transactionId: tx.id,
      gatewayTransactionId: tx.buildium_transaction_id ?? buildiumTransactionId,
      paymentMethod: tx.payment_method as TransactionRow['payment_method'],
      amount: tx.total_amount ?? null,
      payerId: tx.payee_tenant_id ? String(tx.payee_tenant_id) : null,
      payerType: tx.payee_tenant_id ? 'tenant' : null,
    });
  } catch (err) {
    console.error('[buildium-webhook] Failed to sync payment lifecycle from transaction', {
      err,
      localTransactionId,
      buildiumTransactionId,
    });
  }
};

const resolvePostingType = (line: UnknownRecord): 'Debit' | 'Credit' => {
  const raw =
    typeof line?.PostingType === 'string'
      ? line.PostingType
      : typeof line?.posting_type === 'string'
        ? line.posting_type
        : typeof line?.PostingTypeEnum === 'string'
          ? line.PostingTypeEnum
          : typeof line?.PostingTypeString === 'string'
            ? line.PostingTypeString
            : typeof line?.postingType === 'string'
              ? line.postingType
              : null;
  const normalized = (raw || '').toLowerCase();
  if (normalized === 'debit' || normalized === 'dr' || normalized.includes('debit')) return 'Debit';
  if (normalized === 'credit' || normalized === 'cr' || normalized.includes('credit'))
    return 'Credit';
  const amountNum = Number(line?.Amount ?? 0);
  return amountNum < 0 ? 'Debit' : 'Credit';
};

async function resolveOrgIdFromBuildiumAccount(accountId?: number | null) {
  if (!accountId) return null;
  const cacheKey = String(accountId);
  if (orgCache.has(cacheKey)) return orgCache.get(cacheKey) ?? null;
  const { data, error } = await admin
    .from('organizations')
    .select('id')
    .eq('buildium_org_id', accountId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  const orgId = data?.id ?? null;
  orgCache.set(cacheKey, orgId);
  return orgId;
}

async function resolveOrgContextFromEvents(events: IncomingBuildiumEvent[]) {
  const accountId =
    firstNumber(
      ...events.map((ev) =>
        firstNumber(
          ev?.AccountId,
          ev?.Data?.AccountId,
          (ev?.Data as UnknownRecord | undefined)?.AccountId,
          (ev?.Data as UnknownRecord | undefined)?.Account?.Id,
          (ev?.Account as UnknownRecord | undefined)?.Id,
        ),
      ),
    ) ?? null;

  if (accountId != null) {
    const orgId = await resolveOrgIdFromBuildiumAccount(accountId);
    if (orgId) return { orgId, accountId };
  }

  const propertyId =
    firstNumber(
      ...events.map((ev) =>
        firstNumber(
          ev?.PropertyId,
          ev?.Data?.PropertyId,
          (ev?.Data as UnknownRecord | undefined)?.Property?.Id,
          (ev?.Property as UnknownRecord | undefined)?.Id,
        ),
      ),
    ) ?? null;

  if (propertyId != null) {
    const { data, error } = await admin
      .from('properties')
      .select('org_id')
      .eq('buildium_property_id', propertyId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (data?.org_id) return { orgId: data.org_id, accountId };
  }

  const leaseId =
    firstNumber(
      ...events.map((ev) =>
        firstNumber(
          ev?.LeaseId,
          ev?.Data?.LeaseId,
          (ev?.Lease as UnknownRecord | undefined)?.Id,
          (ev?.Data as UnknownRecord | undefined)?.Lease?.Id,
        ),
      ),
    ) ?? null;

  if (leaseId != null) {
    const { data, error } = await admin
      .from('lease')
      .select('org_id')
      .eq('buildium_lease_id', leaseId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (data?.org_id) return { orgId: data.org_id, accountId };
  }

  return { orgId: null, accountId };
}

function computeHmac(raw: string, secret: string) {
  const buf = createHmac('sha256', secret).update(raw).digest();
  return {
    hex: buf.toString('hex'),
    base64: buf.toString('base64'),
  };
}

type EdgeForwardResult =
  | { ok: true; status?: number; body?: string }
  | { ok: false; status: number; body: string };
type EdgeForwardBody = {
  failed?: number;
  results?: Array<{ success?: boolean } | null>;
};

async function forwardBankTransactionToEdge(
  event: UnknownRecord,
  webhookSecret: string,
): Promise<EdgeForwardResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const secret = webhookSecret || process.env.BUILDIUM_WEBHOOK_SECRET || '';

  if (!supabaseUrl) return { ok: false, status: 500, body: 'missing NEXT_PUBLIC_SUPABASE_URL' };
  if (!serviceKey) return { ok: false, status: 500, body: 'missing SUPABASE_SERVICE_ROLE_KEY' };
  if (!secret) return { ok: false, status: 500, body: 'missing BUILDIUM_WEBHOOK_SECRET' };

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/buildium-webhook`;
  const payload = JSON.stringify({ Events: [event] });
  const timestamp = String(Date.now());

  // Edge function verifies Buildium HMAC signatures; emulate Buildium headers here.
  const signature = computeHmac(`${timestamp}.${payload}`, secret).base64;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Edge Functions are JWT-gated by default; use service role for server-to-server calls.
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      // Buildium signature headers expected by the edge function.
      'buildium-webhook-timestamp': timestamp,
      'x-buildium-signature': signature,
    },
    body: payload,
  });

  const bodyText = await res.text().catch(() => '');

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: bodyText || res.statusText || 'edge-forward-failed',
    };
  }

  // The edge function returns HTTP 200 for the request even if one or more events failed.
  // Validate the response body so we don't silently mark a webhook as processed when downstream work failed.
  try {
    const parsed: EdgeForwardBody | null = bodyText
      ? (JSON.parse(bodyText) as EdgeForwardBody)
      : null;
    const failed = Number(parsed?.failed ?? 0);
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    const anyFailed = failed > 0 || results.some((r) => r && r.success === false);
    if (anyFailed) {
      return {
        ok: false,
        status: 502,
        body: bodyText || 'edge-forward-partial-failure',
      };
    }
  } catch {
    // If we can't parse a success response, treat it as a failure so the webhook can be retried/inspected.
    return {
      ok: false,
      status: 502,
      body: bodyText || 'edge-forward-unparseable-success-response',
    };
  }

  return { ok: true };
}

function verifySignature(
  req: NextRequest,
  raw: string,
  secret: string,
): { ok: boolean; reason?: string } {
  // Try multiple possible header names for Buildium signature
  const sig =
    req.headers.get('x-buildium-signature') ||
    req.headers.get('buildium-webhook-signature') ||
    req.headers.get('x-buildium-webhook-signature') ||
    '';

  // Try multiple possible header names for timestamp
  const timestamp =
    req.headers.get('buildium-webhook-timestamp') ||
    req.headers.get('x-buildium-timestamp') ||
    req.headers.get('x-buildium-webhook-timestamp') ||
    '';

  // In local/dev, allow processing without a secret to simplify testing.
  if (!secret) {
    console.warn(
      '[buildium-webhook] BUILDIUM_WEBHOOK_SECRET is not set; skipping signature verification',
    );
    return { ok: true };
  }

  if (!sig) {
    // Log in development to help debug
    if (process.env.NODE_ENV === 'development') {
      console.warn('[buildium-webhook] No signature header found. Checked headers:', {
        'x-buildium-signature': req.headers.get('x-buildium-signature'),
        'buildium-webhook-signature': req.headers.get('buildium-webhook-signature'),
        'x-buildium-webhook-signature': req.headers.get('x-buildium-webhook-signature'),
      });
    }
    return { ok: false, reason: 'missing-signature' };
  }

  try {
    // Try both the secret as-is and base64 decoded (Buildium secret might be base64)
    let secretToUse = secret;
    try {
      // If secret looks like base64, try decoding it
      if (secret.includes('=') && secret.length % 4 === 0) {
        const decoded = Buffer.from(secret, 'base64').toString('utf-8');
        if (decoded && decoded.length > 0) {
          secretToUse = decoded;
        }
      }
    } catch {
      // If decoding fails, use original secret
    }

    // Buildium signs: timestamp + '.' + raw body, then HMAC-SHA256, then base64 encode
    // If timestamp is present, use it; otherwise sign just the raw body
    const payloadToSign = timestamp ? `${timestamp}.${raw}` : raw;

    // Try with both original secret and decoded secret
    const { hex, base64 } = computeHmac(payloadToSign, secretToUse);
    const { hex: hexOriginal, base64: base64Original } =
      secretToUse !== secret ? computeHmac(payloadToSign, secret) : { hex: '', base64: '' };

    // Buildium signature is base64-encoded HMAC
    // The signature we receive is already base64, so we need to compare base64 to base64
    // Also try converting hex to base64 for comparison
    const expectedBase64FromHex = Buffer.from(hex, 'hex').toString('base64');
    const expectedBase64FromHexOriginal = hexOriginal
      ? Buffer.from(hexOriginal, 'hex').toString('base64')
      : '';

    // Check if Buildium sends signature with a prefix (e.g., "sha256=...")
    const sigWithoutPrefix = sig.replace(/^(sha256=|sha1=)/i, '');

    // Try exact match with base64 (most likely format)
    if (sig === base64 || sig === expectedBase64FromHex) {
      return { ok: true };
    }

    // Try without prefix
    if (sigWithoutPrefix === base64 || sigWithoutPrefix === expectedBase64FromHex) {
      return { ok: true };
    }

    // Try with original secret if we tried decoded
    if (hexOriginal && (sig === base64Original || sig === expectedBase64FromHexOriginal)) {
      return { ok: true };
    }
    if (
      hexOriginal &&
      (sigWithoutPrefix === base64Original || sigWithoutPrefix === expectedBase64FromHexOriginal)
    ) {
      return { ok: true };
    }

    // Also try hex format (unlikely but possible)
    if (sig === hex || sigWithoutPrefix === hex) {
      return { ok: true };
    }
    if (hexOriginal && (sig === hexOriginal || sigWithoutPrefix === hexOriginal)) {
      return { ok: true };
    }

    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature verification failed:', {
        reason: 'signature-mismatch',
        receivedLength: sig.length,
        hasTimestamp: !!timestamp,
        bodyLength: raw.length,
      });
    }

    return { ok: false, reason: 'invalid-signature' };
  } catch (e) {
    console.error('[buildium-webhook] HMAC error:', e);
    return { ok: false, reason: 'hmac-error' };
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildium-webhook] GET ping', {
      url: req.url,
      headers: {
        'user-agent': req.headers.get('user-agent'),
        'x-buildium-signature': req.headers.get('x-buildium-signature'),
        'buildium-webhook-signature': req.headers.get('buildium-webhook-signature'),
      },
    });
  }
  return NextResponse.json({ ok: true, message: 'Buildium webhook endpoint' });
}

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin || supabase;
  const raw = await req.text();

  // Log webhook receipt (in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildium-webhook] Received webhook', {
      method: req.method,
      url: req.url,
      bodyLength: raw.length,
      headers: {
        'content-type': req.headers.get('content-type'),
        'user-agent': req.headers.get('user-agent'),
        'x-buildium-signature': req.headers.get('x-buildium-signature'),
        'buildium-webhook-signature': req.headers.get('buildium-webhook-signature'),
        'buildium-webhook-timestamp': req.headers.get('buildium-webhook-timestamp'),
      },
    });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const body = toIncomingRecord(parsedBody);
  // Buildium sends events in different formats:
  // 1. { Events: [...] } - array of events
  // 2. { EventName: "...", ... } - single event object (current format)
  // 3. { Event: {...} } - wrapped single event
  const events: IncomingBuildiumEvent[] = extractIncomingEvents(body);

  if (!events.length) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] No events found in payload. Body structure:', {
        hasEvents: !!body?.Events,
        hasEvent: !!body?.Event,
        hasEventName: !!body?.EventName,
        hasId: !!body?.Id,
        bodyKeys: Object.keys(body),
        bodyPreview: JSON.stringify(body).substring(0, 200),
      });
    }
    await sendPagerDutyEvent({
      summary: 'Buildium webhook payload missing events',
      severity: 'warning',
      customDetails: { bodyPreview: JSON.stringify(body).slice(0, 200) },
    });
    return NextResponse.json({ error: 'No webhook events found in payload' }, { status: 400 });
  }

  const { orgId, accountId } = await resolveOrgContextFromEvents(events);
  const config = await getOrgScopedBuildiumConfig(orgId ?? undefined);
  if (!config) {
    await sendPagerDutyEvent({
      summary: 'Buildium webhook missing credentials',
      severity: 'error',
      customDetails: { orgId, accountId },
    });
    return NextResponse.json(
      { error: 'Buildium credentials not configured for this org' },
      { status: 503 },
    );
  }

  buildiumCreds = config;
  const webhookSecretToUse = config.webhookSecret || process.env.BUILDIUM_WEBHOOK_SECRET || '';
  const sigCheck = verifySignature(req, raw, webhookSecretToUse);
  if (!sigCheck.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature check failed:', sigCheck.reason);
    }
    await sendPagerDutyEvent({
      summary: 'Buildium webhook signature invalid',
      severity: 'warning',
      customDetails: { reason: sigCheck.reason, orgId, accountId },
    });
    return NextResponse.json(
      { error: 'Invalid signature', reason: sigCheck.reason },
      { status: 401 },
    );
  }

  const signatureHeader = req.headers.get('x-buildium-signature') || '';
  const results: {
    eventId: string | number | null;
    status: 'processed' | 'duplicate' | 'error' | 'invalid' | 'tombstoned';
    error?: string;
    forwarded?: 'edge';
    deleted?: boolean;
    count?: number;
    repaired?: boolean;
    reprocessed?: boolean;
    edgeStatus?: number;
    edgeBodyPreview?: string;
  }[] = [];
  const storedEvents: NormalizedBuildiumWebhook[] = [];

  const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;

  async function fetchLeaseTransaction(leaseId: number, transactionId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(
      `${getBuildiumBaseUrl(creds)}/leases/${leaseId}/transactions/${transactionId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-buildium-client-id': creds.clientId,
          'x-buildium-client-secret': creds.clientSecret,
        },
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch transaction before forwarding', {
        status: res.status,
        body: txt,
      });
      return null;
    }
    return res.json();
  }
  async function fetchGLAccount(glAccountId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/glaccounts/${glAccountId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch glaccount before forwarding', {
        status: res.status,
        body: txt,
      });
      return null;
    }
    return res.json();
  }

  async function fetchLease(leaseId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/leases/${leaseId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch lease', { status: res.status, body: txt });
      return null;
    }
    return res.json();
  }

  async function fetchLeaseTenant(tenantId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/leases/tenants/${tenantId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch lease tenant', {
        status: res.status,
        body: txt,
      });
      return null;
    }
    return res.json();
  }

  async function fetchLeaseMoveOut(leaseId: number, tenantId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/leases/${leaseId}/moveouts/${tenantId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch lease moveout', {
        status: res.status,
        body: txt,
      });
      return null;
    }
    return res.json();
  }

  async function fetchBill(billId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/bills/${billId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch bill', { status: res.status, body: txt });
      return null;
    }
    return res.json();
  }

  async function fetchBillPayment(billId: number, paymentId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/bills/${billId}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch bill payment', {
        status: res.status,
        body: txt,
        billId,
        paymentId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchGLAccountRemote(glAccountId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/glaccounts/${glAccountId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch GL account', {
        status: res.status,
        body: txt,
        glAccountId,
      });
      return null;
    }
    return res.json();
  }

  async function upsertGLAccountWithOrg(gl: UnknownRecord, buildiumAccountId?: number | null) {
    const parsed = parseBuildiumGLAccountPayload(gl);
    if (!parsed.ok) {
      throw new Error(`Invalid GL account payload: ${parsed.errors.join('; ')}`);
    }
    const mapped = await mapGLAccountFromBuildiumWithSubAccounts(parsed.data, admin);
    const now = new Date().toISOString();
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId);
    const mappedOrgId = (mapped as { org_id?: string | null }).org_id ?? null;
    const glPayload: TablesInsert<'gl_accounts'> = {
      ...mapped,
      org_id: orgId ?? mappedOrgId ?? null,
      updated_at: now,
      type: mapped.type || 'Other',
      is_security_deposit_liability: mapped.is_security_deposit_liability ?? false,
      sub_accounts: mapped.sub_accounts ?? null,
    };
    const { data: existing, error: findErr } = await admin
      .from('gl_accounts')
      .select('id, created_at')
      .eq('buildium_gl_account_id', mapped.buildium_gl_account_id)
      .maybeSingle();
    if (findErr && findErr.code !== 'PGRST116') throw findErr;
    if (existing?.id) {
      await admin.from('gl_accounts').update(glPayload).eq('id', existing.id);
    } else {
      const insertPayload: TablesInsert<'gl_accounts'> = {
        ...glPayload,
        created_at: now,
      };
      await admin.from('gl_accounts').insert(insertPayload);
    }
  }

  async function fetchRentalProperty(propertyId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/rentals/${propertyId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch rental property', {
        status: res.status,
        body: txt,
        propertyId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchRentalUnit(unitId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/rentals/units/${unitId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch rental unit', {
        status: res.status,
        body: txt,
        unitId,
      });
      return null;
    }
    return res.json();
  }

  async function upsertPropertyFromBuildium(
    buildiumProperty: UnknownRecord,
    buildiumAccountId?: number | null,
  ) {
    const parsed = parseBuildiumPropertyPayload(buildiumProperty);
    if (!parsed.ok) {
      throw new Error(`Invalid property payload: ${parsed.errors.join('; ')}`);
    }
    const now = new Date().toISOString();
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId);
    const mapped = await mapPropertyFromBuildiumWithBankAccount(parsed.data, admin);
    const resolvedOrgId = orgId ?? (mapped as { org_id?: string | null }).org_id ?? null;
    if (!resolvedOrgId) {
      throw new Error(`Unable to resolve org for Buildium property ${parsed.data.Id ?? 'unknown'}`);
    }
    const basePayload: TablesInsert<'properties'> = {
      buildium_property_id: mapped.buildium_property_id,
      name: mapped.name,
      address_line1: mapped.address_line1,
      address_line2: mapped.address_line2 ?? null,
      address_line3: mapped.address_line3 ?? null,
      city: mapped.city,
      state: mapped.state ?? null,
      postal_code: mapped.postal_code,
      country: (mapped.country ?? 'United States') as Database['public']['Enums']['countries'],
      property_type: (mapped.property_type ?? null) as
        | Database['public']['Enums']['property_type_enum']
        | null,
      structure_description: mapped.structure_description ?? null,
      rental_type: mapped.rental_type ?? null,
      operating_bank_gl_account_id: mapped.operating_bank_gl_account_id ?? null,
      reserve: mapped.reserve ?? null,
      year_built: mapped.year_built ?? null,
      total_units: mapped.total_units ?? 0,
      is_active: mapped.is_active ?? null,
      org_id: resolvedOrgId,
      service_assignment: ((
        mapped as {
          service_assignment?: Database['public']['Enums']['assignment_level'] | null;
        }
      ).service_assignment ?? 'Property Level') as Database['public']['Enums']['assignment_level'],
      updated_at: now,
    };
    const payload: TablesUpdate<'properties'> = {
      ...basePayload,
      total_units: mapped.total_units ?? undefined,
    };
    const { data: existing, error: findErr } = await admin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumProperty?.Id)
      .maybeSingle();
    if (findErr && findErr.code !== 'PGRST116') throw findErr;
    if (existing?.id) {
      await admin.from('properties').update(payload).eq('id', existing.id);
      return existing.id;
    } else {
      const insertPayload: TablesInsert<'properties'> = { ...basePayload, created_at: now };
      const { data: inserted, error: insErr } = await admin
        .from('properties')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      return inserted?.id ?? null;
    }
  }

  async function upsertUnitFromBuildium(
    buildiumUnit: UnknownRecord,
    buildiumAccountId?: number | null,
  ) {
    const parsed = parseBuildiumUnitPayload(buildiumUnit);
    if (!parsed.ok) {
      throw new Error(`Invalid unit payload: ${parsed.errors.join('; ')}`);
    }
    const now = new Date().toISOString();
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId);
    const mapped = mapUnitFromBuildium(parsed.data);
    const { data: propertyRow, error: propertyErr } = await admin
      .from('properties')
      .select('id, org_id')
      .eq('buildium_property_id', parsed.data.PropertyId)
      .maybeSingle();
    if (propertyErr && propertyErr.code !== 'PGRST116') throw propertyErr;
    const propertyIdLocal = propertyRow?.id ?? null;
    const propertyOrgId = propertyRow?.org_id ?? null;
    if (!propertyIdLocal) {
      throw new Error(
        `Missing local property for Buildium unit ${parsed.data.Id} (PropertyId ${parsed.data.PropertyId})`,
      );
    }

    const resolvedOrgId =
      orgId ?? propertyOrgId ?? (mapped as { org_id?: string | null }).org_id ?? null;
    if (!resolvedOrgId) {
      throw new Error(
        `Unable to resolve org for Buildium unit ${parsed.data.Id} (PropertyId ${parsed.data.PropertyId})`,
      );
    }

    const unitNumber = mapped.unit_number ?? null;
    const addressLine1 = mapped.address_line1 ?? null;
    const postalCode = mapped.postal_code ?? null;
    if (!unitNumber || !addressLine1 || !postalCode) {
      throw new Error(
        `Missing required unit fields for Buildium unit ${parsed.data.Id}: unit_number=${unitNumber}, address_line1=${addressLine1}, postal_code=${postalCode}`,
      );
    }

    const payload: TablesInsert<'units'> = {
      buildium_unit_id: mapped.buildium_unit_id,
      buildium_property_id: mapped.buildium_property_id,
      building_name: mapped.building_name ?? null,
      unit_number: unitNumber,
      description: mapped.description ?? null,
      market_rent: mapped.market_rent ?? null,
      address_line1: addressLine1,
      address_line2: mapped.address_line2 ?? null,
      address_line3: mapped.address_line3 ?? null,
      city: mapped.city ?? null,
      state: mapped.state ?? null,
      postal_code: postalCode,
      country: (mapped.country ?? 'United States') as Database['public']['Enums']['countries'],
      unit_bedrooms: mapped.unit_bedrooms as Database['public']['Enums']['bedroom_enum'] | null,
      unit_bathrooms: mapped.unit_bathrooms as Database['public']['Enums']['bathroom_enum'] | null,
      unit_size: mapped.unit_size ?? null,
      is_active: mapped.is_active ?? null,
      org_id: resolvedOrgId,
      property_id: propertyIdLocal,
      updated_at: now,
    };
    // Upsert the unit with the resolved property/org context
    const { data: existing, error: findErr } = await admin
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnit?.Id)
      .maybeSingle();
    if (findErr && findErr.code !== 'PGRST116') throw findErr;
    if (existing?.id) {
      await admin.from('units').update(payload).eq('id', existing.id);
      return existing.id;
    } else {
      const insertPayload: TablesInsert<'units'> = { ...payload, created_at: now };
      const { data: inserted, error: insErr } = await admin
        .from('units')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      return inserted?.id ?? null;
    }
  }

  async function fetchTaskCategory(categoryId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/tasks/categories/${categoryId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch task category', {
        status: res.status,
        body: txt,
        categoryId,
      });
      return null;
    }
    return res.json();
  }

  async function upsertTaskCategory(
    buildiumCategory: UnknownRecord,
    _buildiumAccountId?: number | null,
  ) {
    const now = new Date().toISOString();
    const categoryName = buildiumCategory?.Name;
    const payload: TablesInsert<'task_categories'> = {
      buildium_category_id: buildiumCategory?.Id ?? null,
      name: typeof categoryName === 'string' && categoryName ? categoryName : 'Unnamed Category',
      is_active: true,
      description: null,
      color: null,
      parent_id: null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await admin
      .from('task_categories')
      .upsert(payload as TablesInsert<'task_categories'>, { onConflict: 'buildium_category_id' })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  }

  async function upsertVendorCategory(
    buildiumCategory: UnknownRecord,
    _buildiumAccountId?: number | null,
  ) {
    const now = new Date().toISOString();
    const categoryName = buildiumCategory?.Name;
    const payload: TablesInsert<'vendor_categories'> = {
      buildium_category_id: buildiumCategory?.Id ?? null,
      name: typeof categoryName === 'string' && categoryName ? categoryName : 'Unnamed Category',
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await admin
      .from('vendor_categories')
      .upsert(payload, { onConflict: 'buildium_category_id' })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  }

  async function upsertVendor(buildiumVendor: UnknownRecord) {
    const parsed = parseBuildiumVendorPayload(buildiumVendor);
    if (!parsed.ok) {
      throw new Error(`Invalid vendor payload: ${parsed.errors.join('; ')}`);
    }
    const now = new Date().toISOString();
    const mapped = await mapVendorFromBuildiumWithCategory(parsed.data, admin);
    const contactId = mapped.contact_id || (await findOrCreateVendorContact(parsed.data, admin));
    if (!contactId) throw new Error('Unable to resolve contact for vendor');

    const payload: Record<string, unknown> = {
      ...mapped,
      contact_id: contactId,
      updated_at: now,
    };

    const { data: existing, error: findErr } = await admin
      .from('vendors')
      .select('id, created_at')
      .eq('buildium_vendor_id', mapped.buildium_vendor_id)
      .maybeSingle();
    if (findErr && findErr.code !== 'PGRST116') throw findErr;

    if (existing?.id) {
      await admin.from('vendors').update(payload).eq('id', existing.id);
      return existing.id;
    } else {
      const insertPayload: TablesInsert<'vendors'> = {
        ...mapped,
        contact_id: contactId,
        created_at: now,
        updated_at: now,
      };
      const { data: created, error: insErr } = await admin
        .from('vendors')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      return created?.id ?? null;
    }
  }

  async function upsertWorkOrder(buildiumWorkOrder: UnknownRecord) {
    const parsed = parseBuildiumWorkOrderPayload(buildiumWorkOrder);
    if (!parsed.ok) {
      throw new Error(`Invalid work order payload: ${parsed.errors.join('; ')}`);
    }
    const now = new Date().toISOString();
    const mapped = await mapWorkOrderFromBuildiumWithRelations(parsed.data, admin);
    mapped.updated_at = now;
    if (!mapped.property_id) {
      throw new Error(`Missing property_id for work order ${parsed.data.Id}`);
    }
    const { data: existing, error: findErr } = await admin
      .from('work_orders')
      .select('id, created_at')
      .eq('buildium_work_order_id', mapped.buildium_work_order_id)
      .maybeSingle();
    if (findErr && findErr.code !== 'PGRST116') throw findErr;
    if (existing?.id) {
      await admin.from('work_orders').update(mapped).eq('id', existing.id);
      return existing.id;
    } else {
      const { data: created, error: insErr } = await admin
        .from('work_orders')
        .insert({ ...mapped, created_at: mapped.created_at || now })
        .select('id')
        .single();
      if (insErr) throw insErr;
      return created?.id ?? null;
    }
  }

  async function upsertRentalOwner(
    buildiumOwner: UnknownRecord,
    buildiumAccountId?: number | null,
  ): Promise<{ ownerId: string; linkedProperties: number }> {
    // Org from AccountId
    let orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId);
    const { ownerId } = await upsertOwnerFromBuildium(buildiumOwner as BuildiumOwner, admin, orgId);

    // Create ownerships for each property id provided
    const rawPropertyIds =
      (buildiumOwner as UnknownRecord)?.PropertyIds ??
      (buildiumOwner as UnknownRecord)?.PropertyIDs ??
      ((buildiumOwner as UnknownRecord)?.PropertyId
        ? [(buildiumOwner as UnknownRecord).PropertyId]
        : []);
    const propertyIds = Array.isArray(rawPropertyIds) ? rawPropertyIds : [];
    if (!propertyIds.length) {
      console.warn(
        '[buildium-webhook] RentalOwner has no PropertyIds; ownerships will be skipped',
        { ownerId, buildiumOwnerId: buildiumOwner?.Id, rawPropertyIds },
      );
    }
    let linked = 0;
    if (propertyIds.length) {
      const now = new Date().toISOString();
      const share = propertyIds.length > 0 ? 100 / propertyIds.length : null;

      for (let i = 0; i < propertyIds.length; i++) {
        const pid = Number(propertyIds[i]);
        const prop = await admin
          .from('properties')
          .select('id, org_id')
          .eq('buildium_property_id', pid)
          .maybeSingle();
        if (prop.error && prop.error.code !== 'PGRST116') throw prop.error;
        if (!prop.data?.id) {
          console.warn('[buildium-webhook] Skipping ownership insert; property not found locally', {
            ownerId,
            pid,
          });
          continue;
        }
        const orgForOwnership =
          prop.data.org_id ?? orgId ?? (await resolveOrgIdFromBuildiumAccount(buildiumAccountId));
        if (!orgForOwnership) {
          console.warn('[buildium-webhook] Skipping ownership insert; missing org_id', {
            ownerId,
            pid,
            localPropId: prop.data.id,
          });
          continue;
        }
        orgId = orgForOwnership;
        const payload = {
          owner_id: ownerId,
          property_id: prop.data.id,
          org_id: orgForOwnership,
          ownership_percentage: share ?? 100,
          disbursement_percentage: share ?? 100,
          primary: i === 0,
          total_properties: propertyIds.length,
          total_units: 0,
          created_at: now,
          updated_at: now,
        };
        const { data: existingOwn, error: findOwnErr } = await admin
          .from('ownerships')
          .select('id')
          .eq('owner_id', ownerId)
          .eq('property_id', prop.data.id)
          .maybeSingle();
        if (findOwnErr && findOwnErr.code !== 'PGRST116') throw findOwnErr;
        if (!existingOwn) {
          const { error: ownErr } = await admin.from('ownerships').insert(payload);
          if (ownErr) {
            console.error('[buildium-webhook] Ownership insert failed', { payload, error: ownErr });
            throw ownErr;
          }
          linked++;
        }
      }

      // If owner org is still null but we derived one, update owner
      if (orgId) {
        const { error: ownerUpdateErr } = await admin
          .from('owners')
          .update({ org_id: orgId, updated_at: new Date().toISOString() })
          .eq('id', ownerId);
        if (ownerUpdateErr) throw ownerUpdateErr;
      }
    } else if (orgId) {
      // Even without properties, persist org on owner
      await admin
        .from('owners')
        .update({ org_id: orgId, updated_at: new Date().toISOString() })
        .eq('buildium_owner_id', buildiumOwner?.Id);
    }
    return { ownerId, linkedProperties: linked };
  }

  async function updatePropertyManager(
    propertyIdBuildium: number,
    rentalManagerId?: number | null,
  ) {
    if (!rentalManagerId) return;
    // Resolve local property id
    const { data: propRow, error: propErr } = await admin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', propertyIdBuildium)
      .maybeSingle();
    if (propErr) throw propErr;
    const propertyIdLocal = propRow?.id;
    if (!propertyIdLocal) return;

    // Resolve local staff id by buildium_staff_id
    const { data: staffRow, error: staffErr } = await admin
      .from('staff')
      .select('id')
      .eq('buildium_staff_id', rentalManagerId)
      .maybeSingle();
    if (staffErr) throw staffErr;
    const staffId = staffRow?.id;
    if (!staffId) return;

    const now = new Date().toISOString();
    // Look for existing property_staff role Property Manager
    const { data: existing, error: psErr } = await admin
      .from('property_staff')
      .select('property_id, staff_id, role')
      .eq('property_id', propertyIdLocal)
      .eq('role', 'Property Manager')
      .maybeSingle();
    if (psErr && psErr.code !== 'PGRST116') throw psErr;

    if (existing?.staff_id && existing.staff_id !== staffId) {
      // Reassign manager
      await admin
        .from('property_staff')
        .update({ staff_id: staffId, updated_at: now })
        .eq('property_id', propertyIdLocal)
        .eq('role', 'Property Manager');
    } else if (!existing) {
      await admin.from('property_staff').insert({
        property_id: propertyIdLocal,
        staff_id: staffId,
        role: 'Property Manager',
        created_at: now,
        updated_at: now,
      });
    }
  }

  async function fetchTask(taskId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch task', {
        status: res.status,
        body: txt,
        taskId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchVendorCategory(vendorCategoryId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/vendors/categories/${vendorCategoryId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch vendor category', {
        status: res.status,
        body: txt,
        vendorCategoryId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchVendor(vendorId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/vendors/${vendorId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch vendor', {
        status: res.status,
        body: txt,
        vendorId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchWorkOrder(workOrderId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/workorders/${workOrderId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch work order', {
        status: res.status,
        body: txt,
        workOrderId,
      });
      return null;
    }
    return res.json();
  }

  async function fetchRentalOwner(rentalOwnerId: number) {
    const creds = buildiumCreds;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    const res = await fetch(`${getBuildiumBaseUrl(creds)}/rentals/owners/${rentalOwnerId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': creds.clientId,
        'x-buildium-client-secret': creds.clientSecret,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[buildium-webhook] Failed to fetch rental owner', {
        status: res.status,
        body: txt,
        rentalOwnerId,
      });
      return null;
    }
    return res.json();
  }

  async function upsertTaskFromBuildium(
    buildiumTask: UnknownRecord,
    _buildiumAccountId?: number | null,
  ) {
    const now = new Date().toISOString();
    const taskKind = (() => {
      const t = (buildiumTask?.TaskType || '').toString().toLowerCase();
      if (t === 'todo') return 'todo';
      if (t === 'residentrequest' || t === 'resident') return 'resident';
      if (t === 'owner') return 'owner';
      if (t === 'contact') return 'contact';
      return 'other';
    })();
    const mapped = await mapTaskFromBuildiumWithRelations(buildiumTask, admin, {
      taskKind,
      requireCategory: true,
      defaultCategoryName: 'To-Do',
    });
    const taskSubject =
      mapped.subject ?? buildiumTask?.Title ?? buildiumTask?.Subject ?? 'Untitled Task';
    const { subject: _, ...mappedWithoutSubject } = mapped;
    const basePayload = {
      ...mappedWithoutSubject,
      subject: taskSubject,
      buildium_task_id: buildiumTask?.Id ?? mapped.buildium_task_id ?? null,
      buildium_assigned_to_user_id:
        buildiumTask?.AssignedToUserId ?? mapped.buildium_assigned_to_user_id ?? null,
      buildium_property_id: buildiumTask?.Property?.Id ?? mapped.buildium_property_id ?? null,
      buildium_unit_id: buildiumTask?.UnitId ?? mapped.buildium_unit_id ?? null,
      buildium_owner_id: mapped.buildium_owner_id ?? null,
      buildium_tenant_id: mapped.buildium_tenant_id ?? null,
      source: 'buildium' as Database['public']['Enums']['task_source_enum'],
      updated_at: now,
    };

    const buildiumTaskId = basePayload.buildium_task_id;
    let existing: { id: string; created_at: string | null } | null = null;
    let findErr: { code?: string; message?: string } | null = null;
    if (buildiumTaskId != null && typeof buildiumTaskId === 'number') {
      const result = await admin
        .from('tasks')
        .select('id, created_at')
        .eq('buildium_task_id', buildiumTaskId)
        .maybeSingle();
      existing = result.data;
      findErr = result.error;
    }
    if (findErr && (findErr as { code?: string }).code !== 'PGRST116') {
      throw findErr as Error;
    }
    if (existing?.id) {
      await admin.from('tasks').update(basePayload).eq('id', existing.id);
      return existing.id;
    } else {
      const insertPayload: TablesInsert<'tasks'> = {
        ...basePayload,
        created_at: mapped.created_at || now,
      };
      const { data: inserted, error: insErr } = await admin
        .from('tasks')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      return inserted?.id ?? null;
    }
  }

  async function deleteGLAccountLocal(glAccountId: number) {
    const { data: existing, error } = await admin
      .from('gl_accounts')
      .select('id')
      .eq('buildium_gl_account_id', glAccountId)
      .maybeSingle();
    if (error) throw error;
    const glId = existing?.id;
    if (!glId) {
      console.log(
        '[buildium-webhook] GL account delete received but not found locally',
        glAccountId,
      );
      return false;
    }
    // Remove from any parent sub_accounts arrays
    const { data: parents, error: parentErr } = await admin
      .from('gl_accounts')
      .select('id, sub_accounts')
      .contains('sub_accounts', [glId]);
    if (parentErr) throw parentErr;
    if (parents && parents.length) {
      for (const p of parents) {
        const subs: string[] = Array.isArray(p?.sub_accounts) ? p.sub_accounts : [];
        const filtered = subs.filter((sid) => sid !== glId);
        await admin
          .from('gl_accounts')
          .update({ sub_accounts: filtered, updated_at: new Date().toISOString() })
          .eq('id', p.id);
      }
    }
    await admin.from('gl_accounts').delete().eq('id', glId);
    console.log('[buildium-webhook] GL account deleted locally', { glAccountId, glId });
    return true;
  }

  async function deleteBillLocal(buildiumBillId: number) {
    // Find any transactions linked to this Buildium bill
    const { data: txRows, error } = await admin
      .from('transactions')
      .select('id')
      .eq('buildium_bill_id', buildiumBillId);
    if (error) throw error;
    if (!txRows || txRows.length === 0) {
      console.log('[buildium-webhook] Bill delete received but not found locally', buildiumBillId);
      return false;
    }
    const txIds = txRows.map((t) => t.id).filter(Boolean);
    if (txIds.length) {
      await admin.from('transaction_lines').delete().in('transaction_id', txIds);
      await admin.from('transactions').delete().in('id', txIds);
      console.log('[buildium-webhook] Bill deleted locally', {
        buildiumBillId,
        transactionCount: txIds.length,
      });
    }
    return true;
  }

  async function deleteBillPaymentLocal(paymentId: number, billId?: number | null) {
    // First try to find by paymentId (most specific match)
    // If not found and billId provided, try by billId as fallback
    // Always filter by transaction_type='Payment' to ensure we only delete payment transactions

    let txRows: Array<{ id: string }> | null = null;

    // Try paymentId first (most specific)
    if (paymentId != null) {
      const { data, error } = await admin
        .from('transactions')
        .select('id')
        .eq('transaction_type', 'Payment')
        .eq('buildium_transaction_id', paymentId);
      if (error) throw error;
      if (data && data.length > 0) {
        txRows = data;
      }
    }

    // Fallback to billId if paymentId didn't match
    if ((!txRows || txRows.length === 0) && billId != null) {
      const { data, error } = await admin
        .from('transactions')
        .select('id')
        .eq('transaction_type', 'Payment')
        .eq('buildium_bill_id', billId);
      if (error) throw error;
      if (data && data.length > 0) {
        txRows = data;
      }
    }

    if (!txRows || txRows.length === 0) {
      console.log('[buildium-webhook] Bill payment delete received but not found locally', {
        paymentId,
        billId,
      });
      return false;
    }

    const txIds = txRows.map((t) => t.id).filter(Boolean);
    if (txIds.length) {
      await admin.from('transaction_lines').delete().in('transaction_id', txIds);
      await admin.from('transactions').delete().in('id', txIds);
      console.log('[buildium-webhook] Bill payment deleted locally', {
        paymentId,
        billId,
        transactionCount: txIds.length,
      });
    }
    return true;
  }

  async function deleteLeaseLocal(buildiumLeaseId: number) {
    const { data: leaseRow, error } = await admin
      .from('lease')
      .select('id')
      .eq('buildium_lease_id', buildiumLeaseId)
      .maybeSingle();
    if (error) throw error;
    if (!leaseRow?.id) {
      console.log(
        '[buildium-webhook] Lease delete received but not found locally',
        buildiumLeaseId,
      );
      return false;
    }
    const leaseId = leaseRow.id;
    // Null out monthly_logs referencing this lease
    await admin
      .from('monthly_logs')
      .update({ lease_id: null, updated_at: new Date().toISOString() })
      .eq('lease_id', leaseId);
    // Delete lease_contacts for this lease
    await admin.from('lease_contacts').delete().eq('lease_id', leaseId);
    // Delete the lease row
    await admin.from('lease').delete().eq('id', leaseId);
    console.log('[buildium-webhook] Lease deleted locally', leaseId);
    return true;
  }

  async function deleteTenantLocal(buildiumTenantId: number) {
    const { data: tenantRow, error } = await admin
      .from('tenants')
      .select('id')
      .eq('buildium_tenant_id', buildiumTenantId)
      .maybeSingle();
    if (error) throw error;
    if (!tenantRow?.id) {
      console.log(
        '[buildium-webhook] Tenant delete received but not found locally',
        buildiumTenantId,
      );
      return false;
    }
    const tenantId = tenantRow.id;
    await admin.from('lease_contacts').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
    console.log('[buildium-webhook] Tenant deleted locally', tenantId);
    return true;
  }

  // Forward LeaseTransaction events to the edge function that performs the
  // full fetch + upsert of transactions/lines.
  async function forwardLeaseTransactionEvents(eventsToForward: UnknownRecord[]) {
    if (!eventsToForward.length) return;
    if (!buildiumCreds) {
      console.warn(
        '[buildium-webhook] Missing Buildium credentials; cannot forward lease transactions',
      );
      return;
    }
    const supabaseUrl = supabaseUrlEnv;
    const serviceRole = serviceRoleEnv;
    if (!supabaseUrl || !serviceRole) {
      console.warn(
        '[buildium-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; cannot forward lease transactions',
      );
      return;
    }
    try {
      // Enrich events with full transaction data (to avoid Buildium calls from edge if blocked)
      const enrichedEvents = [];
      for (const ev of eventsToForward) {
        const leaseId = ev?.LeaseId ?? ev?.Data?.LeaseId;
        const transactionId = ev?.TransactionId ?? ev?.Data?.TransactionId ?? ev?.EntityId;
        const isDelete = looksLikeDelete(ev);
        let fullTx = null;
        // Skip fetching deleted transactions; Buildium returns 404 after removal.
        if (leaseId && transactionId && !isDelete) {
          try {
            fullTx = await fetchLeaseTransaction(Number(leaseId), Number(transactionId));
          } catch (err) {
            console.error('[buildium-webhook] Error fetching transaction for enrichment', err);
          }
        }
        const cloned = { ...ev };
        cloned.Data = { ...(ev?.Data || {}), FullTransaction: fullTx };
        enrichedEvents.push(cloned);
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/buildium-lease-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Edge function expects bearer auth for service role
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          Events: enrichedEvents,
          credentials: {
            baseUrl: buildiumCreds.baseUrl,
            clientId: buildiumCreds.clientId,
            clientSecret: buildiumCreds.clientSecret,
          },
        }),
      });
      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        console.error('[buildium-webhook] Lease transaction forward failed', {
          status: res.status,
          details,
        });
      }
    } catch (err) {
      console.error('[buildium-webhook] Error forwarding lease transaction events', err);
    }
  }

  try {
    // Local helpers to upsert the transaction+lines without relying on the edge function (for cases where Buildium blocks edge IPs).
    const normalizeDate = (d?: string | null) => {
      if (!d) return null;
      const s = String(d);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      if (s.includes('T')) return s.slice(0, 10);
      return null;
    };
    const resolveLocalPropertyId = async (buildiumPropertyId?: number | null) => {
      if (!buildiumPropertyId) return null;
      const { data, error } = await admin
        .from('properties')
        .select('id')
        .eq('buildium_property_id', buildiumPropertyId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const resolveLocalUnitId = async (buildiumUnitId?: number | null) => {
      if (!buildiumUnitId) return null;
      const { data, error } = await admin
        .from('units')
        .select('id')
        .eq('buildium_unit_id', buildiumUnitId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const resolvePropertyUuidByBuildiumId = async (
      supabaseClient: typeof admin,
      buildiumPropertyId?: number | null,
    ) => {
      if (!buildiumPropertyId) return null;
      const { data, error } = await supabaseClient
        .from('properties')
        .select('id')
        .eq('buildium_property_id', buildiumPropertyId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const resolveUnitUuidByBuildiumId = async (
      supabaseClient: typeof admin,
      buildiumUnitId?: number | null,
    ) => {
      if (!buildiumUnitId) return null;
      const { data, error } = await supabaseClient
        .from('units')
        .select('id')
        .eq('buildium_unit_id', buildiumUnitId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const mapCountryFromBuildiumLocal = (country?: string | null) => {
      if (!country) return null;
      return country.replace(/([a-z])([A-Z])/g, '$1 $2');
    };
    const normalizeCountryEnum = (
      country?: string | null,
    ): Database['public']['Enums']['countries'] | null => {
      const mapped = mapCountryFromBuildiumLocal(country);
      return mapped ? (mapped as Database['public']['Enums']['countries']) : null;
    };
    const resolveLocalTenantId = async (buildiumTenantId?: number | null) => {
      if (!buildiumTenantId) return null;
      const { data, error } = await admin
        .from('tenants')
        .select('id')
        .eq('buildium_tenant_id', buildiumTenantId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const resolveLocalLeaseId = async (buildiumLeaseId?: number | null) => {
      if (!buildiumLeaseId) return null;
      const { data, error } = await admin
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', buildiumLeaseId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };
    const resolveLeaseOrgId = async (
      buildiumLeaseId?: number | null,
      buildiumPropertyId?: number | null,
      buildiumAccountId?: number | null,
    ) => {
      if (buildiumAccountId) {
        const orgFromAccount = await resolveOrgIdFromBuildiumAccount(buildiumAccountId);
        if (orgFromAccount) return orgFromAccount;
      }
      if (buildiumLeaseId) {
        const { data } = await admin
          .from('lease')
          .select('org_id')
          .eq('buildium_lease_id', buildiumLeaseId)
          .maybeSingle();
        if (data?.org_id) return data.org_id;
      }
      if (buildiumPropertyId) {
        const { data } = await admin
          .from('properties')
          .select('org_id')
          .eq('buildium_property_id', buildiumPropertyId)
          .maybeSingle();
        if (data?.org_id) return data.org_id;
      }
      return null;
    };
    const ensureGLAccountId = async (
      buildiumGLAccountId: number | null | undefined,
      fetchGL: (id: number) => Promise<UnknownRecord | null>,
    ) => {
      if (!buildiumGLAccountId) return null;
      const { data, error } = await admin
        .from('gl_accounts')
        .select('id')
        .eq('buildium_gl_account_id', buildiumGLAccountId)
        .single();
      if (!error && data?.id) return data.id;
      if (error && error.code !== 'PGRST116') throw error;
      const remote = await fetchGL(buildiumGLAccountId);
      const parsedGL = parseBuildiumGLAccountPayload(remote);
      if (!remote || !parsedGL.ok) {
        const reason = parsedGL.ok ? 'missing' : parsedGL.errors.join('; ');
        throw new Error(`Unable to resolve GL account ${buildiumGLAccountId}: ${reason}`);
      }
      const normalizedGL = parsedGL.data;
      const now = new Date().toISOString();
      const row = {
        buildium_gl_account_id: normalizedGL.Id,
        account_number: normalizedGL.AccountNumber ?? null,
        name: normalizedGL.Name,
        description: normalizedGL.Description ?? null,
        type: normalizedGL.Type,
        sub_type: normalizedGL.SubType ?? null,
        is_default_gl_account: normalizedGL.IsDefaultGLAccount ?? false,
        default_account_name: normalizedGL.DefaultAccountName ?? null,
        is_contra_account: normalizedGL.IsContraAccount ?? false,
        is_bank_account: normalizedGL.IsBankAccount ?? false,
        cash_flow_classification: normalizedGL.CashFlowClassification ?? null,
        exclude_from_cash_balances: normalizedGL.ExcludeFromCashBalances ?? false,
        is_active: normalizedGL.IsActive ?? true,
        buildium_parent_gl_account_id: normalizedGL.ParentGLAccountId ?? null,
        is_credit_card_account: normalizedGL.IsCreditCardAccount ?? false,
        is_security_deposit_liability: normalizedGL.IsSecurityDepositLiability ?? false,
        sub_accounts: null,
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error: insErr } = await admin
        .from('gl_accounts')
        .insert(row)
        .select('id')
        .single();
      if (insErr) throw insErr;
      return inserted.id;
    };
    type PaymentMethodEnum =
      | 'Cash'
      | 'Check'
      | 'MoneyOrder'
      | 'CashierCheck'
      | 'DirectDeposit'
      | 'CreditCard'
      | 'ElectronicPayment';
    const mapPaymentMethod = (pm?: string | null): PaymentMethodEnum | null => {
      if (!pm) return null;
      const v = pm.toLowerCase();
      if (v.includes('check')) return 'Check';
      if (v === 'cash') return 'Cash';
      if (v.includes('money')) return 'MoneyOrder';
      if (v.includes('cashier')) return 'CashierCheck';
      if (v.includes('ach') || v.includes('bank') || v.includes('deposit')) return 'DirectDeposit';
      if (v.includes('credit')) return 'CreditCard';
      if (v.includes('electronic') || v.includes('online') || v.includes('epayment'))
        return 'ElectronicPayment';
      return null;
    };
    const TRANSACTION_TYPE_ENUM_VALUES = [
      'Bill',
      'Charge',
      'Credit',
      'Payment',
      'JournalEntry',
      'Check',
      'Refund',
      'ApplyDeposit',
      'ElectronicFundsTransfer',
      'Other',
      'Deposit',
      'GeneralJournalEntry',
      'OwnerContribution',
      'ReversePayment',
      'ReverseElectronicFundsTransfer',
      'VendorCredit',
      'RentalApplicationFeePayment',
      'ReverseRentalApplicationFeePayment',
      'ReverseOwnerContribution',
      'VendorRefund',
      'UnreversedPayment',
      'UnreversedElectronicFundsTransfer',
      'UnreversedOwnerContribution',
      'UnreversedRentalApplicationFeePayment',
      'ReversedEftRefund',
    ] as const satisfies Database['public']['Enums']['transaction_type_enum'][];
    const normalizeTransactionType = (
      value?: string | null,
    ): Database['public']['Enums']['transaction_type_enum'] => {
      if (value) {
        const found = TRANSACTION_TYPE_ENUM_VALUES.find((v) => v === value);
        if (found) return found;
      }
      return 'Other';
    };
    const mapLeaseStatusFromBuildium = (status?: string | null) => {
      if (!status) return null;
      const s = status.toLowerCase();
      if (s === 'active') return 'Active';
      if (s === 'future') return 'Future';
      if (s === 'past') return 'Past';
      if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
      return status;
    };
    const resolveUndepositedFundsGlAccountIdLocal = async (orgId: string | null) => {
      const lookup = async (column: 'default_account_name' | 'name') => {
        let query = admin.from('gl_accounts').select('id').ilike(column, '%undeposited funds%');
        if (orgId) query = query.eq('org_id', orgId);
        const { data, error } = await query.limit(1).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return (data as { id?: string | null } | null)?.id ?? null;
      };
      const scopedDefault = await lookup('default_account_name');
      if (scopedDefault) return scopedDefault;
      const scopedName = await lookup('name');
      if (scopedName) return scopedName;

      const { data: globalDefault, error: g1 } = await admin
        .from('gl_accounts')
        .select('id')
        .ilike('default_account_name', '%undeposited funds%')
        .limit(1)
        .maybeSingle();
      if (g1 && g1.code !== 'PGRST116') throw g1;
      if (globalDefault?.id) return globalDefault.id;

      const { data: globalName, error: g2 } = await admin
        .from('gl_accounts')
        .select('id')
        .ilike('name', '%undeposited funds%')
        .limit(1)
        .maybeSingle();
      if (g2 && g2.code !== 'PGRST116') throw g2;
      if (globalName?.id) return globalName.id;

      return null;
    };
    const resolveAccountsReceivableGlAccountIdLocal = async (orgId: string | null) => {
      const lookup = async (scoped: boolean) => {
        let query = admin.from('gl_accounts').select('id').ilike('name', 'Accounts Receivable');
        if (scoped && orgId) query = query.eq('org_id', orgId);
        const { data, error } = await query.limit(1).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return (data as { id?: string | null } | null)?.id ?? null;
      };

      const scoped = orgId ? await lookup(true) : null;
      if (scoped) return scoped;
      return await lookup(false);
    };
    const upsertLeaseTransactionWithLinesLocal = async (
      leaseTx: UnknownRecord,
      fetchGL: (id: number) => Promise<UnknownRecord | null>,
      buildiumAccountId?: number | null,
    ): Promise<{ transactionId: string }> => {
      const now = new Date().toISOString();
      const leaseTxDate = normalizeDate(leaseTx.Date) ?? now.slice(0, 10);
      const paymentMethod = mapPaymentMethod(leaseTx.PaymentMethod);
      const transactionType = normalizeTransactionType(
        leaseTx.TransactionType || leaseTx.TransactionTypeEnum || null,
      );
      const orgFromAccount = await resolveOrgIdFromBuildiumAccount(
        buildiumAccountId ?? leaseTx?.AccountId ?? null,
      );
      const orgId =
        orgFromAccount ??
        (await resolveLeaseOrgId(
          leaseTx.LeaseId ?? null,
          leaseTx?.PropertyId ?? null,
          buildiumAccountId ?? leaseTx?.AccountId ?? null,
        ));
      const payeeTenantBuildiumId =
        leaseTx?.PayeeTenantId ??
        leaseTx?.PayeeTenantID ??
        (leaseTx?.Payee as UnknownRecord | undefined)?.TenantId ??
        null;
      const payeeTenantLocal = await resolveLocalTenantId(payeeTenantBuildiumId ?? null);
      const header: {
        buildium_transaction_id: number | null;
        date: string;
        transaction_type: Database['public']['Enums']['transaction_type_enum'];
        total_amount: number;
        check_number: string | null;
        buildium_lease_id: number | null;
        property_id: string | null;
        unit_id: string | null;
        org_id: string | null;
        memo: string | null;
        payment_method: Database['public']['Enums']['payment_method_enum'] | null;
        payee_tenant_id: number | null;
        bank_gl_account_id: string | null;
        bank_gl_account_buildium_id: number | null;
        updated_at: string;
      } = {
        buildium_transaction_id: leaseTx.Id,
        date: leaseTxDate,
        transaction_type: transactionType,
        total_amount:
          typeof leaseTx.TotalAmount === 'number'
            ? leaseTx.TotalAmount
            : Number(leaseTx.Amount ?? 0),
        check_number: leaseTx.CheckNumber ?? null,
        buildium_lease_id: leaseTx.LeaseId ?? null,
        property_id: null,
        unit_id: null,
        org_id: null,
        memo: leaseTx?.Journal?.Memo ?? leaseTx?.Memo ?? null,
        payment_method: paymentMethod as Database['public']['Enums']['payment_method_enum'] | null,
        payee_tenant_id: payeeTenantBuildiumId ?? null,
        bank_gl_account_id: null,
        bank_gl_account_buildium_id: null,
        updated_at: now,
      };
      const { data: existing, error: findErr } = await admin
        .from('transactions')
        .select('id')
        .eq('buildium_transaction_id', leaseTx.Id)
        .single();
      if (findErr && findErr.code !== 'PGRST116') throw findErr;
      const leaseIdLocal = await resolveLocalLeaseId(leaseTx.LeaseId ?? null);
      let leaseRow: {
        property_id?: string | null;
        unit_id?: string | null;
        buildium_property_id?: number | null;
        buildium_unit_id?: number | null;
      } | null = null;
      if (leaseIdLocal) {
        const { data } = await admin
          .from('lease')
          .select('property_id, unit_id, buildium_property_id, buildium_unit_id')
          .eq('id', leaseIdLocal)
          .maybeSingle();
        leaseRow = data ?? null;
      }
      const defaultBuildiumPropertyId = leaseRow?.buildium_property_id ?? null;
      const defaultBuildiumUnitId = leaseRow?.buildium_unit_id ?? null;
      const defaultPropertyId = leaseRow?.property_id ?? null;
      const defaultUnitId = leaseRow?.unit_id ?? null;
      const unitIdForHeader =
        defaultUnitId ??
        (defaultBuildiumUnitId ? await resolveLocalUnitId(defaultBuildiumUnitId) : null);
      const buildiumPropertyId = leaseTx?.PropertyId ?? defaultBuildiumPropertyId ?? null;
      let propertyIdForHeader = defaultPropertyId ?? null;
      if (!propertyIdForHeader && buildiumPropertyId) {
        propertyIdForHeader = await resolveLocalPropertyId(buildiumPropertyId);
      }
      if (!propertyIdForHeader && unitIdForHeader) {
        const { data: unitRow, error: unitErr } = await admin
          .from('units')
          .select('property_id')
          .eq('id', unitIdForHeader)
          .maybeSingle();
        if (unitErr && unitErr.code !== 'PGRST116') throw unitErr;
        propertyIdForHeader =
          (unitRow as { property_id?: string | null } | null)?.property_id ?? null;
      }

      // Resolve property org + bank context (for Undeposited Funds + fallback)
      let propertyBankContext: {
        operating_bank_gl_account_id?: string | null;
        deposit_trust_gl_account_id?: string | null;
        org_id?: string | null;
      } | null = null;
      if (propertyIdForHeader) {
        const { data: prop, error: perr } = await admin
          .from('properties')
          .select('operating_bank_gl_account_id, deposit_trust_gl_account_id, org_id')
          .eq('id', propertyIdForHeader)
          .maybeSingle();
        if (perr && perr.code !== 'PGRST116') throw perr;
        propertyBankContext = prop ?? null;
      }
      const orgIdForHeader = propertyBankContext?.org_id ?? orgId ?? null;
      if (!orgIdForHeader) {
        throw new Error('Unable to resolve org_id for lease transaction');
      }
      const propertyOrgId = propertyBankContext?.org_id ?? orgIdForHeader;
      header.property_id = propertyIdForHeader;
      header.unit_id = unitIdForHeader;
      header.org_id = orgIdForHeader;

      // Resolve provided bank GL (if Buildium sent it)
      const bankGlBuildiumId =
        (leaseTx?.DepositDetails as UnknownRecord | undefined)?.BankGLAccountId ?? null;
      const bankGlAccountId = bankGlBuildiumId
        ? await ensureGLAccountId(bankGlBuildiumId, fetchGL)
        : null;

      // Choose final bank GL with precedence: provided bank GL -> org-scoped Undeposited Funds -> property bank fallback
      let bankGlAccountIdToUse: string | null = bankGlAccountId ?? null;
      const txType = String(header.transaction_type || '').toLowerCase();
      const isPaymentTransaction = txType === 'payment';
      const isApplyDepositTransaction = txType === 'applydeposit';
      const isBillPaymentTransaction = txType.includes('billpayment');
      const isOwnerDrawTransaction = txType.includes('owner');
      const isVendorPayment =
        isPaymentTransaction &&
        !(leaseTx?.LeaseId || leaseIdLocal) &&
        !(leaseTx?.Unit?.Id || leaseTx?.UnitId);
      const isInflow = (isPaymentTransaction && !isVendorPayment) || isApplyDepositTransaction;
      const isOutflow = isBillPaymentTransaction || isOwnerDrawTransaction || isVendorPayment;
      const needsBankAccountLine = isInflow || isOutflow;

      if (needsBankAccountLine && !bankGlAccountIdToUse) {
        bankGlAccountIdToUse = await resolveUndepositedFundsGlAccountIdLocal(propertyOrgId);
      }
      if (needsBankAccountLine && !bankGlAccountIdToUse && propertyBankContext) {
        bankGlAccountIdToUse =
          propertyBankContext?.operating_bank_gl_account_id ??
          propertyBankContext?.deposit_trust_gl_account_id ??
          null;
      }

      header.bank_gl_account_id = bankGlAccountIdToUse ?? bankGlAccountId ?? null;
      header.bank_gl_account_buildium_id = bankGlBuildiumId ?? null;

      let transactionId: string;
      if (existing?.id) {
        const { data, error } = await admin
          .from('transactions')
          .update({
            ...header,
            lease_id: leaseIdLocal,
            org_id: orgIdForHeader,
            tenant_id: payeeTenantLocal,
          })
          .eq('id', existing.id)
          .select('id')
          .single();
        if (error) throw error;
        transactionId = data.id;
      } else {
        const { data, error } = await admin
          .from('transactions')
          .insert({
            ...header,
            lease_id: leaseIdLocal,
            org_id: orgIdForHeader,
            tenant_id: payeeTenantLocal,
            created_at: now,
          })
          .select('id')
          .single();
        if (error) throw error;
        transactionId = data.id;
      }

      await admin.from('transaction_lines').delete().eq('transaction_id', transactionId);
      const lines = Array.isArray(leaseTx?.Journal?.Lines)
        ? leaseTx.Journal.Lines
        : Array.isArray(leaseTx?.Lines)
          ? leaseTx.Lines
          : [];
      let debit = 0,
        credit = 0;
      const pendingLines: TablesInsert<'transaction_lines'>[] = [];
      const glAccountBankFlags = new Map<string, boolean>();
      const glAccountMeta = new Map<
        string,
        { name: string | null; type: string | null; subType: string | null }
      >();

      const loadGlAccountMeta = async (glAccountId: string) => {
        if (glAccountBankFlags.has(glAccountId) && glAccountMeta.has(glAccountId))
          return glAccountBankFlags.get(glAccountId) === true;
        const { data: glRow, error: glErr } = await admin
          .from('gl_accounts')
          .select('is_bank_account, name, type, sub_type')
          .eq('id', glAccountId)
          .maybeSingle();
        if (glErr && glErr.code !== 'PGRST116') throw glErr;
        const gl = glRow as {
          is_bank_account?: boolean | null;
          name?: string | null;
          type?: string | null;
          sub_type?: string | null;
        } | null;
        const isBank = Boolean(gl?.is_bank_account);
        glAccountBankFlags.set(glAccountId, isBank);
        glAccountMeta.set(glAccountId, {
          name: gl?.name ?? null,
          type: gl?.type ?? null,
          subType: gl?.sub_type ?? null,
        });
        return isBank;
      };

      for (const line of lines) {
        const amountAbs = Math.abs(Number(line?.Amount ?? 0));
        const posting = resolvePostingType(line);
        const glBuildiumId =
          typeof line?.GLAccount === 'number'
            ? line?.GLAccount
            : (line?.GLAccount?.Id ?? line?.GLAccountId ?? null);
        const glId = await ensureGLAccountId(glBuildiumId, fetchGL);
        if (!glId) throw new Error(`GL account not found for line. BuildiumId=${glBuildiumId}`);
        await loadGlAccountMeta(glId);
        const buildiumPropertyId = line?.PropertyId ?? defaultBuildiumPropertyId ?? null;
        const buildiumUnitId = line?.Unit?.Id ?? line?.UnitId ?? defaultBuildiumUnitId ?? null;
        const propertyIdLocal =
          (await resolveLocalPropertyId(buildiumPropertyId)) ??
          propertyIdForHeader ??
          defaultPropertyId ??
          null;
        const unitIdLocal =
          (await resolveLocalUnitId(buildiumUnitId)) ?? unitIdForHeader ?? defaultUnitId ?? null;
        pendingLines.push({
          transaction_id: transactionId,
          gl_account_id: glId,
          amount: amountAbs,
          posting_type: posting,
          memo: line?.Memo ?? null,
          account_entity_type: 'Rental',
          account_entity_id: buildiumPropertyId ?? defaultBuildiumPropertyId ?? null,
          date: leaseTxDate,
          created_at: now,
          updated_at: now,
          buildium_property_id: buildiumPropertyId ?? defaultBuildiumPropertyId ?? null,
          buildium_unit_id: buildiumUnitId ?? defaultBuildiumUnitId ?? null,
          buildium_lease_id: leaseTx.LeaseId ?? null,
          property_id: propertyIdLocal,
          unit_id: unitIdLocal,
        });
        if (posting === 'Debit') debit += amountAbs;
        else credit += amountAbs;
      }

      // Insert balancing bank/Undeposited Funds debit line only when Buildium did not provide one
      const hasBankAccountLine = Array.from(glAccountBankFlags.values()).some((v) => v === true);
      const hasProvidedBankLine = bankGlAccountId
        ? pendingLines.some((l) => l.gl_account_id === bankGlAccountId)
        : false;
      const hasBankLikeLine = hasBankAccountLine || hasProvidedBankLine;
      const bankAmountNeeded = debit > credit ? debit : credit;
      const bankPosting = credit >= debit ? 'Debit' : 'Credit';

      if (
        needsBankAccountLine &&
        !hasBankLikeLine &&
        bankGlAccountIdToUse &&
        bankAmountNeeded > 0
      ) {
        pendingLines.push({
          transaction_id: transactionId,
          gl_account_id: bankGlAccountIdToUse,
          amount: bankAmountNeeded,
          posting_type: bankPosting,
          memo: leaseTx?.Memo ?? header.memo ?? null,
          account_entity_type: 'Rental',
          account_entity_id: defaultBuildiumPropertyId,
          date: leaseTxDate,
          created_at: now,
          updated_at: now,
          buildium_property_id: defaultBuildiumPropertyId,
          buildium_unit_id: defaultBuildiumUnitId,
          buildium_lease_id: leaseTx.LeaseId ?? null,
          property_id: propertyIdForHeader ?? defaultPropertyId,
          unit_id: unitIdForHeader ?? defaultUnitId,
        });
        if (bankPosting === 'Debit') debit += bankAmountNeeded;
        else credit += bankAmountNeeded;
      }

      const isChargeTransaction =
        String(header.transaction_type || '').toLowerCase() === 'charge' ||
        String(leaseTx?.TransactionType || leaseTx?.TransactionTypeEnum || '').toLowerCase() ===
          'charge';
      const hasAccountsReceivableLine = Array.from(glAccountMeta.values()).some((meta) => {
        const type = (meta.type || '').toLowerCase();
        const name = (meta.name || '').toLowerCase();
        const normalizedSubType = (meta.subType || '').toLowerCase().replace(/[\s_-]+/g, '');
        return (
          type === 'asset' &&
          (name.includes('receivable') || normalizedSubType.includes('accountsreceivable'))
        );
      });

      if (isChargeTransaction && !hasAccountsReceivableLine && credit > debit) {
        const arGlAccountId = await resolveAccountsReceivableGlAccountIdLocal(propertyOrgId);
        const arAmount = credit - debit;
        if (arGlAccountId && arAmount > 0) {
          pendingLines.push({
            transaction_id: transactionId,
            gl_account_id: arGlAccountId,
            amount: arAmount,
            posting_type: 'Debit',
            memo: leaseTx?.Memo ?? header.memo ?? null,
            account_entity_type: 'Rental',
            account_entity_id: defaultBuildiumPropertyId,
            date: leaseTxDate,
            created_at: now,
            updated_at: now,
            buildium_property_id: defaultBuildiumPropertyId,
            buildium_unit_id: defaultBuildiumUnitId,
            buildium_lease_id: leaseTx.LeaseId ?? null,
            property_id: propertyIdForHeader,
            unit_id: unitIdForHeader,
          });
          debit += arAmount;
        }
      }

      if (pendingLines.length) {
        const { error: lineErr } = await admin.from('transaction_lines').insert(pendingLines);
        if (lineErr) throw lineErr;
      }

      if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
        throw new Error(
          `Double-entry integrity violation: debits (${debit}) != credits (${credit})`,
        );
      }

      return { transactionId };
    };

    const mapLeaseFromBuildiumLocal = async (
      lease: BuildiumLease,
      buildiumAccountId?: number | null,
    ): Promise<TablesInsert<'lease'>> => {
      const propertyUuid = await resolvePropertyUuidByBuildiumId(admin, lease.PropertyId);
      const unitUuid = await resolveUnitUuidByBuildiumId(admin, lease.UnitId);
      const orgIdFromAccount = await resolveOrgIdFromBuildiumAccount(
        buildiumAccountId ?? lease?.AccountId ?? null,
      );
      const orgId: string | null =
        orgIdFromAccount ||
        (await (async () => {
          if (propertyUuid) {
            const { data: prop } = await admin
              .from('properties')
              .select('org_id')
              .eq('id', propertyUuid)
              .maybeSingle();
            return prop?.org_id ?? null;
          }
          return null;
        })());
      const leaseFromDate =
        normalizeDate(lease.LeaseFromDate) ??
        lease.LeaseFromDate ??
        new Date().toISOString().slice(0, 10);
      const leaseToDate = normalizeDate(lease.LeaseToDate) ?? lease.LeaseToDate ?? null;
      const status = mapLeaseStatusFromBuildium(lease.LeaseStatus) ?? 'Active';
      return {
        buildium_lease_id: lease.Id,
        buildium_property_id: lease.PropertyId ?? null,
        buildium_unit_id: lease.UnitId ?? null,
        unit_number: lease.UnitNumber ?? null,
        lease_from_date: leaseFromDate,
        lease_to_date: leaseToDate,
        lease_type: lease.LeaseType ?? null,
        status,
        is_eviction_pending:
          typeof lease.IsEvictionPending === 'boolean' ? lease.IsEvictionPending : null,
        term_type: lease.TermType ?? null,
        renewal_offer_status: lease.RenewalOfferStatus ?? null,
        current_number_of_occupants: lease.CurrentNumberOfOccupants ?? null,
        security_deposit: lease.AccountDetails?.SecurityDeposit ?? null,
        rent_amount: lease.AccountDetails?.Rent ?? null,
        automatically_move_out_tenants:
          typeof lease.AutomaticallyMoveOutTenants === 'boolean'
            ? lease.AutomaticallyMoveOutTenants
            : null,
        buildium_created_at: lease.CreatedDateTime ?? null,
        buildium_updated_at: lease.LastUpdatedDateTime ?? null,
        payment_due_day: lease.PaymentDueDay ?? null,
        property_id: propertyUuid ?? '',
        unit_id: unitUuid ?? '',
        org_id: orgId,
        updated_at: new Date().toISOString(),
      };
    };

    const upsertLeaseFromBuildiumLocal = async (lease: BuildiumLease) => {
      const mapped = await mapLeaseFromBuildiumLocal(lease, lease?.AccountId ?? null);
      if (!mapped.property_id || !mapped.unit_id) {
        throw new Error(
          `Missing local property/unit for Buildium lease ${lease.Id}. Sync properties/units first.`,
        );
      }
      const { data: existing, error: findErr } = await admin
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', lease.Id)
        .single();
      if (findErr && findErr.code !== 'PGRST116') throw findErr;
      if (existing?.id) {
        const { data, error } = await admin
          .from('lease')
          .update(mapped as TablesUpdate<'lease'>)
          .eq('id', existing.id)
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      } else {
        const toInsert: TablesInsert<'lease'> = { ...mapped, created_at: new Date().toISOString() };
        const { data, error } = await admin.from('lease').insert(toInsert).select('id').single();
        if (error) throw error;
        return data.id;
      }
    };

    const findOrCreateContactForLeasePerson = async (
      person: BuildiumLeasePerson,
      _orgId: string | null,
      preferredContactId?: number | null,
    ) => {
      // If caller supplies the contact_id from the tenant record, use it first.
      if (preferredContactId) {
        const { data } = await admin
          .from('contacts')
          .select('id')
          .eq('id', preferredContactId)
          .maybeSingle();
        if (data?.id) return data.id;
      }
      if (person?.Email) {
        const { data } = await admin
          .from('contacts')
          .select('id')
          .eq('primary_email', person.Email)
          .maybeSingle();
        if (data?.id) return data.id;
      }
      const now = new Date().toISOString();
      const phoneArray = Array.isArray(person?.PhoneNumbers)
        ? (person.PhoneNumbers as Array<{ Type?: string; Number?: string | null }>)
        : null;
      const phoneObject = phoneArray
        ? null
        : ((person?.PhoneNumbers as {
            Mobile?: string | null;
            Home?: string | null;
            Work?: string | null;
          }) ?? null);
      const primaryPhone = phoneArray
        ? phoneArray.find((p) => /cell|mobile/i.test(p?.Type || ''))?.Number ||
          phoneArray.find((p) => /home/i.test(p?.Type || ''))?.Number ||
          phoneArray.find((p) => /work/i.test(p?.Type || ''))?.Number ||
          null
        : phoneObject?.Mobile || phoneObject?.Home || phoneObject?.Work || null;
      const altPhone = phoneArray
        ? phoneArray.find((p) => /work/i.test(p?.Type || ''))?.Number ||
          phoneArray.find((p) => /home/i.test(p?.Type || ''))?.Number ||
          null
        : phoneObject?.Work || phoneObject?.Home || null;
      const addr = asRecord((person as UnknownRecord)?.Address ?? person?.PrimaryAddress ?? {});
      const altAddr = asRecord(
        (person as UnknownRecord)?.AlternateAddress ?? person?.AlternateAddress ?? {},
      );
      const contactPayload: TablesInsert<'contacts'> = {
        is_company: false,
        first_name: person?.FirstName ?? null,
        last_name: person?.LastName ?? null,
        primary_email: person?.Email ?? null,
        alt_email: person?.AlternateEmail ?? null,
        primary_phone: primaryPhone,
        alt_phone: altPhone,
        date_of_birth: person?.DateOfBirth ?? null,
        primary_address_line_1: (addr as { AddressLine1?: string })?.AddressLine1 ?? null,
        primary_address_line_2: (addr as { AddressLine2?: string })?.AddressLine2 ?? null,
        primary_address_line_3: (addr as { AddressLine3?: string })?.AddressLine3 ?? null,
        primary_city: (addr as { City?: string })?.City ?? null,
        primary_state: (addr as { State?: string })?.State ?? null,
        primary_postal_code: (addr as { PostalCode?: string })?.PostalCode ?? null,
        primary_country: normalizeCountryEnum(
          (addr as { Country?: string | null })?.Country ?? null,
        ),
        alt_address_line_1: (altAddr as { AddressLine1?: string })?.AddressLine1 ?? null,
        alt_address_line_2: (altAddr as { AddressLine2?: string })?.AddressLine2 ?? null,
        alt_address_line_3: (altAddr as { AddressLine3?: string })?.AddressLine3 ?? null,
        alt_city: (altAddr as { City?: string })?.City ?? null,
        alt_state: (altAddr as { State?: string })?.State ?? null,
        alt_postal_code: (altAddr as { PostalCode?: string })?.PostalCode ?? null,
        alt_country: normalizeCountryEnum(
          (altAddr as { Country?: string | null })?.Country ?? null,
        ),
        mailing_preference:
          person?.MailingPreference === 'PrimaryAddress'
            ? 'primary'
            : person?.MailingPreference === 'AlternateAddress'
              ? 'alternate'
              : null,
        display_name:
          [person?.FirstName, person?.LastName].filter(Boolean).join(' ') ||
          person?.Email ||
          'Tenant',
        created_at: now,
        updated_at: now,
        buildium_contact_id: person?.Id ?? null,
        company_name: person?.CompanyName ?? null,
      };
      const { data, error } = await admin
        .from('contacts')
        .insert(contactPayload)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    };

    const findOrCreateTenantFromContact = async (
      contactId: number,
      person: BuildiumLeasePerson,
      orgId: string | null,
    ) => {
      const { data: existing } = await admin
        .from('tenants')
        .select('id, buildium_tenant_id, org_id')
        .eq('contact_id', contactId)
        .maybeSingle();
      const incomingBuildiumId = Number(person?.Id) || null;
      if (existing?.id) {
        if (incomingBuildiumId && existing.buildium_tenant_id !== incomingBuildiumId) {
          await admin
            .from('tenants')
            .update({
              buildium_tenant_id: incomingBuildiumId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        }
        if (!existing.org_id && orgId) {
          await admin
            .from('tenants')
            .update({ org_id: orgId, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
        return existing.id;
      }
      const now = new Date().toISOString();
      const tenantPayload: TablesInsert<'tenants'> = {
        contact_id: contactId,
        comment: person?.Comment ?? null,
        tax_id: person?.TaxId ?? null,
        sms_opt_in_status:
          typeof person?.SMSOptInStatus === 'boolean' ? person.SMSOptInStatus : null,
        emergency_contact_name: person?.EmergencyContact?.Name ?? null,
        emergency_contact_relationship: person?.EmergencyContact?.RelationshipDescription ?? null,
        emergency_contact_phone: person?.EmergencyContact?.Phone ?? null,
        emergency_contact_email: person?.EmergencyContact?.Email ?? null,
        created_at: now,
        updated_at: now,
        buildium_tenant_id: Number(person?.Id) || null,
        org_id: orgId,
      };
      const { data, error } = await admin
        .from('tenants')
        .insert(tenantPayload)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    };

    const ensureLeaseContactLocal = async (
      leaseId: number,
      tenantId: string,
      role: Database['public']['Enums']['lease_contact_role_enum'],
      orgId?: string | null,
    ) => {
      const { data: existing } = await admin
        .from('lease_contacts')
        .select('id, status')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .eq('role', role)
        .maybeSingle();
      const now = new Date().toISOString();
      if (existing?.id) {
        if (existing.status !== 'Active') {
          await admin
            .from('lease_contacts')
            .update({ status: 'Active', updated_at: now } as TablesUpdate<'lease_contacts'>)
            .eq('id', existing.id);
        }
        return;
      }
      const leaseContactPayload: TablesInsert<'lease_contacts'> = {
        lease_id: leaseId,
        tenant_id: tenantId,
        role,
        status: 'Active',
        created_at: now,
        updated_at: now,
        org_id: orgId ?? null,
      };
      await admin.from('lease_contacts').insert(leaseContactPayload);
    };

    const upsertLeaseWithPartiesLocal = async (
      lease: BuildiumLease,
      buildiumAccountId?: number | null,
    ) => {
      const resolvedAccountId = buildiumAccountId ?? lease?.AccountId ?? null;
      const leaseWithAccount =
        resolvedAccountId && !lease?.AccountId ? { ...lease, AccountId: resolvedAccountId } : lease;
      const leaseIdLocal = await upsertLeaseFromBuildiumLocal(leaseWithAccount);
      const propertyUuid = await resolvePropertyUuidByBuildiumId(admin, lease.PropertyId);
      let orgId: string | null = null;
      if (propertyUuid) {
        const { data: prop } = await admin
          .from('properties')
          .select('org_id')
          .eq('id', propertyUuid)
          .maybeSingle();
        orgId = prop?.org_id ?? null;
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[buildium-webhook] upserting lease parties', {
          leaseId: lease.Id,
          tenantsCount: Array.isArray(lease?.Tenants) ? lease.Tenants.length : 0,
          cosignersCount: Array.isArray(lease?.Cosigners) ? lease.Cosigners.length : 0,
        });
      }
      // Tenants
      for (const t of Array.isArray(lease?.Tenants) ? lease.Tenants : []) {
        try {
          const contactId = await findOrCreateContactForLeasePerson(t, orgId);
          const tenantId = await findOrCreateTenantFromContact(contactId, t, orgId);
          await ensureLeaseContactLocal(leaseIdLocal, tenantId, 'Tenant', orgId);
        } catch (err) {
          console.warn('[buildium-webhook] Skipping tenant on lease upsert', err);
        }
      }
      // Cosigners
      for (const c of Array.isArray(lease?.Cosigners) ? lease.Cosigners : []) {
        try {
          const contactId = await findOrCreateContactForLeasePerson(c, orgId);
          const tenantId = await findOrCreateTenantFromContact(contactId, c, orgId);
          await ensureLeaseContactLocal(leaseIdLocal, tenantId, 'Guarantor', orgId);
        } catch (err) {
          console.warn('[buildium-webhook] Skipping cosigner on lease upsert', err);
        }
      }
      return leaseIdLocal;
    };

    const resolveLocalLeaseIdStrict = async (buildiumLeaseId?: number | null) => {
      if (!buildiumLeaseId) return null;
      const { data, error } = await admin
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', buildiumLeaseId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    };

    const updateLeaseContactStatuses = async (
      buildiumLeaseId: number,
      currentBuildiumTenantIds: Set<number>,
    ) => {
      const leaseLocalId = await resolveLocalLeaseIdStrict(buildiumLeaseId);
      if (!leaseLocalId) return;
      const { data: rels, error } = await admin
        .from('lease_contacts')
        .select('id, tenant_id, status')
        .eq('lease_id', leaseLocalId);
      if (error) throw error;
      if (!rels || rels.length === 0) return;
      const tenantIds = rels.map((r) => r.tenant_id).filter(Boolean);
      if (!tenantIds.length) return;
      const { data: tenants, error: terr } = await admin
        .from('tenants')
        .select('id, buildium_tenant_id')
        .in('id', tenantIds);
      if (terr) throw terr;
      const buildiumMap = new Map((tenants || []).map((t) => [t.id, t.buildium_tenant_id]));
      const toActivate: string[] = [];
      const toDeactivate: string[] = [];
      for (const r of rels) {
        const buildiumId = buildiumMap.get(r.tenant_id);
        if (buildiumId && currentBuildiumTenantIds.has(Number(buildiumId))) {
          if (r.status !== 'Active') toActivate.push(r.id);
        } else {
          if (r.status !== 'Past') toDeactivate.push(r.id);
        }
      }
      if (toActivate.length)
        await admin
          .from('lease_contacts')
          .update({ status: 'Active', updated_at: new Date().toISOString() })
          .in('id', toActivate);
      if (toDeactivate.length)
        await admin
          .from('lease_contacts')
          .update({ status: 'Past', updated_at: new Date().toISOString() })
          .in('id', toDeactivate);
    };

    const upsertBillPaymentWithLines = async (
      payment: UnknownRecord,
      billId: number,
      fetchGL: (id: number) => Promise<UnknownRecord | null>,
      buildiumAccountId?: number | null,
    ) => {
      const now = new Date().toISOString();
      const paymentId = firstNumber(payment?.Id, payment?.PaymentId);
      const totalFromLines = Array.isArray(payment?.Lines)
        ? payment.Lines.reduce(
            (sum: number, line: UnknownRecord) => sum + Number(line?.Amount ?? 0),
            0,
          )
        : 0;
      const headerDate = normalizeDate(payment?.EntryDate ?? payment?.Date ?? null);
      const paymentMethod =
        mapPaymentMethod(payment?.PaymentMethod) || (payment?.CheckNumber ? 'Check' : null);

      // Resolve local bank account + GL (prefer the Buildium BankAccountId provided by the payment payload)
      const bankAccountId = firstNumber(
        payment?.BankAccountId,
        (payment as UnknownRecord)?.BankAccountID,
        (payment?.BankAccount as UnknownRecord | undefined)?.Id,
      );

      let bankGlAccountId = await resolveBankGlAccountId(bankAccountId, admin);
      if (bankAccountId && bankGlAccountId) {
        // Sanity-check the resolved GL account to ensure it matches the Buildium BankAccountId.
        const { data: resolvedGl } = await admin
          .from('gl_accounts')
          .select('id, buildium_gl_account_id')
          .eq('id', bankGlAccountId)
          .maybeSingle();

        const resolvedBuildiumId =
          (resolvedGl as { buildium_gl_account_id?: number | null } | null)
            ?.buildium_gl_account_id ?? null;
        if (resolvedBuildiumId == null || Number(resolvedBuildiumId) !== bankAccountId) {
          const { data: exactBankGl } = await admin
            .from('gl_accounts')
            .select('id')
            .eq('buildium_gl_account_id', bankAccountId)
            .maybeSingle();
          if (exactBankGl?.id) {
            bankGlAccountId = exactBankGl.id;
          }
        }
      }

      if (!bankGlAccountId) {
        throw new Error(
          `Missing bank GL account for bill payment ${paymentId ?? ''} (BankAccountId=${bankAccountId ?? 'null'})`,
        );
      }

      // Pick vendor/category from existing bill transaction if present
      const { data: billTxMeta } = await admin
        .from('transactions')
        .select('id, vendor_id, category_id, org_id')
        .eq('buildium_bill_id', billId)
        .eq('transaction_type', 'Bill')
        .maybeSingle();

      let apGlAccountId: string | null = null;
      if (billTxMeta?.id) {
        const { data: billLines, error: billLinesErr } = await admin
          .from('transaction_lines')
          .select('gl_account_id, posting_type, gl_accounts(type)')
          .eq('transaction_id', billTxMeta.id)
          .limit(10);
        if (billLinesErr) {
          console.error('Failed to load bill lines for AP resolution', billLinesErr);
        } else if (billLines?.length) {
          const apLine = billLines.find(
            (line) =>
              String(line?.posting_type || '').toLowerCase() === 'credit' &&
              String(
                (line as { gl_accounts?: { type?: string } } | null)?.gl_accounts?.type || '',
              ).toLowerCase() === 'liability',
          );
          apGlAccountId =
            (apLine as { gl_account_id?: string | null } | null)?.gl_account_id ?? null;
        }
      }

      // Find existing payment transaction by buildium_transaction_id
      let existing: { id: string; created_at: string } | null = null;
      if (paymentId != null) {
        const { data, error } = await admin
          .from('transactions')
          .select('id, created_at')
          .eq('buildium_transaction_id', paymentId)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        existing = data ?? null;
      }

      let debitSum = 0;
      let creditSum = 0;
      const orgFromAccount = await resolveOrgIdFromBuildiumAccount(
        buildiumAccountId ?? payment?.AccountId ?? null,
      );
      // Build lines from payment lines (debits), plus balancing credit to bank
      const pendingLines: Array<
        Omit<
          {
            transaction_id: string;
            gl_account_id: string;
            amount: number;
            posting_type: string;
            memo: string | null;
            account_entity_type: 'Rental' | 'Company';
            account_entity_id: number | null;
            date: string;
            created_at: string;
            updated_at: string;
            buildium_property_id: number | null;
            buildium_unit_id: number | null;
            buildium_lease_id: null;
            property_id: string | null;
            unit_id: string | null;
          },
          'transaction_id'
        >
      > = [];
      const paymentLines = Array.isArray(payment?.Lines) ? payment.Lines : [];
      const lineDate = headerDate ?? new Date().toISOString().slice(0, 10);
      for (const line of paymentLines) {
        const glBuildiumId = line?.GLAccountId ?? line?.GLAccount?.Id ?? null;
        const glId = apGlAccountId ?? (await ensureGLAccountId(glBuildiumId, fetchGL));
        if (!glId)
          throw new Error(`GL account not found for bill payment line. BuildiumId=${glBuildiumId}`);
        const buildiumPropertyId = line?.AccountingEntity?.Id ?? null;
        const buildiumUnitId =
          line?.AccountingEntity?.UnitId ?? line?.AccountingEntity?.Unit?.Id ?? null;
        const propertyIdLocal = await resolveLocalPropertyId(buildiumPropertyId);
        const unitIdLocal = await resolveLocalUnitId(buildiumUnitId);
        const entityTypeRaw = line?.AccountingEntity?.AccountingEntityType || 'Rental';
        const entityType: 'Rental' | 'Company' =
          String(entityTypeRaw).toLowerCase() === 'rental' ? 'Rental' : 'Company';
        const amount = Math.abs(Number(line?.Amount ?? 0));
        // Buildium bill payment lines do not include PostingType; treat them as debits against the bill/AP.
        const posting =
          line?.PostingType ||
          line?.posting_type ||
          line?.PostingTypeEnum ||
          line?.PostingTypeString
            ? resolvePostingType(line)
            : ('Debit' as const);
        if (posting === 'Debit') debitSum += amount;
        else creditSum += amount;
        pendingLines.push({
          gl_account_id: glId,
          amount,
          posting_type: posting,
          memo: line?.Memo ?? null,
          account_entity_type: entityType,
          account_entity_id: buildiumPropertyId,
          date: lineDate,
          created_at: now,
          updated_at: now,
          buildium_property_id: buildiumPropertyId,
          buildium_unit_id: buildiumUnitId,
          buildium_lease_id: null,
          property_id: propertyIdLocal,
          unit_id: unitIdLocal,
        });
      }

      let totalAmount =
        totalFromLines || Number(payment?.Amount ?? 0) || debitSum || creditSum || 0;
      if (!Number.isFinite(totalAmount) || totalAmount === 0) {
        totalAmount = debitSum || creditSum || 0;
      }
      totalAmount = Math.abs(totalAmount);

      const transactionDate = lineDate || now.slice(0, 10);
      const paymentMethodNormalized = paymentMethod as
        | Database['public']['Enums']['payment_method_enum']
        | null;
      const orgId = orgFromAccount ?? billTxMeta?.org_id;
      if (!orgId) {
        throw new Error(
          `Unable to resolve org for bill payment ${paymentId ?? ''} (buildium account ${buildiumAccountId ?? 'unknown'})`,
        );
      }
      const header: TablesInsert<'transactions'> = {
        buildium_transaction_id: paymentId ?? null,
        buildium_bill_id: billId,
        bill_transaction_id: billTxMeta?.id ?? null,
        date: transactionDate,
        paid_date: headerDate,
        total_amount: totalAmount,
        check_number: safeString(payment?.CheckNumber),
        reference_number: safeString(payment?.Memo ?? payment?.ReferenceNumber),
        memo: safeString(payment?.Memo),
        transaction_type: 'Payment',
        status: 'Paid',
        bank_gl_account_id: bankGlAccountId ?? null,
        bank_gl_account_buildium_id: bankAccountId ?? null,
        vendor_id: billTxMeta?.vendor_id ?? null,
        category_id: billTxMeta?.category_id ?? null,
        org_id: orgId,
        payment_method: paymentMethodNormalized,
        updated_at: now,
      };

      let transactionId: string;
      if (existing) {
        const { data, error } = await admin
          .from('transactions')
          .update(header as TablesUpdate<'transactions'>)
          .eq('id', existing.id)
          .select('id')
          .single();
        if (error) throw error;
        transactionId = data.id;
      } else {
        const insertPayload: TablesInsert<'transactions'> = { ...header, created_at: now };
        const { data, error } = await admin
          .from('transactions')
          .insert(insertPayload)
          .select('id')
          .single();
        if (error) throw error;
        transactionId = data.id;
      }

      if (totalAmount > 0) {
        creditSum += totalAmount;
        // Use property/unit from first debit line for context if present
        const sample = pendingLines[0];
        pendingLines.push({
          gl_account_id: bankGlAccountId,
          amount: totalAmount,
          posting_type: 'Credit',
          memo: payment?.Memo ?? null,
          account_entity_type: sample?.account_entity_type ?? 'Company',
          account_entity_id: sample?.account_entity_id ?? null,
          date: transactionDate,
          created_at: now,
          updated_at: now,
          buildium_property_id: sample?.buildium_property_id ?? null,
          buildium_unit_id: sample?.buildium_unit_id ?? null,
          buildium_lease_id: null,
          property_id: sample?.property_id ?? null,
          unit_id: sample?.unit_id ?? null,
        });
      }

      // Replace existing lines
      await admin.from('transaction_lines').delete().eq('transaction_id', transactionId);
      if (pendingLines.length) {
        const linesWithTransactionId = pendingLines.map((line) => ({
          ...line,
          transaction_id: transactionId,
        }));
        await admin.from('transaction_lines').insert(linesWithTransactionId);
      }
      if (debitSum > 0 && creditSum > 0 && Math.abs(debitSum - creditSum) > 0.0001) {
        throw new Error(
          `Double-entry integrity violation on bill payment ${paymentId}: debits (${debitSum}) != credits (${creditSum})`,
        );
      }
      return { transactionId };
    };

    for (const event of events) {
      const type =
        firstString(
          event?.EventType,
          event?.EventName,
          body?.type,
          body?.eventType,
          body?.EventName,
        ) ?? 'unknown';
      const looksDelete = looksLikeDelete(event);
      const validation = validateBuildiumEvent(event);
      if (!validation.ok) {
        console.warn('[buildium-webhook] payload validation failed', {
          eventName: validation.eventName,
          errors: validation.errors,
        });
        await deadLetterBuildiumEvent(admin, event, validation.errors, {
          webhookType: 'app-buildium-webhook',
          signature: signatureHeader,
        });
        await sendPagerDutyEvent({
          summary: 'Buildium webhook payload validation failed',
          severity: 'warning',
          customDetails: { eventName: validation.eventName, errors: validation.errors },
        });
        results.push({ eventId: null, status: 'invalid', error: 'invalid-payload' });
        continue;
      }

      const storeResult = await insertBuildiumWebhookEventRecord(admin, event, {
        webhookType: 'app-buildium-webhook',
        signature: signatureHeader,
      });

      if (storeResult.status === 'invalid') {
        console.warn('[buildium-webhook] normalization failed', { errors: storeResult.errors });
        results.push({ eventId: null, status: 'invalid', error: 'invalid-normalization' });
        continue;
      }

      const normalized = storeResult.normalized;
      storedEvents.push(normalized);
      const eventKey = {
        buildiumWebhookId: normalized.buildiumWebhookId,
        eventName: normalized.eventName,
        eventCreatedAt: normalized.eventCreatedAt,
      };

      if (storeResult.status === 'duplicate') {
        // Normally we skip duplicates. However, BankAccount.Transaction.Created previously flowed through
        // the Next.js handler (placeholder "processed") without creating ledger transactions. If we see a
        // duplicate for that event but the deposit transaction is missing, forward to the edge processor
        // as a repair path (edge handler is idempotent by buildium_transaction_id).
        if (normalized.eventName === 'BankAccount.Transaction.Created') {
          const txIdNum = firstNumber(event?.TransactionId, event?.Data?.TransactionId);
          if (Number.isFinite(txIdNum) && Number(txIdNum) > 0) {
            const { data: existingTx } = await admin
              .from('transactions')
              .select('id')
              .eq('buildium_transaction_id', txIdNum as number)
              .maybeSingle();

            if (!existingTx?.id) {
              try {
                const forwardResult = await forwardBankTransactionToEdge(event, webhookSecretToUse);
                if (!forwardResult.ok) {
                  await markWebhookError(
                    admin,
                    eventKey,
                    `edge-forward-failed:${forwardResult.status}:${String(forwardResult.body).slice(0, 220)}`,
                  );
                  results.push({
                    eventId: normalized.buildiumWebhookId,
                    status: 'error',
                    error: 'edge-forward-failed',
                    edgeStatus: forwardResult.status,
                    edgeBodyPreview: String(forwardResult.body).slice(0, 220),
                  });
                  continue;
                }
              } catch (err) {
                await markWebhookError(
                  admin,
                  eventKey,
                  `edge-forward-exception:${(err as Error)?.message || 'unknown'}`,
                );
                results.push({
                  eventId: normalized.buildiumWebhookId,
                  status: 'error',
                  error: 'edge-forward-exception',
                });
                continue;
              }

              results.push({
                eventId: normalized.buildiumWebhookId,
                status: 'processed',
                forwarded: 'edge',
                repaired: true,
              });
              continue;
            }
          }
        } else if (normalized.eventName === 'BankAccount.Transaction.Updated') {
          // Always forward duplicate updates to the edge function so the existing deposit is refreshed.
          try {
            const forwardResult = await forwardBankTransactionToEdge(event, webhookSecretToUse);
            if (!forwardResult.ok) {
              await markWebhookError(
                admin,
                eventKey,
                `edge-forward-failed:${forwardResult.status}:${String(forwardResult.body).slice(0, 220)}`,
              );
              results.push({
                eventId: normalized.buildiumWebhookId,
                status: 'error',
                error: 'edge-forward-failed',
                edgeStatus: forwardResult.status,
                edgeBodyPreview: String(forwardResult.body).slice(0, 220),
              });
              continue;
            }
            results.push({
              eventId: normalized.buildiumWebhookId,
              status: 'processed',
              forwarded: 'edge',
              reprocessed: true,
            });
            continue;
          } catch (err) {
            await markWebhookError(
              admin,
              eventKey,
              `edge-forward-exception:${(err as Error)?.message || 'unknown'}`,
            );
            results.push({
              eventId: normalized.buildiumWebhookId,
              status: 'error',
              error: 'edge-forward-exception',
            });
            continue;
          }
        } else if (normalized.eventName === 'BankAccount.Transaction.Deleted') {
          // Allow delete events to re-run idempotently to ensure local cleanup.
          // If the transaction still exists, delete it (repair path for failed deletions).
          const buildiumTxnId = firstNumber(event?.TransactionId, event?.Data?.TransactionId);
          if (
            typeof buildiumTxnId === 'number' &&
            Number.isFinite(buildiumTxnId) &&
            buildiumTxnId > 0
          ) {
            const { data: existingTx } = await admin
              .from('transactions')
              .select('id')
              .eq('buildium_transaction_id', buildiumTxnId)
              .maybeSingle();

            if (existingTx?.id) {
              try {
                const { error: deleteErr } = await admin.rpc('delete_transaction_safe', {
                  p_transaction_id: existingTx.id,
                });
                if (deleteErr) {
                  throw deleteErr;
                }
                results.push({
                  eventId: normalized.buildiumWebhookId,
                  status: 'processed',
                  reprocessed: true,
                  deleted: true,
                });
                continue;
              } catch (err) {
                await markWebhookError(
                  admin,
                  eventKey,
                  `transaction-delete-failed:${(err as Error)?.message || 'unknown'}`,
                );
                results.push({
                  eventId: normalized.buildiumWebhookId,
                  status: 'error',
                  error: 'transaction-delete-failed',
                });
                continue;
              }
            }
          }
        }

        results.push({ eventId: normalized.buildiumWebhookId, status: 'duplicate' });
        continue;
      }

      const eventId = normalized.buildiumWebhookId;

      // Check toggle flag; if disabled, mark ignored and skip
      if (typeof type === 'string' && disabledEvents.has(type)) {
        const ignoredUpdate: BuildiumWebhookUpdate = {
          status: 'ignored',
          processed_at: new Date().toISOString(),
          processed: true,
        };
        await admin
          .from('buildium_webhook_events')
          .update(ignoredUpdate)
          .eq('buildium_webhook_id', normalized.buildiumWebhookId)
          .eq('event_name', normalized.eventName)
          .eq('event_created_at', normalized.eventCreatedAt);
        results.push({ eventId, status: 'processed' });
        continue;
      }

      // Process lease transactions locally to ensure persistence even if edge function or Buildium IP restrictions fail
      if (typeof type === 'string' && type.includes('LeaseTransaction')) {
        const leaseId = firstNumber(event?.LeaseId, event?.Data?.LeaseId);
        const transactionId = firstNumber(event?.TransactionId, event?.Data?.TransactionId);

        // Handle deletion locally
        if (looksDelete) {
          if (transactionId != null) {
            const { data: existing } = await admin
              .from('transactions')
              .select('id')
              .eq('buildium_transaction_id', transactionId)
              .maybeSingle();
            if (existing?.id) {
              await admin.from('transaction_lines').delete().eq('transaction_id', existing.id);
              await admin.from('transactions').delete().eq('id', existing.id);
              console.log('[buildium-webhook] Lease transaction deleted locally', existing.id);
            } else {
              console.log(
                '[buildium-webhook] Lease transaction delete received but not found locally',
                transactionId,
              );
              await markWebhookTombstone(
                admin,
                eventKey,
                `Lease transaction ${transactionId} already absent`,
              );
              results.push({ eventId, status: 'tombstoned' });
              continue;
            }
          } else {
            await markWebhookError(admin, eventKey, 'unknown-delete-missing-transactionId');
            results.push({ eventId, status: 'error', error: 'unknown-delete' });
            continue;
          }
        } else if (leaseId != null && transactionId != null) {
          // Upsert (create/update)
          const tx = await (async () => {
            try {
              return await fetchLeaseTransaction(Number(leaseId), Number(transactionId));
            } catch {
              return null;
            }
          })();
          if (tx) {
            try {
              const glFetcher = async (glId: number) => fetchGLAccount(glId);
              const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
              const upsertResult = await upsertLeaseTransactionWithLinesLocal(
                tx,
                glFetcher,
                buildiumAccountId,
              );
              const localTransactionId = upsertResult?.transactionId ?? null;
              const buildiumTxnIdNum = transactionId ? Number(transactionId) : null;
              await syncPaymentLifecycleFromTransaction(localTransactionId, buildiumTxnIdNum);
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert lease transaction locally', err);
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch lease transaction for local upsert', {
              leaseId,
              transactionId,
            });
          }
        }
      }

      // Forward BankAccount.Transaction.Created/Updated to the edge webhook processor (deposit → bank debit + UDF credit).
      // Buildium cannot call the edge endpoint directly because /functions/v1 requires JWT; Next.js forwards with service role.
      if (
        normalized.eventName === 'BankAccount.Transaction.Created' ||
        normalized.eventName === 'BankAccount.Transaction.Updated'
      ) {
        try {
          const forwardResult = await forwardBankTransactionToEdge(event, webhookSecretToUse);
          if (!forwardResult.ok) {
            await markWebhookError(
              admin,
              eventKey,
              `edge-forward-failed:${forwardResult.status}:${String(forwardResult.body).slice(0, 220)}`,
            );
            results.push({
              eventId,
              status: 'error',
              error: 'edge-forward-failed',
              edgeStatus: forwardResult.status,
              edgeBodyPreview: String(forwardResult.body).slice(0, 220),
            });
            continue;
          }
        } catch (err) {
          await markWebhookError(
            admin,
            eventKey,
            `edge-forward-exception:${(err as Error)?.message || 'unknown'}`,
          );
          results.push({ eventId, status: 'error', error: 'edge-forward-exception' });
          continue;
        }

        await admin
          .from('buildium_webhook_events')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed: true,
          } satisfies BuildiumWebhookUpdate)
          .eq('buildium_webhook_id', normalized.buildiumWebhookId)
          .eq('event_name', normalized.eventName)
          .eq('event_created_at', normalized.eventCreatedAt);

        results.push({ eventId, status: 'processed', forwarded: 'edge' });
        continue;
      }

      if (normalized.eventName === 'BankAccount.Transaction.Deleted') {
        const buildiumTxnId = firstNumber(event?.TransactionId, event?.Data?.TransactionId);
        if (!buildiumTxnId) {
          await markWebhookError(
            admin,
            eventKey,
            'BankAccount.Transaction.Deleted missing TransactionId',
          );
          results.push({ eventId, status: 'error', error: 'missing-transaction-id' });
          continue;
        }

        const buildiumBankAccountId = firstNumber(
          event?.BankAccountId,
          event?.Data?.BankAccountId,
          (event?.BankAccount as UnknownRecord | undefined)?.Id,
        );

        // Find transaction by buildium_transaction_id only (same as edge function)
        // Don't filter by bank_gl_account_id since transactions may not have it set
        // on the header - bank accounts are represented via transaction_lines instead
        const { data: txRows, error: txFetchError } = await admin
          .from('transactions')
          .select('id')
          .eq('buildium_transaction_id', buildiumTxnId);
        if (txFetchError) {
          await markWebhookError(
            admin,
            eventKey,
            `transaction-fetch-failed:${txFetchError.message}`,
          );
          results.push({ eventId, status: 'error', error: 'transaction-fetch-failed' });
          continue;
        }

        const txIds = (txRows || []).map((t) => t?.id).filter(Boolean) as string[];
        if (!txIds.length) {
          await markWebhookTombstone(
            admin,
            eventKey,
            `Transaction ${buildiumTxnId} already absent for bank account ${buildiumBankAccountId ?? 'unknown'}`,
          );
          results.push({ eventId, status: 'tombstoned' });
          continue;
        }

        try {
          for (const txId of txIds) {
            const { error: deleteErr } = await admin.rpc('delete_transaction_safe', {
              p_transaction_id: txId,
            });
            if (deleteErr) {
              throw deleteErr;
            }
          }
        } catch (err) {
          await markWebhookError(
            admin,
            eventKey,
            `transaction-delete-failed:${(err as Error)?.message || 'unknown'}`,
          );
          results.push({ eventId, status: 'error', error: 'transaction-delete-failed' });
          continue;
        }

        await admin
          .from('buildium_webhook_events')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed: true,
          } satisfies BuildiumWebhookUpdate)
          .eq('buildium_webhook_id', normalized.buildiumWebhookId)
          .eq('event_name', normalized.eventName)
          .eq('event_created_at', normalized.eventCreatedAt);

        results.push({ eventId, status: 'processed', deleted: true, count: txIds.length });
        continue;
      }

      // Process lease updates/creates/deletes (non-transaction)
      if (
        typeof type === 'string' &&
        type.includes('Lease') &&
        !type.includes('LeaseTransaction') &&
        !type.includes('LeaseTenant') &&
        !type.includes('MoveOut')
      ) {
        const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? event?.EntityId ?? null;
        if (leaseId) {
          if (looksDelete) {
            try {
              const deleted = await deleteLeaseLocal(Number(leaseId));
              if (!deleted) {
                await markWebhookTombstone(admin, eventKey, `Lease ${leaseId} already absent`);
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete lease locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Lease delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'lease-delete-failed' });
              continue;
            }
          } else {
            // Fetch lease from Buildium
            const leaseRemote = await fetchLease(Number(leaseId));
            if (!leaseRemote) {
              console.warn('[buildium-webhook] Could not fetch lease for update', { leaseId });
              await markWebhookError(admin, eventKey, `Lease ${leaseId} fetch failed`);
              results.push({ eventId, status: 'error', error: 'lease-fetch-failed' });
              continue;
            } else {
              // Upsert lease + parties locally
              try {
                const buildiumAccountId =
                  event?.AccountId ?? event?.Data?.AccountId ?? leaseRemote?.AccountId ?? null;
                await upsertLeaseWithPartiesLocal(leaseRemote, buildiumAccountId);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert lease locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Lease upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'lease-upsert-failed' });
                continue;
              }

              // Build current person set from payload (Tenants + Cosigners + CurrentTenants)
              const currentIds = new Set<number>();
              const addId = (v?: number | null) => {
                if (v != null && Number.isFinite(Number(v))) currentIds.add(Number(v));
              };
              if (Array.isArray(leaseRemote?.Tenants))
                (leaseRemote.Tenants as Array<{ Id?: number | null }>).forEach((t) => addId(t?.Id));
              if (Array.isArray(leaseRemote?.Cosigners))
                (leaseRemote.Cosigners as Array<{ Id?: number | null }>).forEach((c) =>
                  addId(c?.Id),
                );
              if (Array.isArray(leaseRemote?.CurrentTenants))
                (leaseRemote.CurrentTenants as Array<{ Id?: number | null }>).forEach((t) =>
                  addId(t?.Id),
                );

              try {
                await updateLeaseContactStatuses(Number(leaseId), currentIds);
              } catch (err) {
                console.error('[buildium-webhook] Failed to update lease contact statuses', err);
              }
            }
          }
        }
      }

      // Process lease tenant updates/deletes
      if (typeof type === 'string' && type.includes('LeaseTenant')) {
        const tenantIdBuildium =
          event?.TenantId ?? event?.Data?.TenantId ?? event?.EntityId ?? null;
        if (tenantIdBuildium) {
          if (looksDelete) {
            try {
              const deleted = await deleteTenantLocal(Number(tenantIdBuildium));
              if (!deleted) {
                await markWebhookTombstone(
                  admin,
                  eventKey,
                  `Tenant ${tenantIdBuildium} already absent`,
                );
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete tenant locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Tenant delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'tenant-delete-failed' });
              continue;
            }
          } else {
            // For MoveOut events we only need to update lease_contact dates; otherwise do full upsert.
            if (type.includes('MoveOut')) {
              const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? null;
              if (leaseId) {
                const moveOut = await fetchLeaseMoveOut(Number(leaseId), Number(tenantIdBuildium));
                if (moveOut) {
                  const leaseLocalId = await resolveLocalLeaseId(leaseId);
                  const tenantLocalId = await (async () => {
                    const { data } = await admin
                      .from('tenants')
                      .select('id')
                      .eq('buildium_tenant_id', Number(tenantIdBuildium))
                      .maybeSingle();
                    return data?.id ?? null;
                  })();
                  if (leaseLocalId && tenantLocalId) {
                    await admin
                      .from('lease_contacts')
                      .update({
                        move_out_date: moveOut?.MoveOutDate
                          ? normalizeDate(moveOut.MoveOutDate)
                          : null,
                        notice_given_date: moveOut?.NoticeGivenDate
                          ? normalizeDate(moveOut.NoticeGivenDate)
                          : null,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('lease_id', leaseLocalId)
                      .eq('tenant_id', tenantLocalId);
                  } else {
                    console.warn(
                      '[buildium-webhook] MoveOut could not resolve lease/tenant locally',
                      { leaseId, tenantIdBuildium },
                    );
                    await markWebhookError(
                      admin,
                      eventKey,
                      `MoveOut missing lease/tenant (${leaseId}/${tenantIdBuildium})`,
                    );
                    results.push({ eventId, status: 'error', error: 'moveout-resolution-failed' });
                    continue;
                  }
                } else {
                  await markWebhookError(
                    admin,
                    eventKey,
                    `MoveOut fetch failed for lease ${leaseId}`,
                  );
                  results.push({ eventId, status: 'error', error: 'moveout-fetch-failed' });
                  continue;
                }
              }
              continue;
            }
            const tenantData = await fetchLeaseTenant(Number(tenantIdBuildium));
            if (!tenantData) {
              console.warn('[buildium-webhook] Could not fetch lease tenant', { tenantIdBuildium });
            } else {
              // Core contact/tenant updates
              const orgIdFromPayload =
                Array.isArray(tenantData?.Leases) && tenantData.Leases.length
                  ? await resolveLeaseOrgId(
                      tenantData.Leases[0]?.Id,
                      tenantData.Leases[0]?.PropertyId,
                      event?.AccountId ?? null,
                    )
                  : await resolveLeaseOrgId(null, null, event?.AccountId ?? null);
              // If tenant already exists, prefer its contact_id (contact lookup uses that FK)
              let preferredContactId: number | null = null;
              let tenantIdLocal: string | null = null;
              {
                const { data: existingTenant } = await admin
                  .from('tenants')
                  .select('id, contact_id')
                  .eq('buildium_tenant_id', Number(tenantIdBuildium))
                  .maybeSingle();
                if (existingTenant?.id) {
                  tenantIdLocal = existingTenant.id;
                  preferredContactId = existingTenant.contact_id ?? null;
                }
              }

              const contactId = await findOrCreateContactForLeasePerson(
                tenantData,
                orgIdFromPayload,
                preferredContactId,
              );
              const now = new Date().toISOString();
              // Update contact with richer fields
              const phoneArrayFromTenant = Array.isArray(tenantData?.PhoneNumbers)
                ? (tenantData.PhoneNumbers as Array<{ Type?: string; Number?: string | null }>)
                : null;
              const phoneObjectFromTenant = phoneArrayFromTenant
                ? null
                : ((tenantData?.PhoneNumbers as {
                    Mobile?: string | null;
                    Home?: string | null;
                    Work?: string | null;
                  }) ?? null);
              const primaryPhone = phoneArrayFromTenant
                ? phoneArrayFromTenant.find((p) => /cell|mobile/i.test(p?.Type || ''))?.Number ||
                  phoneArrayFromTenant.find((p) => /home/i.test(p?.Type || ''))?.Number ||
                  phoneArrayFromTenant.find((p) => /work/i.test(p?.Type || ''))?.Number ||
                  null
                : phoneObjectFromTenant?.Mobile ||
                  phoneObjectFromTenant?.Home ||
                  phoneObjectFromTenant?.Work ||
                  null;
              const altPhone = phoneArrayFromTenant
                ? phoneArrayFromTenant.find((p) => /work/i.test(p?.Type || ''))?.Number ||
                  phoneArrayFromTenant.find((p) => /home/i.test(p?.Type || ''))?.Number ||
                  null
                : phoneObjectFromTenant?.Work || phoneObjectFromTenant?.Home || null;
              const addr = asRecord(
                (tenantData as UnknownRecord)?.Address ?? tenantData?.PrimaryAddress ?? {},
              );
              const altAddr = asRecord(
                (tenantData as UnknownRecord)?.AlternateAddress ??
                  tenantData?.AlternateAddress ??
                  {},
              );
              const contactUpdate: TablesUpdate<'contacts'> = {
                first_name: tenantData?.FirstName ?? null,
                last_name: tenantData?.LastName ?? null,
                primary_email: tenantData?.Email ?? null,
                alt_email: tenantData?.AlternateEmail ?? null,
                primary_phone: primaryPhone,
                alt_phone: altPhone,
                date_of_birth: tenantData?.DateOfBirth ?? null,
                primary_address_line_1: (addr as { AddressLine1?: string })?.AddressLine1 ?? null,
                primary_address_line_2: (addr as { AddressLine2?: string })?.AddressLine2 ?? null,
                primary_address_line_3: (addr as { AddressLine3?: string })?.AddressLine3 ?? null,
                primary_city: (addr as { City?: string })?.City ?? null,
                primary_state: (addr as { State?: string })?.State ?? null,
                primary_postal_code: (addr as { PostalCode?: string })?.PostalCode ?? null,
                primary_country: normalizeCountryEnum(
                  (addr as { Country?: string | null })?.Country ?? null,
                ),
                alt_address_line_1: (altAddr as { AddressLine1?: string })?.AddressLine1 ?? null,
                alt_address_line_2: (altAddr as { AddressLine2?: string })?.AddressLine2 ?? null,
                alt_address_line_3: (altAddr as { AddressLine3?: string })?.AddressLine3 ?? null,
                alt_city: (altAddr as { City?: string })?.City ?? null,
                alt_state: (altAddr as { State?: string })?.State ?? null,
                alt_postal_code: (altAddr as { PostalCode?: string })?.PostalCode ?? null,
                alt_country: normalizeCountryEnum(
                  (altAddr as { Country?: string | null })?.Country ?? null,
                ),
                mailing_preference:
                  tenantData?.MailingPreference === 'PrimaryAddress'
                    ? 'primary'
                    : tenantData?.MailingPreference === 'AlternateAddress'
                      ? 'alternate'
                      : null,
                display_name:
                  [tenantData?.FirstName, tenantData?.LastName].filter(Boolean).join(' ') ||
                  tenantData?.Email ||
                  'Tenant',
                updated_at: now,
              };
              await admin.from('contacts').update(contactUpdate).eq('id', contactId);

              tenantIdLocal =
                tenantIdLocal ||
                (await findOrCreateTenantFromContact(contactId, tenantData, orgIdFromPayload));
              // Update tenant fields (SMSOptInStatus, emergency, tax_id)
              const tenantUpdate: TablesUpdate<'tenants'> = {
                sms_opt_in_status:
                  typeof tenantData?.SMSOptInStatus === 'boolean'
                    ? tenantData.SMSOptInStatus
                    : null,
                emergency_contact_name: tenantData?.EmergencyContact?.Name ?? null,
                emergency_contact_relationship:
                  tenantData?.EmergencyContact?.RelationshipDescription ?? null,
                emergency_contact_phone: tenantData?.EmergencyContact?.Phone ?? null,
                emergency_contact_email: tenantData?.EmergencyContact?.Email ?? null,
                tax_id: tenantData?.TaxId ?? null,
                updated_at: now,
              };
              await admin.from('tenants').update(tenantUpdate).eq('id', tenantIdLocal);

              const linkedLeaseIds = new Set<string>();
              for (const lease of Array.isArray(tenantData?.Leases)
                ? (tenantData.Leases as Array<any>)
                : []) {
                const leaseLocalId = await resolveLocalLeaseId(lease?.Id);
                if (!leaseLocalId) continue;
                linkedLeaseIds.add(String(leaseLocalId));
                const moveInEntry = (
                  Array.isArray(lease?.Tenants) ? (lease.Tenants as Array<any>) : []
                ).find((t: any) => Number(t?.Id) === Number(tenantIdBuildium));
                const moveOutEntry = (
                  Array.isArray(lease?.MoveOutData) ? (lease.MoveOutData as Array<any>) : []
                ).find((m: any) => Number(m?.TenantId) === Number(tenantIdBuildium));
                const moveInDate = moveInEntry?.MoveInDate || null;
                const moveOutDate = moveOutEntry?.MoveOutDate || null;
                const noticeDate = moveOutEntry?.NoticeGivenDate || null;
                const orgId = await resolveLeaseOrgId(
                  lease?.Id,
                  lease?.PropertyId,
                  event?.AccountId ?? null,
                );
                if (!tenantIdLocal) continue;
                await ensureLeaseContactLocal(leaseLocalId, tenantIdLocal, 'Tenant', orgId ?? null);
                await admin
                  .from('lease_contacts')
                  .update({
                    move_in_date: moveInDate ? normalizeDate(moveInDate) : null,
                    move_out_date: moveOutDate ? normalizeDate(moveOutDate) : null,
                    notice_given_date: noticeDate ? normalizeDate(noticeDate) : null,
                    updated_at: now,
                  })
                  .eq('lease_id', leaseLocalId)
                  .eq('tenant_id', tenantIdLocal);
              }

              // Deactivate any existing lease_contact for this tenant not in current leases
              const { data: existingLinks } = await admin
                .from('lease_contacts')
                .select('id, lease_id, status')
                .eq('tenant_id', tenantIdLocal);
              if (existingLinks && existingLinks.length) {
                const toDeactivate = existingLinks
                  .filter((l) => !linkedLeaseIds.has(String(l.lease_id)) && l.status !== 'Past')
                  .map((l) => l.id);
                if (toDeactivate.length) {
                  await admin
                    .from('lease_contacts')
                    .update({ status: 'Past', updated_at: new Date().toISOString() })
                    .in('id', toDeactivate);
                }
              }
            }
          }
        }
      }

      // Process lease move outs (payload includes LeaseId and TenantId)
      if (typeof type === 'string' && type.includes('MoveOut')) {
        const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? null;
        const tenantIdBuildium = event?.TenantId ?? event?.Data?.TenantId ?? null;
        if (leaseId && tenantIdBuildium) {
          const moveOut = await fetchLeaseMoveOut(Number(leaseId), Number(tenantIdBuildium));
          if (moveOut) {
            const leaseLocalId = await resolveLocalLeaseId(leaseId);
            const tenantLocalId = await (async () => {
              const { data } = await admin
                .from('tenants')
                .select('id')
                .eq('buildium_tenant_id', Number(tenantIdBuildium))
                .maybeSingle();
              return data?.id ?? null;
            })();
            if (leaseLocalId && tenantLocalId) {
              await admin
                .from('lease_contacts')
                .update({
                  move_out_date: moveOut?.MoveOutDate ? normalizeDate(moveOut.MoveOutDate) : null,
                  notice_given_date: moveOut?.NoticeGivenDate
                    ? normalizeDate(moveOut.NoticeGivenDate)
                    : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('lease_id', leaseLocalId)
                .eq('tenant_id', tenantLocalId);
            } else {
              console.warn('[buildium-webhook] MoveOut could not resolve lease/tenant locally', {
                leaseId,
                tenantIdBuildium,
              });
              await markWebhookError(
                admin,
                eventKey,
                `MoveOut missing lease/tenant (${leaseId}/${tenantIdBuildium})`,
              );
              results.push({ eventId, status: 'error', error: 'moveout-resolution-failed' });
              continue;
            }
          }
        }
      }

      // Process bill create/update events
      if (typeof type === 'string' && type.toLowerCase().includes('bill.payment')) {
        const billIds = Array.isArray(event?.BillIds)
          ? event.BillIds
          : Array.isArray(event?.Data?.BillIds)
            ? event.Data.BillIds
            : [];
        const paymentId = event?.PaymentId ?? event?.Data?.PaymentId ?? event?.Id ?? null;
        if (!paymentId || !billIds.length) {
          console.warn('[buildium-webhook] Bill.Payment event missing paymentId or billIds', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'Bill payment missing PaymentId or BillIds');
          results.push({ eventId, status: 'error', error: 'bill-payment-missing-ids' });
        } else {
          for (const billId of billIds) {
            if (!billId) continue;
            if (looksDelete) {
              try {
                const deleted = await deleteBillPaymentLocal(Number(paymentId), Number(billId));
                if (!deleted) {
                  await markWebhookTombstone(
                    admin,
                    eventKey,
                    `Bill payment ${paymentId} for bill ${billId} already absent`,
                  );
                  results.push({ eventId, status: 'tombstoned' });
                  continue;
                }
              } catch (err) {
                console.error('[buildium-webhook] Failed to delete bill payment locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Bill payment delete failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'bill-payment-delete-failed' });
                continue;
              }
            } else {
              const payment = await fetchBillPayment(Number(billId), Number(paymentId));
              if (payment) {
                try {
                  const glFetcher = async (glId: number) => fetchGLAccount(glId);
                  const buildiumAccountId =
                    event?.AccountId ?? event?.Data?.AccountId ?? payment?.AccountId ?? null;
                  await upsertBillPaymentWithLines(
                    payment,
                    Number(billId),
                    glFetcher,
                    buildiumAccountId,
                  );
                } catch (err) {
                  console.error('[buildium-webhook] Failed to upsert bill payment locally', err);
                  await markWebhookError(
                    admin,
                    eventKey,
                    `Bill payment upsert failed: ${(err as Error)?.message || 'unknown'}`,
                  );
                  results.push({ eventId, status: 'error', error: 'bill-payment-upsert-failed' });
                  continue;
                }
              } else {
                console.warn('[buildium-webhook] Could not fetch bill payment', {
                  billId,
                  paymentId,
                });
                await markWebhookError(
                  admin,
                  eventKey,
                  `Bill payment fetch failed for bill ${billId}`,
                );
                results.push({ eventId, status: 'error', error: 'bill-payment-fetch-failed' });
                continue;
              }
            }
          }
        }
      } else if (typeof type === 'string' && type.includes('Bill')) {
        const billId = event?.BillId ?? event?.Data?.BillId ?? event?.EntityId ?? null;
        if (billId) {
          if (type.includes('Deleted')) {
            try {
              const deleted = await deleteBillLocal(Number(billId));
              if (!deleted) {
                await markWebhookTombstone(admin, eventKey, `Bill ${billId} already absent`);
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete bill locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Bill delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'bill-delete-failed' });
              continue;
            }
          } else {
            const bill = await fetchBill(Number(billId));
            if (bill) {
              const buildiumAccountId =
                event?.AccountId ?? event?.Data?.AccountId ?? bill?.AccountId ?? null;
              try {
                await upsertBillWithLines(bill, admin, buildiumAccountId ?? null);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert bill locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Bill upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'bill-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch bill for event', { billId, type });
              await markWebhookError(admin, eventKey, `Bill fetch failed for ${billId}`);
              results.push({ eventId, status: 'error', error: 'bill-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] Bill event missing BillId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'Bill event missing BillId');
          results.push({ eventId, status: 'error', error: 'bill-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.includes('GLAccount')) {
        const glAccountId =
          event?.GLAccountId ?? event?.Data?.GLAccountId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (glAccountId) {
          if (looksDelete) {
            try {
              const deleted = await deleteGLAccountLocal(Number(glAccountId));
              if (!deleted) {
                await markWebhookTombstone(
                  admin,
                  eventKey,
                  `GLAccount ${glAccountId} already absent`,
                );
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete GL account locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `GLAccount delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'gl-delete-failed' });
              continue;
            }
          } else {
            const gl = await fetchGLAccountRemote(Number(glAccountId));
            if (gl) {
              try {
                await upsertGLAccountWithOrg(gl, buildiumAccountId);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert GL account locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `GLAccount upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'gl-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch GL account for event', {
                glAccountId,
                type,
              });
              await markWebhookError(admin, eventKey, `GLAccount fetch failed for ${glAccountId}`);
              results.push({ eventId, status: 'error', error: 'gl-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] GLAccount event missing GLAccountId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'GLAccount event missing GLAccountId');
          results.push({ eventId, status: 'error', error: 'gl-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('rentalowner')) {
        const ownerId =
          event?.RentalOwnerId ?? event?.Data?.RentalOwnerId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (ownerId) {
          const owner = await fetchRentalOwner(Number(ownerId));
          if (owner) {
            try {
              const { linkedProperties } = await upsertRentalOwner(owner, buildiumAccountId);
              const ownerRecord = owner as UnknownRecord;
              const propertyIdsList = Array.isArray(ownerRecord?.PropertyIds)
                ? ownerRecord.PropertyIds
                : null;
              const propertyIDsList = Array.isArray(ownerRecord?.PropertyIDs)
                ? ownerRecord.PropertyIDs
                : null;
              const totalProps =
                (propertyIdsList && propertyIdsList.length) ||
                (propertyIDsList && propertyIDsList.length) ||
                0;
              if (totalProps > 0 && linkedProperties === 0) {
                await markWebhookError(
                  admin,
                  eventKey,
                  `Rental owner ${ownerId} missing property links`,
                );
                results.push({
                  eventId,
                  status: 'error',
                  error: 'rental-owner-missing-properties',
                });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental owner locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Rental owner upsert failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'rental-owner-upsert-failed' });
              continue;
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental owner for event', {
              ownerId,
              type,
            });
            await markWebhookError(admin, eventKey, `Rental owner fetch failed for ${ownerId}`);
            results.push({ eventId, status: 'error', error: 'rental-owner-fetch-failed' });
            continue;
          }
        } else {
          console.warn('[buildium-webhook] RentalOwner event missing RentalOwnerId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'RentalOwner event missing RentalOwnerId');
          results.push({ eventId, status: 'error', error: 'rental-owner-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.includes('Rental')) {
        const propertyId = event?.PropertyId ?? event?.Data?.PropertyId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (propertyId) {
          const rental = await fetchRentalProperty(Number(propertyId));
          if (rental) {
            try {
              await upsertPropertyFromBuildium(rental, buildiumAccountId);
              try {
                const rentalManagerId =
                  rental?.RentalManager?.Id ?? rental?.RentalManagerId ?? null;
                await updatePropertyManager(Number(propertyId), rentalManagerId);
              } catch (err) {
                console.warn('[buildium-webhook] Rental manager update skipped', err);
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental property locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Rental property upsert failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'rental-upsert-failed' });
              continue;
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental for event', {
              propertyId,
              type,
            });
            await markWebhookError(
              admin,
              eventKey,
              `Rental property fetch failed for ${propertyId}`,
            );
            results.push({ eventId, status: 'error', error: 'rental-fetch-failed' });
            continue;
          }
        } else {
          console.warn('[buildium-webhook] Rental event missing PropertyId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'Rental event missing PropertyId');
          results.push({ eventId, status: 'error', error: 'rental-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('rentalunit')) {
        const unitId = event?.UnitId ?? event?.Data?.UnitId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (unitId) {
          const unit = await fetchRentalUnit(Number(unitId));
          if (unit) {
            try {
              const localPropId = await resolvePropertyIdByBuildiumPropertyId(
                unit?.PropertyId,
                admin,
              );
              if (!localPropId) {
                await markWebhookError(
                  admin,
                  eventKey,
                  `Rental unit ${unitId} missing local property ${unit?.PropertyId}`,
                );
                results.push({ eventId, status: 'error', error: 'rental-unit-missing-property' });
                continue;
              }
              await upsertUnitFromBuildium(unit, buildiumAccountId);
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental unit locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Rental unit upsert failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'rental-unit-upsert-failed' });
              continue;
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental unit for event', {
              unitId,
              type,
            });
            await markWebhookError(admin, eventKey, `Rental unit fetch failed for ${unitId}`);
            results.push({ eventId, status: 'error', error: 'rental-unit-fetch-failed' });
            continue;
          }
        } else {
          console.warn('[buildium-webhook] RentalUnit event missing UnitId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'RentalUnit event missing UnitId');
          results.push({ eventId, status: 'error', error: 'rental-unit-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('taskcategory')) {
        const categoryId =
          event?.TaskCategoryId ?? event?.Data?.TaskCategoryId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (categoryId) {
          if (type.toLowerCase().includes('deleted')) {
            try {
              await admin
                .from('task_categories')
                .delete()
                .eq('buildium_category_id', Number(categoryId));
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete task category locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Task category delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'task-category-delete-failed' });
              continue;
            }
          } else {
            const cat = await fetchTaskCategory(Number(categoryId));
            if (cat) {
              try {
                await upsertTaskCategory(cat, buildiumAccountId);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert task category locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Task category upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'task-category-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch task category for event', {
                categoryId,
                type,
              });
              await markWebhookError(
                admin,
                eventKey,
                `Task category fetch failed for ${categoryId}`,
              );
              results.push({ eventId, status: 'error', error: 'task-category-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] TaskCategory event missing TaskCategoryId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'TaskCategory event missing TaskCategoryId');
          results.push({ eventId, status: 'error', error: 'task-category-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('task')) {
        const taskId = event?.TaskId ?? event?.Data?.TaskId ?? event?.EntityId ?? null;
        const taskType = event?.TaskType ?? event?.Data?.TaskType ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        // Only handle supported task kinds for now
        const taskTypeNormalized = typeof taskType === 'string' ? taskType.toLowerCase() : '';
        const supportedTaskTypes = ['todo', 'residentrequest'];
        if (taskTypeNormalized && !supportedTaskTypes.includes(taskTypeNormalized)) {
          results.push({ eventId, status: 'processed' });
          continue;
        }

        if (taskId) {
          const isDelete = looksDelete;
          if (isDelete) {
            try {
              const { data: existing } = await admin
                .from('tasks')
                .select('id')
                .eq('buildium_task_id', Number(taskId))
                .maybeSingle();
              if (!existing?.id) {
                await markWebhookTombstone(admin, eventKey, `Task ${taskId} already absent`);
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
              await admin.from('tasks').delete().eq('buildium_task_id', Number(taskId));
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete task locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Task delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'task-delete-failed' });
              continue;
            }
          } else {
            const task = await fetchTask(Number(taskId));
            if (task) {
              try {
                await upsertTaskFromBuildium(task, buildiumAccountId);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert task locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Task upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'task-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch task for event', {
                taskId,
                taskType,
                type,
              });
              await markWebhookError(admin, eventKey, `Task fetch failed for ${taskId}`);
              results.push({ eventId, status: 'error', error: 'task-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] Task event missing TaskId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'Task event missing TaskId');
          results.push({ eventId, status: 'error', error: 'task-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('vendorcategory')) {
        const vendorCategoryId =
          event?.VendorCategoryId ?? event?.Data?.VendorCategoryId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (vendorCategoryId) {
          const isDelete = looksDelete;
          if (isDelete) {
            try {
              await admin
                .from('vendor_categories')
                .delete()
                .eq('buildium_category_id', Number(vendorCategoryId));
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete vendor category locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Vendor category delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'vendor-category-delete-failed' });
              continue;
            }
          } else {
            const vendorCategory = await fetchVendorCategory(Number(vendorCategoryId));
            if (vendorCategory) {
              try {
                await upsertVendorCategory(vendorCategory, buildiumAccountId);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert vendor category locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Vendor category upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'vendor-category-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch vendor category for event', {
                vendorCategoryId,
                type,
              });
              await markWebhookError(
                admin,
                eventKey,
                `Vendor category fetch failed for ${vendorCategoryId}`,
              );
              results.push({ eventId, status: 'error', error: 'vendor-category-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] VendorCategory event missing VendorCategoryId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'VendorCategory event missing VendorCategoryId');
          results.push({ eventId, status: 'error', error: 'vendor-category-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('vendor')) {
        const vendorId = event?.VendorId ?? event?.Data?.VendorId ?? event?.EntityId ?? null;
        if (vendorId) {
          const isDelete = looksDelete;
          if (isDelete) {
            // Do not delete in DB per request; just acknowledge the event
            console.info(
              '[buildium-webhook] Vendor.Delete received; skipping deletion for testing',
              { vendorId },
            );
          } else {
            const vendor = await fetchVendor(Number(vendorId));
            if (vendor) {
              try {
                await upsertVendor(vendor);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert vendor locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Vendor upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'vendor-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch vendor for event', {
                vendorId,
                type,
              });
              await markWebhookError(admin, eventKey, `Vendor fetch failed for ${vendorId}`);
              results.push({ eventId, status: 'error', error: 'vendor-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] Vendor event missing VendorId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'Vendor event missing VendorId');
          results.push({ eventId, status: 'error', error: 'vendor-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('workorder')) {
        const workOrderId =
          event?.WorkOrderId ?? event?.Data?.WorkOrderId ?? event?.EntityId ?? null;
        if (workOrderId) {
          const isDelete = looksDelete;
          if (isDelete) {
            try {
              const { data: existing } = await admin
                .from('work_orders')
                .select('id')
                .eq('buildium_work_order_id', Number(workOrderId))
                .maybeSingle();
              if (!existing?.id) {
                await markWebhookTombstone(
                  admin,
                  eventKey,
                  `Work order ${workOrderId} already absent`,
                );
                results.push({ eventId, status: 'tombstoned' });
                continue;
              }
              await admin
                .from('work_orders')
                .delete()
                .eq('buildium_work_order_id', Number(workOrderId));
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete work order locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Work order delete failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'workorder-delete-failed' });
              continue;
            }
          } else {
            const wo = await fetchWorkOrder(Number(workOrderId));
            if (wo) {
              try {
                await upsertWorkOrder(wo);
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert work order locally', err);
                await markWebhookError(
                  admin,
                  eventKey,
                  `Work order upsert failed: ${(err as Error)?.message || 'unknown'}`,
                );
                results.push({ eventId, status: 'error', error: 'workorder-upsert-failed' });
                continue;
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch work order for event', {
                workOrderId,
                type,
              });
              await markWebhookError(admin, eventKey, `Work order fetch failed for ${workOrderId}`);
              results.push({ eventId, status: 'error', error: 'workorder-fetch-failed' });
              continue;
            }
          }
        } else {
          console.warn('[buildium-webhook] WorkOrder event missing WorkOrderId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'WorkOrder event missing WorkOrderId');
          results.push({ eventId, status: 'error', error: 'workorder-missing-id' });
          continue;
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('rentalowner')) {
        const ownerId =
          event?.RentalOwnerId ?? event?.Data?.RentalOwnerId ?? event?.EntityId ?? null;
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
        if (ownerId) {
          const owner = await fetchRentalOwner(Number(ownerId));
          if (owner) {
            try {
              const { linkedProperties } = await upsertRentalOwner(owner, buildiumAccountId);
              const ownerRecord = owner as UnknownRecord;
              const propertyIdsList = Array.isArray(ownerRecord?.PropertyIds)
                ? ownerRecord.PropertyIds
                : null;
              const propertyIDsList = Array.isArray(ownerRecord?.PropertyIDs)
                ? ownerRecord.PropertyIDs
                : null;
              const totalProps =
                (propertyIdsList && propertyIdsList.length) ||
                (propertyIDsList && propertyIDsList.length) ||
                0;
              if (totalProps > 0 && linkedProperties === 0) {
                await markWebhookError(
                  admin,
                  eventKey,
                  `Rental owner ${ownerId} missing property links`,
                );
                results.push({
                  eventId,
                  status: 'error',
                  error: 'rental-owner-missing-properties',
                });
                continue;
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental owner locally', err);
              await markWebhookError(
                admin,
                eventKey,
                `Rental owner upsert failed: ${(err as Error)?.message || 'unknown'}`,
              );
              results.push({ eventId, status: 'error', error: 'rental-owner-upsert-failed' });
              continue;
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental owner for event', {
              ownerId,
              type,
            });
            await markWebhookError(admin, eventKey, `Rental owner fetch failed for ${ownerId}`);
            results.push({ eventId, status: 'error', error: 'rental-owner-fetch-failed' });
            continue;
          }
        } else {
          console.warn('[buildium-webhook] RentalOwner event missing RentalOwnerId', {
            eventSnippet: JSON.stringify(event).slice(0, 200),
          });
          await markWebhookError(admin, eventKey, 'RentalOwner event missing RentalOwnerId');
          results.push({ eventId, status: 'error', error: 'rental-owner-missing-id' });
          continue;
        }
      }

      // Placeholder for downstream processing; currently mark as processed
      await admin
        .from('buildium_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          processed: true,
        } satisfies BuildiumWebhookUpdate)
        .eq('buildium_webhook_id', normalized.buildiumWebhookId)
        .eq('event_name', normalized.eventName)
        .eq('event_created_at', normalized.eventCreatedAt);

      results.push({ eventId, status: 'processed' });
    }

    // Dispatch lease transaction events downstream
    const leaseTxEvents = events.filter((ev) => {
      const type = firstString(ev?.EventType, ev?.EventName) ?? '';
      return type.includes('LeaseTransaction');
    });
    await forwardLeaseTransactionEvents(leaseTxEvents);

    const processed = results.filter((r) => r.status === 'processed').length;
    const duplicates = results.filter((r) => r.status === 'duplicate').length;
    const invalid = results.filter((r) => r.status === 'invalid').length;
    const tombstoned = results.filter((r) => r.status === 'tombstoned').length;
    const errors = results.filter((r) => r.status === 'error');

    return NextResponse.json({
      ok: true,
      received: events.length,
      processed,
      duplicates,
      invalid,
      tombstoned,
      errors,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('[buildium-webhook] Unhandled error', e);
    const idsForError = storedEvents.map((normalized) => normalized.buildiumWebhookId);
    if (idsForError.length > 0) {
      const errorUpdate: BuildiumWebhookUpdate = {
        status: 'error',
        error: errorMessage,
        processed_at: new Date().toISOString(),
        processed: false,
      };
      await admin
        .from('buildium_webhook_events')
        .update(errorUpdate)
        .in('buildium_webhook_id', idsForError);
    }
    return NextResponse.json({ error: 'Internal error', detail: errorMessage }, { status: 500 });
  }
}
// Load webhook toggle flags once
const disabledEvents = new Set<string>();
try {
  const { data, error } = await admin.from('webhook_event_flags').select('event_type, enabled');
  if (!error && Array.isArray(data)) {
    data.forEach((row) => {
      if (row?.enabled === false && typeof row?.event_type === 'string') {
        disabledEvents.add(row.event_type);
      }
    });
  } else if (error) {
    const msg = error?.message || '';
    if (msg.includes('webhook_event_flags') || msg.toLowerCase().includes('schema')) {
      // Gracefully skip toggles if table/cache missing
      console.warn(
        '[buildium-webhook] webhook_event_flags table missing; proceeding with all enabled',
      );
    } else {
      console.warn(
        '[buildium-webhook] Could not load webhook toggles; proceeding as enabled',
        error,
      );
    }
  }
} catch (err) {
  console.warn('[buildium-webhook] Could not load webhook toggles; proceeding as enabled', err);
}
