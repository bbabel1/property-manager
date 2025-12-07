import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Resolve orgId from request context.
 * Order: header -> cookie -> first membership for the user.
 * Throws ORG_CONTEXT_REQUIRED if no org can be resolved.
 */
export async function resolveOrgIdFromRequest(
  request: NextRequest,
  userId?: string,
  supabase?: SupabaseClient
): Promise<string> {
  const headerOrgId = request.headers.get('x-org-id')?.trim();
  if (headerOrgId) return headerOrgId;

  const cookieOrgId = request.cookies.get('x-org-id')?.value?.trim();
  if (cookieOrgId) return cookieOrgId;

  if (userId) {
    try {
      const client = supabase ?? supabaseAdmin;
      const { data: membership } = await client
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membership?.org_id) {
        return membership.org_id as string;
      }
    } catch (error) {
      logger.warn({ userId, error }, 'Failed to resolve orgId from membership');
    }
  }

  throw new Error('ORG_CONTEXT_REQUIRED');
}
