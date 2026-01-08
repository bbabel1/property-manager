import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin, supabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = {
      event: typeof body?.event === 'string' ? body.event : 'unknown',
      lease_id: body?.leaseId ?? null,
      org_id: body?.orgId ?? null,
      source: body?.source ?? body?.returnTo ?? null,
      prefills: body?.prefills ?? null,
      duration_ms: typeof body?.durationMs === 'number' ? body.durationMs : null,
      error_message: body?.errorMessage ?? null,
      created_at: new Date().toISOString(),
    };

    const db = supabaseAdmin || supabase;
    if (db) {
      const { error } = await db.from('charge_telemetry_events').insert(payload);
      if (error) {
        console.warn('Telemetry insert failed (non-fatal):', error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telemetry POST error', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  try {
    const db = supabaseAdmin || supabase;
    if (!db) return NextResponse.json({ events: [], summary: null });

    const { data, error } = await db
      .from('charge_telemetry_events')
      .select('event, lease_id, org_id, source, duration_ms, error_message, prefills, created_at')
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
    return NextResponse.json({ events: [], summary: null });
  }
}
