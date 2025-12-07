/**
 * Google Calendar OAuth Utilities
 * 
 * Handles OAuth state management and URL generation for Google Calendar OAuth flow.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

const STATE_COOKIE_NAME = 'calendar_oauth_state';
const STATE_COOKIE_MAX_AGE = 5 * 60; // 5 minutes

interface OAuthState {
  state: string;
  userId: string;
  timestamp: number;
}

/**
 * Generate a cryptographically secure state token
 */
export function generateStateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store OAuth state in HTTP-only cookie with user context
 */
export async function setOAuthState(state: string, userId: string): Promise<void> {
  const cookieStore = await cookies();
  const stateData: OAuthState = {
    state,
    userId,
    timestamp: Date.now(),
  };
  
  cookieStore.set(STATE_COOKIE_NAME, JSON.stringify(stateData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Use Lax so the state cookie is sent on the OAuth redirect back from accounts.google.com
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Get and validate OAuth state from cookie for current user
 */
export async function getOAuthState(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME);
  
  if (!stateCookie?.value) {
    return null;
  }

  try {
    const stateData: OAuthState = JSON.parse(stateCookie.value);
    
    // Validate user ID matches to prevent cross-user state reuse
    if (stateData.userId !== userId) {
      return null;
    }
    
    // Validate timestamp (not older than max age)
    const age = Date.now() - stateData.timestamp;
    if (age > STATE_COOKIE_MAX_AGE * 1000) {
      return null;
    }
    
    return stateData.state;
  } catch {
    return null;
  }
}

/**
 * Clear OAuth state cookie
 */
export async function clearOAuthState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE_NAME);
}

/**
 * Build Google OAuth authorization URL for Calendar
 */
export function buildGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  // Use a calendar-specific redirect to avoid clashing with Gmail's redirect config.
  const redirectUri = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendar/callback`;

  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline', // Required for refresh token
    prompt: 'consent', // Force consent screen to guarantee refresh token
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Validate redirect URI matches configured value
 */
export function validateRedirectUri(redirectUri: string): boolean {
  const configuredUri = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendar/callback`;
  return redirectUri === configuredUri;
}
