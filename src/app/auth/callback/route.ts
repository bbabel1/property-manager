import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/ssr';
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

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.warn('Supabase OAuth session exchange failed', { message: error.message });
    const errorUrl = new URL(SIGNIN_ROUTE, origin);
    errorUrl.searchParams.set('error', 'oauth_exchange_failed');
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
