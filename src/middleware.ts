import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { AppRole } from '@/lib/auth/roles';
import { requiredRolesFor, userHasRequiredRoles } from '@/lib/rbac';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client bound to the request/response cookies
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const pathname = req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isDebugApi = pathname.startsWith('/api/debug');
  const isCsrfApi = pathname === '/api/csrf';
  const isDevBypassApi =
    pathname.startsWith('/api/transactions') ||
    pathname.startsWith('/api/monthly-logs') ||
    pathname.startsWith('/api/leases');
  // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs

  // Allow diagnostic endpoints, CSRF endpoint, transactions API in dev, CORS preflight
  if (
    req.method === 'OPTIONS' ||
    isDebugApi ||
    isCsrfApi ||
    (isDevBypassApi && process.env.NODE_ENV === 'development')
  ) {
    return NextResponse.next();
  }

  // API RBAC + org membership enforcement
  if (pathname.startsWith('/api')) {
    let user: any = null;
    let getUserError: any = null;

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
            } as any;
          }
        }
      } catch (e) {
        // Bearer token validation failed, will try cookies below
      }
    }

    // If Bearer token didn't work, try cookies (might be expired but worth trying)
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      user = data?.user;
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
          getUserError: getUserError?.message,
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

    const claims = (user.app_metadata as any)?.claims ?? {};
    const roles = (claims?.roles ?? []) as AppRole[];
    const orgIds = (claims?.org_ids ?? []) as string[];

    const required = requiredRolesFor(pathname);
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !userHasRequiredRoles(roles, required)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Basic tenant isolation precheck: user must belong to at least one org
    if (isProd && (!Array.isArray(orgIds) || orgIds.length === 0)) {
      return new NextResponse('Organization membership required', { status: 403 });
    }

    // Forward an org hint to route handlers if not provided (best-effort)
    const requestHeaders = new Headers(req.headers);
    if (!requestHeaders.get('x-org-id') && orgIds?.[0]) {
      requestHeaders.set('x-org-id', String(orgIds[0]));
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
    return NextResponse.next({ request: { headers: requestHeaders } });
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
