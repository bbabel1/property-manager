import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

type Body = {
  event?: string;
  onboardingId?: string | null;
  propertyId?: string | null;
  orgId?: string | null;
  userId?: string | null;
  status?: string | null;
  stepName?: string | null;
  source?: string | null;
  outcome?: string | null;
  errorCode?: string | null;
  durationMs?: number | null;
  templateId?: string | null;
  templateName?: string | null;
  recipientCount?: number | null;
  idempotencyHit?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const body: Body = (await request.json().catch(() => ({}))) ?? {};

    const toText = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;

    const toNumber = (value: unknown): number | null => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const payload = {
      event: toText(body.event) ?? 'unknown',
      org_id: orgId,
      onboarding_id: toText(body.onboardingId),
      property_id: toText(body.propertyId),
      user_id: toText(body.userId),
      status: toText(body.status),
      step_name: toText(body.stepName),
      source: toText(body.source),
      outcome: toText(body.outcome),
      error_code: toText(body.errorCode),
      template_id: toText(body.templateId),
      template_name: toText(body.templateName),
      recipient_count: toNumber(body.recipientCount),
      idempotency_hit: typeof body.idempotencyHit === 'boolean' ? body.idempotencyHit : null,
      duration_ms: toNumber(body.durationMs),
      metadata: body.metadata ?? null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('property_onboarding_telemetry_events').insert(payload);
    if (error) {
      console.warn('Onboarding telemetry insert failed (non-fatal):', error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telemetry POST error', error);
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);

    const { data, error } = await supabase
      .from('property_onboarding_telemetry_events')
      .select(
        'event, onboarding_id, property_id, status, step_name, source, outcome, error_code, recipient_count, idempotency_hit, duration_ms, created_at',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('Onboarding telemetry fetch failed (non-fatal):', error);
      return NextResponse.json({ events: [], summary: null });
    }

    const events = data || [];
    const total = events.length || 1;
    const sendSuccess = events.filter(
      (e) => e.event === 'agreement_send' && e.outcome === 'success',
    ).length;
    const autosaveErrors = events.filter(
      (e) => e.event === 'onboarding_autosave' && e.outcome === 'error',
    ).length;
    const idempotencyHits = events.filter((e) => e.idempotency_hit === true).length;
    const avgDuration =
      events.reduce((sum, e) => sum + (Number(e.duration_ms) || 0), 0) /
      Math.max(1, events.filter((e) => Number.isFinite(Number(e.duration_ms))).length);

    return NextResponse.json({
      events,
      summary: {
        sendSuccessRate: sendSuccess / total,
        autosaveErrorRate: autosaveErrors / total,
        idempotencyHitRate: idempotencyHits / total,
        averageDurationMs: Number.isFinite(avgDuration) ? Math.round(avgDuration) : null,
      },
    });
  } catch (error) {
    console.error('Telemetry GET error', error);
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return NextResponse.json({ events: [], summary: null }, { status: 500 });
  }
}
