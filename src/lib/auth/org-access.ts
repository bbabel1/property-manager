import type { requireAuth } from '@/lib/auth/guards';

type AuthContext = Awaited<ReturnType<typeof requireAuth>>;
type AuthUser = AuthContext['user'];
type SupabaseClientLike = AuthContext['supabase'];

type LooseRecord = Record<string, unknown>;

const collectOrgCandidates = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectOrgCandidates(entry));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)];
  }
  return [];
};

const dedupeOrgIds = (values: string[]): string[] => {
  const normalized = new Set<string>();
  values.forEach((value) => {
    const trimmed = value.trim();
    if (trimmed) {
      normalized.add(trimmed);
    }
  });
  return Array.from(normalized);
};

export const getUserOrgIdsFromMetadata = (user: AuthUser | null | undefined): string[] => {
  if (!user) return [];
  const appMetadata = (user.app_metadata ?? {}) as LooseRecord;
  const userMetadata = (user.user_metadata ?? {}) as LooseRecord;
  const claims = (appMetadata?.claims ?? {}) as LooseRecord;
  const candidates = [
    ...collectOrgCandidates(claims?.org_ids),
    ...collectOrgCandidates(appMetadata?.org_ids),
    ...collectOrgCandidates(appMetadata?.default_org_id),
    ...collectOrgCandidates((appMetadata as LooseRecord)?.org_id),
    ...collectOrgCandidates(userMetadata?.org_ids),
    ...collectOrgCandidates(userMetadata?.default_org_id),
    ...collectOrgCandidates((userMetadata as LooseRecord)?.org_id),
  ];
  return dedupeOrgIds(candidates);
};

export const resolveUserOrgIds = async ({
  supabase,
  user,
}: {
  supabase: SupabaseClientLike;
  user: AuthUser;
}): Promise<string[]> => {
  const orgIds = new Set(getUserOrgIdsFromMetadata(user));

  if (!supabase || !user) {
    return Array.from(orgIds);
  }

  try {
    const { data, error } = await supabase
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id);
    if (error) {
      console.error('org-access: failed to load org memberships', error);
      return Array.from(orgIds);
    }

    for (const record of data ?? []) {
      collectOrgCandidates((record as LooseRecord)?.org_id).forEach((candidate) => {
        orgIds.add(candidate);
      });
    }
  } catch (error) {
    console.error('org-access: unexpected membership lookup error', error);
  }

  return Array.from(orgIds);
};

export const resolveUserOrgId = async ({
  supabase,
  user,
  preferred,
}: {
  supabase: SupabaseClientLike;
  user: AuthUser;
  preferred?: string | null;
}): Promise<string | null> => {
  const preferredOrg = preferred?.trim();
  if (preferredOrg) {
    return preferredOrg;
  }

  const orgIds = await resolveUserOrgIds({ supabase, user });
  return orgIds.length > 0 ? orgIds[0] : null;
};

export const userHasOrgAccess = async ({
  supabase,
  user,
  orgId,
}: {
  supabase: SupabaseClientLike;
  user: AuthUser;
  orgId?: string | null;
}): Promise<boolean> => {
  if (!orgId) return true;
  const normalized = orgId.trim();
  if (!normalized) return true;
  const orgIds = await resolveUserOrgIds({ supabase, user });
  return orgIds.includes(normalized);
};

