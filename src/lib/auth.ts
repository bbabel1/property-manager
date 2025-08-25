import { supabase, supabaseAdmin } from './db'
import { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export interface AuthenticatedUser {
  id: string
  email?: string
  user_metadata?: any
}

// Client-side auth utilities
export const auth = {
  // Sign up
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  },

  // Sign in with email/password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // Sign in with magic link
  async signInWithMagicLink(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  }
}

// Server-side auth utilities (for API routes only)
export async function requireUser(request?: NextRequest): Promise<AuthenticatedUser> {
  if (!supabaseAdmin) {
    throw new Error("Server-side Supabase client not available")
  }
  
  // Development bypass - remove this in production
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Bypassing authentication')
    return {
      id: 'dev-user-id',
      email: 'dev@example.com',
      user_metadata: {}
    }
  }
  
  try {
    // Get the authorization header
    const authHeader = request?.headers.get('authorization')
    const cookieHeader = request?.headers.get('cookie')
    
    if (!authHeader && !cookieHeader) {
      throw new Error("UNAUTHENTICATED")
    }

    // Try to get the session from the request
    let session = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !user) {
        throw new Error("UNAUTHENTICATED")
      }
      return {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }
    }

    // If no Bearer token, try to get session from cookies
    if (cookieHeader) {
      // Extract session from cookies
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

      // Check for Supabase session cookie
      const sessionCookie = cookies['sb-access-token'] || cookies['supabase-auth-token']
      
      if (sessionCookie) {
        try {
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionCookie)
          if (error || !user) {
            throw new Error("UNAUTHENTICATED")
          }
          return {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          }
        } catch (error) {
          console.error('Error getting user from session cookie:', error)
        }
      }

      // Try to get session directly from Supabase
      try {
        const { data: { session: sessionData }, error } = await supabaseAdmin.auth.getSession()
        if (error || !sessionData?.user) {
          throw new Error("UNAUTHENTICATED")
        }
        return {
          id: sessionData.user.id,
          email: sessionData.user.email,
          user_metadata: sessionData.user.user_metadata
        }
      } catch (error) {
        console.error('Error getting session from Supabase:', error)
      }
    }

    throw new Error("UNAUTHENTICATED")
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      throw error
    }
    console.error('Authentication error:', error)
    throw new Error("UNAUTHENTICATED")
  }
}

// Auth state change listener
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}