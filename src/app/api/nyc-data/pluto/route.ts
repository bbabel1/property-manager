import { NextRequest, NextResponse } from 'next/server';

import { fetchPlutoData } from '@/lib/building-enrichment';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getNYCOpenDataConfig } from '@/lib/nyc-open-data/config-manager';

const BOROUGH_CODE_LOOKUP: Record<string, string> = {
  manhattan: '1',
  'new york': '1',
  mn: '1',
  bronx: '2',
  bx: '2',
  brooklyn: '3',
  kings: '3',
  bk: '3',
  queens: '4',
  qn: '4',
  'staten island': '5',
  richmond: '5',
  si: '5',
};

const digitsOnly = (value: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D+/g, '');
  return digits || null;
};

type BuildingRow = {
  id: string;
  bin: string | null;
  bbl: string | null;
  pluto: Record<string, unknown> | null;
};

async function fetchJson(url: string, appToken?: string | null): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (appToken) headers['X-App-Token'] = appToken;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

async function lookupBblFromDob(bin: string, appToken?: string | null, baseUrl?: string | null) {
  const url = new URL('resource/ipu4-2q9a.json', baseUrl || undefined);
  url.searchParams.set('bin__', bin);
  url.searchParams.set('$select', 'borough,block,lot,bin__');
  url.searchParams.set('$limit', '1');

  const json = await fetchJson(url.toString(), appToken);
  const row = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : null;
  if (!row) return null;

  const block = digitsOnly(typeof row['block'] === 'string' ? row['block'] : null);
  const lot = digitsOnly(typeof row['lot'] === 'string' ? row['lot'] : null);
  const boroughRaw =
    typeof row['borough'] === 'string' ? row['borough'].trim().toLowerCase() : '';
  const boroughCode = BOROUGH_CODE_LOOKUP[boroughRaw] || null;

  if (!boroughCode || !block || !lot) return null;
  return `${boroughCode}${block.padStart(5, '0')}${lot.padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const bin = digitsOnly(searchParams.get('bin'));
    let bbl = digitsOnly(searchParams.get('bbl'));

    if (!bin && !bbl) {
      return NextResponse.json({ error: 'Provide bin or bbl' }, { status: 400 });
    }

    let building: BuildingRow | null = null;
    if (bin) {
      const { data, error } = await supabaseAdmin
        .from('buildings')
        .select('id, bin, bbl, pluto')
        .eq('bin', bin)
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn({ error, bin }, 'PLUTO lookup: failed to read building by BIN');
      }

      building = (data as BuildingRow | null) || null;
      if (!bbl) {
        const plutoRecord =
          building?.pluto && typeof building.pluto === 'object' ? building.pluto : null;
        bbl =
          digitsOnly(building?.bbl ?? null) ||
          digitsOnly(
            typeof plutoRecord?.['bbl'] === 'string' ? (plutoRecord['bbl'] as string) : null,
          ) ||
          digitsOnly(
            typeof plutoRecord?.['appbbl'] === 'string'
              ? (plutoRecord['appbbl'] as string)
              : null,
          ) ||
          null;
      }
    }

    const config = await getNYCOpenDataConfig();

    if (!bbl && bin) {
      bbl = await lookupBblFromDob(bin, config.appToken, config.baseUrl);
    }

    if (!bbl) {
      return NextResponse.json(
        { error: 'Unable to resolve BBL for PLUTO lookup' },
        { status: 400 },
      );
    }

    let pluto = building?.pluto || null;
    const source: 'cached' | 'fetched' = pluto ? 'cached' : 'fetched';

    if (!pluto) {
      pluto = await fetchPlutoData(bbl, config.appToken, config.baseUrl);
    }

    if (!pluto) {
      return NextResponse.json({ error: 'PLUTO data not found' }, { status: 404 });
    }

    return NextResponse.json({
      bin: bin || building?.bin || null,
      bbl,
      building_id: building?.id ?? null,
      source,
      pluto,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    logger.error({ error }, 'Failed to fetch PLUTO response');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch PLUTO response' } },
      { status: 500 },
    );
  }
}
