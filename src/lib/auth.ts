import { supabase, supabaseAdmin } from './db'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
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
  // Prefer cookie-based validation via Supabase SSR on the incoming request
  if (request) {
    try {
      const res = NextResponse.next()
      const supa = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              res.cookies.set({ name, value, ...options })
            },
            remove(name: string, options: any) {
              res.cookies.set({ name, value: '', ...options })
            },
          },
        }
      )
      const { data, error } = await supa.auth.getUser()
      if (error || !data?.user) throw new Error('UNAUTHENTICATED')
      const user = data.user
      return { id: user.id, email: user.email ?? undefined, user_metadata: user.user_metadata }
    } catch (e) {
      // fall through to admin-token path
    }
  }

  // Fallback: validate using service role if Authorization header provided
  if (!supabaseAdmin) throw new Error('UNAUTHENTICATED')
  const authHeader = request?.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) throw new Error('UNAUTHENTICATED')
    const u = data.user
    return { id: u.id, email: u.email ?? undefined, user_metadata: u.user_metadata }
  }
  throw new Error('UNAUTHENTICATED')
}

// Auth state change listener
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}
