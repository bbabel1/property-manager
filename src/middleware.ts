import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { AppRole } from '@/lib/auth/roles';
import { requiredRolesFor, userHasRequiredRoles } from '@/lib/rbac';
import { logSecurityEvent } from '@/lib/security-log';

type LooseRecord = Record<string, unknown>;
type MiddlewareUser = {
  id?: string;
  email?: string | null;
  user_metadata?: LooseRecord | null;
  app_metadata?: LooseRecord | null;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const normalizeArray = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  return [];
};

const extractRoles = (user: MiddlewareUser): AppRole[] => {
  const appMeta = (user?.app_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;
  const claimsRoles = normalizeArray(claims.roles);
  const legacyRoles = normalizeArray(appMeta.roles);
  return [...claimsRoles, ...legacyRoles] as AppRole[];
};

const extractOrgRoles = (user: MiddlewareUser): Record<string, AppRole[]> => {
  const appMeta = (user?.app_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;
  const orgRolesRaw = claims.org_roles;
  const result: Record<string, AppRole[]> = {};
  if (orgRolesRaw && typeof orgRolesRaw === 'object') {
    Object.entries(orgRolesRaw as Record<string, unknown>).forEach(([orgId, roles]) => {
      const arr = normalizeArray(roles).filter(Boolean) as AppRole[];
      if (orgId && arr.length) {
        result[String(orgId)] = arr;
      }
    });
  }
  return result;
};

const extractOrgIds = (user: MiddlewareUser): string[] => {
  const candidates = [
    (user?.app_metadata as LooseRecord)?.claims,
    (user?.app_metadata as LooseRecord)?.org_ids,
    (user?.app_metadata as LooseRecord)?.default_org_id,
    (user?.user_metadata as LooseRecord)?.org_ids,
    (user?.user_metadata as LooseRecord)?.default_org_id,
  ];
  const orgs = new Set<string>();
  candidates.forEach((candidate) => {
    const values =
      candidate && typeof candidate === 'object' && 'org_ids' in (candidate as LooseRecord)
        ? (candidate as LooseRecord).org_ids
        : candidate;
    normalizeArray(values).forEach((org) => {
      const trimmed = String(org).trim();
      if (trimmed) orgs.add(trimmed);
    });
  });
  return Array.from(orgs);
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client bound to the request/response cookies
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const pathname = req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isDebugApi = pathname.startsWith('/api/debug');
  const isCsrfApi = pathname === '/api/csrf';
  const isWebhookApi = pathname.startsWith('/api/webhooks');
  const isDevBypassApi =
    pathname.startsWith('/api/transactions') ||
    pathname.startsWith('/api/monthly-logs') ||
    pathname.startsWith('/api/leases');
  // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs

  // Allow diagnostic endpoints, CSRF endpoint, webhook endpoints, transactions API in dev, CORS preflight
  if (
    req.method === 'OPTIONS' ||
    isDebugApi ||
    isCsrfApi ||
    isWebhookApi ||
    (isDevBypassApi && process.env.NODE_ENV === 'development')
  ) {
    return NextResponse.next();
  }

  // API RBAC + org membership enforcement
  if (pathname.startsWith('/api')) {
    let user: MiddlewareUser | null = null;
    let getUserError: unknown = null;

    // Check Bearer token FIRST (it's usually refreshed by fetchWithSupabaseAuth)
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        // Validate token by calling Supabase auth API directly
        const response = await fetch(`${url}/auth/v1/user`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anon,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          if (userData?.id) {
            user = {
              id: userData.id,
              email: userData.email ?? undefined,
              user_metadata: userData.user_metadata,
              app_metadata: userData.app_metadata,
            };
          }
        }
      } catch {
        // Bearer token validation failed, will try cookies below
      }
    }

    // If Bearer token didn't work, try cookies (might be expired but worth trying)
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      user = (data?.user as MiddlewareUser) ?? null;
      getUserError = error;
    }

    // If no user found via Bearer token or cookies, return Unauthorized
    if (!user) {
      // Log for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Middleware] Authentication failed for API route:', {
          pathname,
          hasCookies: req.cookies.getAll().length > 0,
          hasBearerToken: !!authHeader,
          getUserError: getUserError instanceof Error ? getUserError.message : undefined,
        });
      }
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    let roles = extractRoles(user);
    const orgRolesMap = extractOrgRoles(user);
    let orgIds = extractOrgIds(user);
    if (!orgIds.length && Object.keys(orgRolesMap).length > 0) {
      orgIds = Object.keys(orgRolesMap);
    }

    // If roles/orgIds missing from claims (stale token), hydrate from memberships
    if ((!roles.length || !orgIds.length) && user.id) {
      try {
        const { data, error } = await supabase
          .from('membership_roles')
          .select('org_id, role_id, roles(name)')
          .eq('user_id', user.id);

        if (!error && Array.isArray(data)) {
          const normalized = data.map((row) => ({
            org_id: row?.org_id,
            role:
              (row as { roles?: { name?: string | null } | null })?.roles?.name ??
              (row as { role_id?: string | null })?.role_id,
          }));
          if (!roles.length) {
            roles = normalized
              .map((row) => (typeof row.role === 'string' ? (row.role as AppRole) : null))
              .filter(Boolean) as AppRole[];
          }
          if (!orgIds.length) {
            orgIds = normalized
              .map((row) => (row?.org_id ? String(row.org_id) : null))
              .filter(Boolean)
              .map((org) => String(org));
          }
        }
      } catch (membershipError) {
          console.warn('[Middleware] Failed to load memberships for RBAC fallback', membershipError);
      }
    }

    // Legacy fallback: if orgIds are still empty, pull from org_memberships
    if ((!orgIds.length) && user.id) {
      try {
        const { data, error } = await supabase
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', user.id);
        if (!error && Array.isArray(data)) {
          orgIds = data
            .map((row) => (row?.org_id ? String(row.org_id) : null))
            .filter(Boolean)
            .map((org) => String(org));
        }
      } catch (orgMembershipError) {
        console.warn('[Middleware] Failed to load org_memberships for RBAC fallback', orgMembershipError);
      }
    }

    const required = requiredRolesFor(pathname);
    const isProd = process.env.NODE_ENV === 'production';
    // Prefer org-scoped roles when an org is known
    const targetOrgId =
      req.headers.get('x-org-id') ||
      (orgIds.length ? orgIds[0] : Object.keys(orgRolesMap)[0]);
    const scopedRoles =
      (targetOrgId && orgRolesMap[targetOrgId]) ||
      (targetOrgId && orgRolesMap[String(targetOrgId)]) ||
      roles;

    if (isProd) {
      if (targetOrgId && Object.keys(orgRolesMap).length > 0 && !orgRolesMap[targetOrgId]) {
        logSecurityEvent({
          action: 'org_membership_check',
          route: pathname,
          userId: user.id,
          orgId: targetOrgId,
          roles: scopedRoles,
          result: 'deny',
          reason: 'missing_org_membership',
        });
        return new NextResponse('Organization membership required', { status: 403 });
      }
      if (!userHasRequiredRoles(scopedRoles, required)) {
        logSecurityEvent({
          action: 'route_rbac_check',
          route: pathname,
          userId: user.id,
          orgId: targetOrgId ?? null,
          roles: scopedRoles,
          result: 'deny',
          reason: 'insufficient_role',
        });
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Basic tenant isolation precheck: user must belong to at least one org
    if (isProd && (!Array.isArray(orgIds) || orgIds.length === 0)) {
      return new NextResponse('Organization membership required', { status: 403 });
    }

    // Forward an org hint to route handlers if not provided (best-effort)
    const requestHeaders = new Headers(req.headers);
    let orgHint: string | undefined;
    if (!requestHeaders.get('x-org-id')) {
      const appMeta = (user?.app_metadata ?? {}) as LooseRecord;
      const claims = (appMeta.claims ?? {}) as LooseRecord;
      const preferredOrg = claims.preferred_org_id as string | undefined;
      orgHint = preferredOrg || orgIds?.[0] || targetOrgId;
      if (orgHint) {
        requestHeaders.set('x-org-id', String(orgHint));
      }
    } else {
      orgHint = requestHeaders.get('x-org-id') ?? undefined;
    }
    if (user) {
      try {
        const payload = {
          id: user.id,
          email: user.email ?? null,
          user_metadata: user.user_metadata ?? null,
          app_metadata: user.app_metadata ?? null,
        };
        requestHeaders.set('x-auth-user', encodeURIComponent(JSON.stringify(payload)));
      } catch (error) {
        console.warn('Failed to serialize auth user header', error);
      }
    }
    const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
    if (orgHint) {
      apiResponse.cookies.set({
        name: 'org_id_hint',
        value: String(orgHint),
        path: '/',
        sameSite: 'lax',
      });
    }
    return apiResponse;
  }

  // For non-API routes, get user from cookies for route protection
  const { data: pageData } = await supabase.auth.getUser();
  const pageUser = pageData?.user;

  const protectedPrefixes = [
    '/dashboard',
    '/owners',
    '/properties',
    '/units',
    '/leases',
    '/maintenance',
    '/settings',
    '/rent',
    '/accounting',
    '/bank-accounts',
    '/monthly-logs',
    '/files',
  ];

  const requiresAuth = protectedPrefixes.some((p) => pathname.startsWith(p));

  // If unauthenticated and path requires auth, redirect to sign-in
  if (requiresAuth && !pageUser) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/auth/signin';
    redirectUrl.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and on an auth route, send to dashboard
  if (pageUser && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  // Set org hint cookie for non-API routes when available (from claims or membership fallback)
  const appMeta = (pageUser?.app_metadata ?? {}) as LooseRecord;
  const claims = (appMeta.claims ?? {}) as LooseRecord;
  const preferredOrg = (claims?.preferred_org_id ?? normalizeArray(claims?.org_ids)[0]) as
    | string
    | undefined;
  if (preferredOrg) {
    res.cookies.set({
      name: 'org_id_hint',
      value: String(preferredOrg),
      path: '/',
      sameSite: 'lax',
    });
  }
  return res;
}

export const config = {
  // Run only on protected app sections and auth pages
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/owners/:path*',
    '/properties/:path*',
    '/units/:path*',
    '/leases/:path*',
    '/maintenance/:path*',
    '/settings/:path*',
    '/rent/:path*',
    '/accounting/:path*',
    '/bank-accounts/:path*',
    '/monthly-logs/:path*',
    '/auth/:path*',
  ],
};
