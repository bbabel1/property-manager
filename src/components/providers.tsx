'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { AuthError, Provider, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { buildOAuthRedirectUrl } from '@/lib/auth/redirect';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithMagicLink: (email: string) => Promise<AuthActionResult>;
  signInWithProvider: (
    provider: SupportedOAuthProvider,
    next?: string,
  ) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthActionResult = { error: AuthError | null };
type SupportedOAuthProvider = Extract<Provider, 'github'>;

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs
    // If you need to bypass auth for testing, use real Supabase authentication instead
    // The test mode bypass was returning fake user IDs that broke database queries
    // if (process.env.NEXT_PUBLIC_TEST_AUTH_BYPASS === 'true') {
    //   // Even in test mode, use real authentication
    // }

    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  };

  const signInWithProvider = async (provider: SupportedOAuthProvider, next?: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = buildOAuthRedirectUrl(origin, next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    loading,
    signIn,
    signInWithMagicLink,
    signInWithProvider,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Lightweight auth hook backed by Supabase auth
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a Providers');
  }
  return context;
}

// Export the context for direct access if needed
export { AuthContext };

export default Providers;
