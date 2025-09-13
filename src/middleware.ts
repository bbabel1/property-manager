import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { AppRole } from '@/lib/auth/roles'
import { requiredRolesFor, userHasRequiredRoles } from '@/lib/rbac'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Create a Supabase client bound to the request/response cookies
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options })
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const user = data?.user

  const pathname = req.nextUrl.pathname
  const isAuthRoute = pathname.startsWith("/auth")
  const isDebugApi = pathname.startsWith('/api/debug')

  // Allow diagnostic endpoints and CORS preflight without auth
  if (req.method === 'OPTIONS' || isDebugApi) {
    return NextResponse.next()
  }

  // API RBAC + org membership enforcement
  if (pathname.startsWith('/api')) {
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const claims = (user.app_metadata as any)?.claims ?? {}
    const roles = (claims?.roles ?? []) as AppRole[]
    const orgIds = (claims?.org_ids ?? []) as string[]

    const required = requiredRolesFor(pathname)
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd && !userHasRequiredRoles(roles, required)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Basic tenant isolation precheck: user must belong to at least one org
    if (isProd && (!Array.isArray(orgIds) || orgIds.length === 0)) {
      return new NextResponse('Organization membership required', { status: 403 })
    }

    // Forward an org hint to route handlers if not provided (best-effort)
    const requestHeaders = new Headers(req.headers)
    if (!requestHeaders.get('x-org-id') && orgIds?.[0]) {
      requestHeaders.set('x-org-id', String(orgIds[0]))
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const protectedPrefixes = [
    "/dashboard",
    "/owners",
    "/properties",
    "/units",
    "/leases",
    "/maintenance",
    "/settings",
    "/rent",
    "/accounting",
    "/bank-accounts",
  ]

  const requiresAuth = protectedPrefixes.some((p) => pathname.startsWith(p))

  // If unauthenticated and path requires auth, redirect to sign-in
  if (requiresAuth && !user) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/auth/signin"
    redirectUrl.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated and on an auth route, send to dashboard
  if (user && isAuthRoute) {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  // Run only on protected app sections and auth pages
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/owners/:path*",
    "/properties/:path*",
    "/units/:path*",
    "/leases/:path*",
    "/maintenance/:path*",
    "/settings/:path*",
    "/rent/:path*",
    "/accounting/:path*",
    "/bank-accounts/:path*",
    "/auth/:path*",
  ],
}
