import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function generateCSRFToken(): Promise<string> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Check if CSRF token already exists
  const existingToken = request.cookies.get('csrf-token')
  
  if (!existingToken) {
    // Generate new CSRF token
    const token = await generateCSRFToken()
    
    // Set CSRF token as accessible cookie (not httpOnly so client can read it)
    response.cookies.set('csrf-token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    })
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
