import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { supabase } from '@/lib/db';
import { upsertGLEntryWithLines } from '@/lib/buildium-mappers';
import type { Database } from '@/types/database';

type GlImportCursorRow = Database['public']['Tables']['gl_import_cursors']['Row'];
type GlImportCursorUpsert = Database['public']['Tables']['gl_import_cursors']['Insert'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};
const toStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

async function getCursor(key: string) {
  const { data, error } = await supabase
    .from('gl_import_cursors')
    .select('*')
    .eq('key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as GlImportCursorRow | null
}

async function setCursor(key: string, lastImportedAt: string, windowDays?: number) {
  const now = new Date().toISOString()
  const payload: GlImportCursorUpsert = {
    key,
    last_imported_at: lastImportedAt,
    updated_at: now,
    ...(typeof windowDays === 'number' ? { window_days: windowDays } : {}),
  }
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

    await requireRole('platform_admin');

    const body: unknown = await request.json().catch(() => ({}));
    const bodyObj = isRecord(body) ? body : {};
    let dateFrom = toStringValue(bodyObj.dateFrom);
    let dateTo = toStringValue(bodyObj.dateTo);
    const glAccountId = toNumber(bodyObj.glAccountId);
    const limit = toNumber(bodyObj.limit) ?? 100;
    const offset = toNumber(bodyObj.offset) ?? 0;
    const overlapDays = toNumber(bodyObj.overlapDays) ?? 7;

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

    const queryParams: Record<string, string> = {};
    if (dateFrom) queryParams.dateFrom = String(dateFrom);
    if (dateTo) queryParams.dateTo = String(dateTo);
    if (glAccountId) queryParams.glAccountId = String(glAccountId);
    queryParams.limit = String(limit);
    queryParams.offset = String(offset);

    const response = await buildiumFetch('GET', '/generalledger/journalentries', queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error('Buildium GL entries fetch (for sync) failed');
      return NextResponse.json({ error: 'Failed to fetch GL entries', details: errorData }, { status: response.status });
    }

    const entriesJson: unknown = response.json ?? [];
    const entries = Array.isArray(entriesJson)
      ? entriesJson.filter(isRecord)
      : [];
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
    logger.error({ error });
    logger.error('Error syncing GL entries from Buildium');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
