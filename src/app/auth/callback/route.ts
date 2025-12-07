import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resolvePostAuthRedirect } from '@/lib/auth/redirect';
import type { Database } from '@/types/database';

const SIGNIN_ROUTE = '/auth/signin';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = resolvePostAuthRedirect(requestUrl.searchParams.get('next'));
  const origin = requestUrl.origin;

  if (!code) {
    const errorUrl = new URL(SIGNIN_ROUTE, origin);
    errorUrl.searchParams.set('error', 'missing_oauth_code');
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables for OAuth exchange');
    const errorUrl = new URL(SIGNIN_ROUTE, origin);
    errorUrl.searchParams.set('error', 'oauth_exchange_failed');
    return NextResponse.redirect(errorUrl);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.warn('Supabase OAuth session exchange failed', { message: error.message });
    const errorUrl = new URL(SIGNIN_ROUTE, origin);
    errorUrl.searchParams.set('error', 'oauth_exchange_failed');
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}







