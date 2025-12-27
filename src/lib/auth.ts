import { supabase } from './db';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  user_metadata?: any;
  app_metadata?: any;
}

// Client-side auth utilities
export const auth = {
  // Sign up
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  // Sign in with email/password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Sign in with magic link
  async signInWithMagicLink(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
    });
    return { data, error };
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current user
  async getUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  },

  // Get current session
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    return { session, error };
  },
};

// Server-side auth utilities (for API routes only)
export async function requireUser(request?: NextRequest): Promise<AuthenticatedUser> {
  // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs
  // If you need to bypass auth for testing, use real Supabase authentication instead
  // if (process.env.TEST_AUTH_BYPASS === 'true') {
  //   // Even in test mode, we should use real user authentication
  //   // The test mode bypass was causing issues with invalid UUIDs
  // }

  if (!request) {
    throw new Error('UNAUTHENTICATED');
  }

  const encodedUserHeader = request.headers.get('x-auth-user');
  if (encodedUserHeader) {
    try {
      const decoded = JSON.parse(decodeURIComponent(encodedUserHeader));
      if (decoded?.id) {
        return {
          id: String(decoded.id),
          email: typeof decoded.email === 'string' ? decoded.email : undefined,
          user_metadata: decoded.user_metadata ?? undefined,
          app_metadata: decoded.app_metadata ?? undefined,
        };
      }
    } catch (error) {
      console.warn('Failed to parse x-auth-user header:', error);
    }
  }

  // First, try Bearer token authentication (for client-side fetches)
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        // Validate token by calling Supabase auth API
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const user = await response.json();
          if (user?.id) {
            return {
              id: user.id,
              email: user.email ?? undefined,
              user_metadata: user.user_metadata,
              app_metadata: user.app_metadata,
            };
          }
        } else {
          // Bearer token validation failed - this is expected when token is expired
          // We'll fall back to cookie-based auth, so only log if cookies also fail
          // Silently continue to cookie-based auth fallback
        }
      } else {
        console.warn('Missing Supabase URL or anon key for Bearer token validation');
      }
	    } catch {
      // Bearer token validation error - fall through to cookie-based auth
      // This is expected when token is expired, don't log it
    }
  }

  // Fallback: cookie-based validation via Supabase SSR
  // Use cookies() from next/headers for better compatibility with API routes
  const res = NextResponse.next();

  // Helper to get cookie value from multiple sources
  const getCookieValue = (name: string): string | undefined => {
    // Try next/headers cookies first (preferred for API routes)
    try {
      // Note: cookies() is async and must be awaited, but we can't await in a getter
      // So we'll use request.cookies as primary source and cookies() as fallback
      const cookieValue = request.cookies.get(name)?.value;
      if (cookieValue) return cookieValue;
    } catch {
      // Ignore errors from request.cookies
    }
    return undefined;
  };

  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return getCookieValue(name);
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Try to get user - this will automatically refresh from cookies if possible
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) {
    // Both Bearer token and cookie-based auth failed
    // This means the session is fully expired and user needs to refresh page or sign in
    throw new Error('UNAUTHENTICATED');
  }

  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
    user_metadata: data.user.user_metadata,
    app_metadata: data.user.app_metadata,
  };
}

// Auth state change listener
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}
