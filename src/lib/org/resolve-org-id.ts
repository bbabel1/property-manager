import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Resolve orgId from request context.
 * Order: header -> cookie -> first membership for the user.
 * Throws ORG_CONTEXT_REQUIRED if no org can be resolved and ORG_FORBIDDEN if membership cannot be verified.
 */
export async function resolveOrgIdFromRequest(
  request: NextRequest,
  userId?: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const client = supabase ?? supabaseAdmin;
  const normalizeOrgId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
  };

  const isValidUUID = (value: unknown): value is string => {
    return typeof value === 'string'
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
      : false;
  };

  const candidateUserIds = new Set<string>();
  if (userId && isValidUUID(userId)) {
    candidateUserIds.add(userId);
  }

  const encodedHeaderUser = request.headers.get('x-auth-user');
  if (encodedHeaderUser) {
    try {
      const headerUser = JSON.parse(decodeURIComponent(encodedHeaderUser));
      const headerUserId = normalizeOrgId(headerUser?.['id']);
      if (headerUserId && isValidUUID(headerUserId)) {
        candidateUserIds.add(headerUserId);
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to parse x-auth-user header while resolving org context');
    }
  }

  const headerOrgId = normalizeOrgId(request.headers.get('x-org-id'));
  const cookieOrgId = normalizeOrgId(request.cookies.get('x-org-id')?.value);

  const resolveOrgFromMembership = async (): Promise<string | null> => {
    if (!userId || !isValidUUID(userId)) return null;
    const { data: membership } = await client
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return normalizeOrgId(membership?.org_id);
  };

  const verifyMembership = async (org: string): Promise<boolean> => {
    if (!candidateUserIds.size) return false;
    for (const candidateId of candidateUserIds) {
      const { data, error } = await client
        .from('org_memberships')
        .select('user_id')
        .eq('org_id', org)
        .eq('user_id', candidateId)
        .maybeSingle();

      if (error) {
        logger.warn({ error, orgId: org, userId: candidateId }, 'Failed to verify org membership');
        continue;
      }

      if (data) return true;
    }
    return false;
  };

  const orgId = headerOrgId || cookieOrgId;
  const shouldVerifyMembership = Boolean(userId) || candidateUserIds.size > 0;

  if (orgId) {
    if (shouldVerifyMembership) {
      const hasMembership = await verifyMembership(orgId);
      if (!hasMembership) {
        throw new Error('ORG_FORBIDDEN');
      }
    }
    return orgId;
  }

  if (userId) {
    try {
      const membershipOrgId = await resolveOrgFromMembership();
      if (membershipOrgId) {
        return membershipOrgId;
      }
      throw new Error('ORG_CONTEXT_REQUIRED');
    } catch (error) {
      logger.warn({ userId, error }, 'Failed to resolve orgId');
      throw error;
    }
  }

  throw new Error('ORG_CONTEXT_REQUIRED');
}
