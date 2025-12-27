import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { AppRole, hasRole } from './roles';

type LooseRecord = Record<string, unknown>;
type SupabaseUser = {
  app_metadata?: LooseRecord;
  user_metadata?: LooseRecord;
  id: string;
};

const normalizeArray = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  return [];
};

const extractRoles = (user: SupabaseUser): AppRole[] => {
  const appMeta = (user.app_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;
  const claimsRoles = normalizeArray(claims.roles);
  const legacyRoles = normalizeArray(appMeta.roles);
  return [...claimsRoles, ...legacyRoles] as AppRole[];
};

const extractOrgRoles = (user: SupabaseUser): Record<string, AppRole[]> => {
  const appMeta = (user.app_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;
  const orgRolesRaw = claims.org_roles;
  const map: Record<string, AppRole[]> = {};
  if (orgRolesRaw && typeof orgRolesRaw === 'object') {
    Object.entries(orgRolesRaw as Record<string, unknown>).forEach(([orgId, roles]) => {
      const arr = normalizeArray(roles).filter(Boolean) as AppRole[];
      if (orgId && arr.length) {
        map[String(orgId)] = arr;
      }
    });
  }
  return map;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function requireAuth() {
  // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs
  // If you need to bypass auth for testing, use real Supabase authentication instead
  // The test mode bypass was returning fake user IDs that broke database queries
  // if (process.env.TEST_AUTH_BYPASS === 'true') {
  //   // Even in test mode, use real authentication
  // }

  const jar = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');

  const orgRolesMap = extractOrgRoles(user as SupabaseUser);
  let roles = extractRoles(user as SupabaseUser);

  // Fallback: if roles are missing from claims/metadata, fetch memberships
  if (!roles.length) {
    try {
      const { data, error } = await supabase
        .from('membership_roles')
        .select('roles(name)')
        .eq('user_id', user.id);

      if (!error && Array.isArray(data) && data.length > 0) {
        roles = data
          .map((row: any) => (typeof row?.roles?.name === 'string' ? (row.roles.name as AppRole) : null))
          .filter(Boolean) as AppRole[];
      }
    } catch (membershipRolesError) {
      console.warn('Failed to load roles from membership_roles', membershipRolesError);
    }
  }

  if (!roles.length) {
    try {
      const { data, error } = await supabase
        .from('org_memberships')
        .select('role')
        .eq('user_id', user.id);

      if (!error && Array.isArray(data)) {
        roles = data
          .map((row) => (typeof row?.role === 'string' ? (row.role as AppRole) : null))
          .filter(Boolean) as AppRole[];
      }
    } catch (membershipError) {
      console.warn('Failed to load roles from org_memberships', membershipError);
    }
  }

  return { supabase, user, roles, orgRoles: orgRolesMap };
}

export async function requireRole(required: AppRole | AppRole[], orgId?: string) {
  const { supabase, user, roles, orgRoles } = await requireAuth();
  const scopedRoles = orgId && orgRoles[orgId] ? orgRoles[orgId] : roles;
  if (!hasRole(scopedRoles, required)) throw new Error('FORBIDDEN');
  return { supabase, user, roles: scopedRoles, orgRoles };
}

export async function requireOrg(orgId: string) {
  const { supabase, user } = await requireAuth();
  const appMeta = (user.app_metadata ?? {}) as LooseRecord;
  const userMeta = (user.user_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;

  const orgs = new Set<string>();
  normalizeArray(claims.org_ids).forEach((o) => orgs.add(o));
  normalizeArray(appMeta.org_ids).forEach((o) => orgs.add(o));
  normalizeArray(userMeta.org_ids).forEach((o) => orgs.add(o));

  if (!orgs.has(orgId)) {
    try {
      const { data, error } = await supabase.from('membership_roles').select('org_id').eq('user_id', user.id);
      if (!error) {
        (data ?? []).forEach((row) => {
          if (row?.org_id) orgs.add(String(row.org_id));
        });
      }
	    } catch {
      // fall through; we still enforce membership below
    }
  }

  if (!orgs.has(orgId)) throw new Error('ORG_FORBIDDEN');
  return { supabase, user, orgId };
}
