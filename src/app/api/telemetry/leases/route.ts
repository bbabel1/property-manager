import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const body = await request.json().catch(() => ({}));
    const payload = {
      event: typeof body?.event === 'string' ? body.event : 'unknown',
      lease_id: body?.leaseId ?? null,
      org_id: orgId,
      source: body?.source ?? body?.returnTo ?? null,
      prefills: body?.prefills ?? null,
      duration_ms: typeof body?.durationMs === 'number' ? body.durationMs : null,
      error_message: body?.errorMessage ?? null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('lease_telemetry_events').insert(payload);
    if (error) {
      console.warn('Lease telemetry insert failed (non-fatal):', error);
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
      .from('lease_telemetry_events')
      .select('event, lease_id, org_id, source, duration_ms, error_message, prefills, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.warn('Telemetry fetch failed (non-fatal):', error);
      return NextResponse.json({ events: [], summary: null });
    }

    const events = data || [];
    const total = events.length || 1;
    const success = events.filter((e) => String(e.event || '').includes('success')).length;
    const errors = events.filter((e) => String(e.event || '').includes('error')).length;
    const avgDuration =
      events.reduce((sum, e) => sum + (Number(e.duration_ms) || 0), 0) /
      Math.max(
        1,
        events.filter((e) => Number.isFinite(Number(e.duration_ms))).length,
      );

    return NextResponse.json({
      events,
      summary: {
        successRate: success / total,
        errorRate: errors / total,
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
