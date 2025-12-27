import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { getFileCategories } from '@/lib/files';
import { supabaseAdminMaybe } from '@/lib/db';
import type { TypedSupabaseClient } from '@/lib/db';

type MinimalUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

async function resolveOrgId(
  request: NextRequest,
  supabase: TypedSupabaseClient | any,
  user: MinimalUser,
): Promise<string> {
  const normalizeOrgId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  };

  const pickFirstOrgId = (...values: unknown[]): string | null => {
    for (const value of values) {
      const normalized = normalizeOrgId(value);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  };

  let orgId: string | null =
    request.headers.get('x-org-id') || request.cookies.get('x-org-id')?.value || null;

  let headerUser: Record<string, unknown> | null = null;
  const encodedHeader = request.headers.get('x-auth-user');
  if (encodedHeader) {
    try {
      headerUser = JSON.parse(decodeURIComponent(encodedHeader)) as Record<string, unknown>;
    } catch (error) {
      console.warn('Failed to parse x-auth-user header while resolving org context', error);
    }
  }

  const headerAppMeta = headerUser?.app_metadata as Record<string, unknown> | undefined;
  const headerUserMeta = headerUser?.user_metadata as Record<string, unknown> | undefined;
  const headerClaims =
    headerAppMeta && typeof headerAppMeta['claims'] === 'object'
      ? (headerAppMeta['claims'] as Record<string, unknown>)
      : undefined;
  const headerClaimOrgIds = Array.isArray(headerClaims?.['org_ids'])
    ? (headerClaims['org_ids'] as unknown[])
    : [];
  const headerUserOrgIds = Array.isArray(headerUserMeta?.['org_ids'])
    ? (headerUserMeta['org_ids'] as unknown[])
    : [];
  const userMeta = (user.user_metadata ?? undefined) as Record<string, unknown> | undefined;
  const userOrgIds = Array.isArray(userMeta?.['org_ids']) ? (userMeta['org_ids'] as unknown[]) : [];
  const userAppMeta = (user.app_metadata ?? undefined) as Record<string, unknown> | undefined;
  const userAppClaims =
    userAppMeta && typeof userAppMeta['claims'] === 'object'
      ? (userAppMeta['claims'] as Record<string, unknown>)
      : undefined;
  const userAppClaimOrgIds = Array.isArray(userAppClaims?.['org_ids'])
    ? (userAppClaims['org_ids'] as unknown[])
    : [];
  const userAppOrgIds = Array.isArray(userAppMeta?.['org_ids'])
    ? (userAppMeta['org_ids'] as unknown[])
    : [];

  if (!orgId) {
    orgId =
      pickFirstOrgId(
        headerUserMeta?.default_org_id,
        headerAppMeta?.default_org_id,
        userMeta?.default_org_id,
        userAppMeta?.default_org_id,
        headerUserMeta?.org_id,
        userMeta?.org_id,
        userAppMeta?.org_id,
        ...headerClaimOrgIds,
        ...headerUserOrgIds,
        ...userOrgIds,
        ...userAppClaimOrgIds,
        ...userAppOrgIds,
      ) ?? null;
  }

  const adminClient = supabaseAdminMaybe ?? supabase;

  // Check if user.id is a valid UUID before querying
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  if (!orgId && isValidUUID(user.id)) {
    const { data: rows } = await adminClient
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    orgId = normalizeOrgId((rows?.[0] as Record<string, unknown> | undefined)?.org_id);
  }

  // Last resort: fall back to first org (only in non-production)
  // This should rarely happen if authentication is properly configured
  if (!orgId && process.env.NODE_ENV !== 'production') {
    const { data: orgRow } = await adminClient
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = normalizeOrgId(orgRow?.id);
  }

  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED');
  return orgId;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const cookieClient = (await getSupabaseServerClient()) as any;
    // Use admin client in non-production if available for better debugging
    const supabase =
      process.env.NODE_ENV !== 'production' && supabaseAdminMaybe
        ? (supabaseAdminMaybe as any)
        : cookieClient;
    const orgId = await resolveOrgId(request, supabase, user);

    const categories = await getFileCategories(supabase, orgId, false);

    return NextResponse.json({
      success: true,
      data: categories.map((cat) => ({
        id: cat.id,
        name: cat.category_name,
        buildiumCategoryId: cat.buildium_category_id,
      })),
    });
  } catch (error) {
    console.error('Error fetching file categories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
