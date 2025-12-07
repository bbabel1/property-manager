/**
 * Gmail OAuth Utilities
 * 
 * Handles OAuth state management and URL generation for Google OAuth flow.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

const STATE_COOKIE_NAME = 'gmail_oauth_state';
const STATE_COOKIE_MAX_AGE = 5 * 60; // 5 minutes

/**
 * Generate a cryptographically secure state token
 */
export function generateStateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store OAuth state in HTTP-only cookie
 */
export async function setOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Use Lax so the state cookie is sent on the OAuth redirect back from accounts.google.com
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Get and validate OAuth state from cookie
 */
export async function getOAuthState(): Promise<string | null> {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME);
  return stateCookie?.value || null;
}

/**
 * Clear OAuth state cookie
 */
export async function clearOAuthState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE_NAME);
}

/**
 * Build Google OAuth authorization URL
 */
export function buildGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`;

  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
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
  const configuredUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`;
  return redirectUri === configuredUri;
}

