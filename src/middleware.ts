import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

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
    "/dashboard/:path*",
    "/owners/:path*",
    "/properties/:path*",
    "/units/:path*",
    "/leases/:path*",
    "/maintenance/:path*",
    "/settings/:path*",
    "/rent/:path*",
    "/accounting/:path*",
    "/auth/:path*",
  ],
}
