import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import supabase from '@/lib/db';
import { upsertGLEntryWithLines } from '@/lib/buildium-mappers';

async function getCursor(key: string) {
  const { data, error } = await supabase
    .from('gl_import_cursors')
    .select('*')
    .eq('key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as { key: string; last_imported_at: string; window_days: number } | null
}

async function setCursor(key: string, lastImportedAt: string, windowDays?: number) {
  const now = new Date().toISOString()
  const payload: any = { key, last_imported_at: lastImportedAt, updated_at: now }
  if (typeof windowDays === 'number') payload.window_days = windowDays
  // Upsert by key
  const { error } = await supabase
    .from('gl_import_cursors')
    .upsert(payload, { onConflict: 'key' })
  if (error) throw error
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser();

    const body = await request.json().catch(() => ({}));
    let { dateFrom, dateTo } = body || {};
    const { glAccountId, limit = 100, offset = 0, overlapDays = 7 } = body || {};

    // Idempotent windowing: if no dateFrom/dateTo passed, derive from cursor
    if (!dateFrom || !dateTo) {
      const cursor = await getCursor('gl_entries')
      const lastAt = cursor?.last_imported_at || '1970-01-01T00:00:00Z'
      const window = Number(cursor?.window_days ?? overlapDays)
      const start = new Date(lastAt)
      // back off by window days for late updates
      start.setUTCDate(start.getUTCDate() - (isNaN(window) ? 7 : window))
      const startStr = start.toISOString().slice(0, 10)
      const endStr = new Date().toISOString().slice(0, 10)
      dateFrom = dateFrom || startStr
      dateTo = dateTo || endStr
    }

    const qp = new URLSearchParams();
    if (dateFrom) qp.append('dateFrom', String(dateFrom));
    if (dateTo) qp.append('dateTo', String(dateTo));
    if (glAccountId) qp.append('glAccountId', String(glAccountId));
    qp.append('limit', String(limit));
    qp.append('offset', String(offset));

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/glentries?${qp.toString()}`;
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Buildium GL entries fetch (for sync) failed');
      return NextResponse.json({ error: 'Failed to fetch GL entries', details: errorData }, { status: response.status });
    }

    const entries = await response.json();
    let upserted = 0; let failed = 0;
    for (const entry of entries || []) {
      try {
        await upsertGLEntryWithLines(entry, supabase);
        upserted += 1;
      } catch (e) {
        failed += 1;
        logger.error({ error: e instanceof Error ? e.message : e }, 'Failed to upsert GL entry');
      }
    }

    // Advance cursor to now (or dateTo if provided)
    const cursorTo = (dateTo ? new Date(dateTo as string).toISOString() : new Date().toISOString())
    await setCursor('gl_entries', cursorTo, overlapDays)

    return NextResponse.json({ success: true, data: { upserted, failed, dateFrom, dateTo } });
  } catch (error) {
    logger.error('Error syncing GL entries from Buildium');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
