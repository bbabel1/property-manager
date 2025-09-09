import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import supabase from '@/lib/db';
import { mapGLAccountFromBuildiumWithSubAccounts } from '@/lib/buildium-mappers';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser();

    const body = await request.json().catch(() => ({}));
    const { type, subType, isActive, limit = 100, offset = 0 } = body || {};

    const qp = new URLSearchParams();
    if (type) qp.append('type', String(type));
    if (subType) qp.append('subType', String(subType));
    if (typeof isActive !== 'undefined') qp.append('isActive', String(isActive));
    qp.append('limit', String(limit));
    qp.append('offset', String(offset));

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/glaccounts?${qp.toString()}`;
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
      logger.error('Buildium GL accounts fetch (for sync) failed');
      return NextResponse.json({ error: 'Failed to fetch GL accounts', details: errorData }, { status: response.status });
    }

    const accounts = await response.json();
    let synced = 0; let updated = 0; let failed = 0;

    for (const acc of accounts || []) {
      try {
        const mapped = await mapGLAccountFromBuildiumWithSubAccounts(acc, supabase);
        const now = new Date().toISOString();

        // Upsert by buildium_gl_account_id
        const { data: existing, error: findErr } = await supabase
          .from('gl_accounts')
          .select('id')
          .eq('buildium_gl_account_id', mapped.buildium_gl_account_id)
          .single();
        if (findErr && findErr.code !== 'PGRST116') throw findErr;

        if (existing) {
          const { error } = await supabase
            .from('gl_accounts')
            .update({ ...mapped, updated_at: now })
            .eq('id', existing.id);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase
            .from('gl_accounts')
            .insert({ ...mapped, created_at: now, updated_at: now });
          if (error) throw error;
          synced += 1;
        }
      } catch (e) {
        failed += 1;
        logger.error({ error: e instanceof Error ? e.message : e }, 'Failed to upsert GL account');
      }
    }

    return NextResponse.json({ success: true, data: { synced, updated, failed } });
  } catch (error) {
    logger.error('Error syncing GL accounts from Buildium');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

