import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { getServerSupabaseClient } from '@/lib/supabase-client';
import { mapGLAccountFromBuildiumWithSubAccounts } from '@/lib/buildium-mappers';
import type { BuildiumGLAccountExtended } from '@/types/buildium';
import type { Database } from '@/types/database';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

const isBuildiumGLAccountExtended = (value: unknown): value is BuildiumGLAccountExtended => {
  if (!value || typeof value !== 'object') return false;
  const account = value as Record<string, unknown>;
  return typeof account.Id === 'number' && typeof account.Name === 'string' && typeof account.Type === 'string';
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { user } = await requireRole('platform_admin');

    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const body = await request.json().catch(() => ({}));
    const { type, subType, isActive, limit = 100, offset = 0 } = body || {};

    const queryParams: Record<string, string> = {};
    if (type) queryParams.type = String(type);
    if (subType) queryParams.subType = String(subType);
    if (typeof isActive !== 'undefined') queryParams.isActive = String(isActive);
    queryParams.limit = String(limit);
    queryParams.offset = String(offset);

    const response = await buildiumFetch('GET', '/glaccounts', queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error('Buildium GL accounts fetch (for sync) failed');
      return NextResponse.json({ error: 'Failed to fetch GL accounts', details: errorData }, { status: response.status });
    }

    if (!Array.isArray(response.json)) {
      return NextResponse.json({ error: 'Unexpected GL accounts response' }, { status: 502 });
    }
    const accountsRaw = response.json as unknown[];
    let synced = 0; let updated = 0; let failed = 0;

    const supabase = getServerSupabaseClient('gl accounts sync');
    
    for (const acc of accountsRaw) {
      try {
        if (!isBuildiumGLAccountExtended(acc)) {
          failed += 1;
          continue;
        }
        const mapped = await mapGLAccountFromBuildiumWithSubAccounts(acc, supabase);
        const normalized = {
          ...mapped,
          is_security_deposit_liability: mapped.is_security_deposit_liability ?? undefined,
          type: mapped.type ?? '',
        };
        const now = new Date().toISOString();

        // Upsert by buildium_gl_account_id
        const { data: existing, error: findErr } = await supabase
          .from('gl_accounts')
          .select('id')
          .eq('buildium_gl_account_id', mapped.buildium_gl_account_id)
          .single();
        if (findErr && findErr.code !== 'PGRST116') throw findErr;

        if (existing) {
          const updatePayload: Database['public']['Tables']['gl_accounts']['Update'] = {
            ...normalized,
            updated_at: now,
          };
          const { error } = await supabase
            .from('gl_accounts')
            .update(updatePayload)
            .eq('id', existing.id);
          if (error) throw error;
          updated += 1;
        } else {
          const insertPayload: Database['public']['Tables']['gl_accounts']['Insert'] = {
            ...normalized,
            created_at: now,
            updated_at: now,
          };
          const { error } = await supabase
            .from('gl_accounts')
            .insert(insertPayload);
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
    logger.error({ error });
    logger.error('Error syncing GL accounts from Buildium');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
