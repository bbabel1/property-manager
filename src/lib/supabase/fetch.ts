'use client';

import { getSupabaseBrowserClient } from './client';

const supabase = getSupabaseBrowserClient();

export async function fetchWithSupabaseAuth(input: RequestInfo, init: RequestInit = {}) {
  // First, try to get the current session (this doesn't validate the token)
  let {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // If we have a session, check if the token needs refreshing
  if (session?.access_token) {
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1] || '{}'));
      const expiresAt = payload.exp ? payload.exp * 1000 : 0;
      const now = Date.now();
      const bufferTime = 30 * 1000; // 30 second buffer to refresh proactively

      // If token is expired or expiring soon, refresh it
      if (expiresAt < now + bufferTime) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          // If refresh fails, the refresh token might be expired
          // Try getUser() as a last resort - it might handle refresh differently
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) {
            throw new Error(
              'Session expired. Please refresh the page or sign in again to continue.',
            );
          }
          // If getUser() succeeded, get the session again
          const {
            data: { session: newSession },
          } = await supabase.auth.getSession();
          if (newSession?.access_token) {
            session = newSession;
          } else {
            throw new Error(
              'Session expired. Please refresh the page or sign in again to continue.',
            );
          }
        } else if (refreshData?.session) {
          session = refreshData.session;
        }
      }
    } catch (parseErr) {
      // If parsing fails, try refresh anyway
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        // Last resort: try getUser()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error('Session expired. Please refresh the page or sign in again to continue.');
        }
        const {
          data: { session: newSession },
        } = await supabase.auth.getSession();
        if (newSession?.access_token) {
          session = newSession;
        } else {
          throw new Error('Session expired. Please refresh the page or sign in again to continue.');
        }
      } else if (refreshData?.session) {
        session = refreshData.session;
      }
    }
  }

  // If we don't have a session yet, try getUser() which may refresh automatically
  if (!session?.access_token) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      // Check if it's a token expiration error
      if (userError.message.includes('expired') || userError.message.includes('JWT')) {
        throw new Error('Session expired. Please refresh the page or sign in again to continue.');
      }
      throw new Error(`Authentication required: ${userError.message}`);
    }

    if (!user) {
      throw new Error('Authentication required: No user found');
    }

    // After getUser(), try to get the session again
    const {
      data: { session: newSession },
      error: newSessionError,
    } = await supabase.auth.getSession();

    if (newSessionError) {
      throw new Error(`Failed to get session: ${newSessionError.message}`);
    }

    if (!newSession?.access_token) {
      throw new Error('Session expired. Please refresh the page or sign in again to continue.');
    }

    session = newSession;
  }

  // Final verification the token isn't expired
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1] || '{}'));
    const expiresAt = payload.exp ? payload.exp * 1000 : 0;
    const now = Date.now();

    if (expiresAt < now) {
      // Token is still expired even after all refresh attempts
      throw new Error('Session expired. Please refresh the page or sign in again to continue.');
    }
  } catch (parseError) {
    // If we can't parse, assume it's invalid if it's an expired error
    if (parseError instanceof Error && parseError.message.includes('expired')) {
      throw parseError;
    }
    // If it's a parse error but token exists, continue anyway
    // (better to try than fail silently)
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}
