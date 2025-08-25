import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// CSRF token management using a more reliable approach
// We'll store tokens in cookies and validate them directly

export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('csrf-token')?.value || null
}

export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    // Get the token from the request headers first
    let token = request.headers.get('x-csrf-token')
    
    // If not in headers, try to get from body (but don't consume the body)
    if (!token) {
      try {
        const clonedRequest = request.clone()
        const body = await clonedRequest.json()
        token = body.csrfToken
      } catch (bodyError) {
        // Body might not be JSON or might be empty
        console.log('Could not parse request body for CSRF token:', bodyError)
      }
    }
    
    if (!token) {
      console.log('No CSRF token found in headers or body')
      return false
    }
    
    // Get the stored token from cookies
    const storedToken = request.cookies.get('csrf-token')?.value
    
    if (!storedToken) {
      console.log('No CSRF token found in cookies')
      return false
    }
    
    console.log('Comparing tokens:', { token, storedToken, match: token === storedToken })
    
    // Compare tokens
    return token === storedToken
  } catch (error) {
    console.error('CSRF validation error:', error)
    return false
  }
}

// Legacy function for backward compatibility
export function isValidCSRFToken(token: string, sessionId: string): boolean {
  // This is now handled by validateCSRFToken
  return false
}
