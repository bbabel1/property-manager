/**
 * Google OAuth Utilities
 *
 * Shared helpers for Gmail and Calendar OAuth flows.
 * Supports a unified state cookie and per-flow scopes/redirects while
 * allowing legacy redirect URIs during migration.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

export type GoogleOAuthFlow = 'gmail' | 'calendar';

interface OAuthStatePayload {
  state: string;
  userId: string;
  flow: GoogleOAuthFlow;
  createdAt: number;
}

const STATE_COOKIE_NAME = 'google_oauth_state';
const STATE_COOKIE_MAX_AGE = 5 * 60; // 5 minutes

const FLOW_SCOPES: Record<GoogleOAuthFlow, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',
  ],
};

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Generate a cryptographically secure state token.
 */
export function generateStateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store OAuth state in HTTP-only cookie with user and flow context.
 */
export async function setOAuthState(payload: OAuthStatePayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Needed for accounts.google.com redirect back.
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Get and validate OAuth state from cookie for current user.
 */
export async function getOAuthState(userId: string): Promise<OAuthStatePayload | null> {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME);

  if (!stateCookie?.value) {
    return null;
  }

  try {
    const parsed: OAuthStatePayload = JSON.parse(stateCookie.value);
    if (parsed.userId !== userId) return null;

    const age = Date.now() - parsed.createdAt;
    if (age > STATE_COOKIE_MAX_AGE * 1000) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear OAuth state cookie.
 */
export async function clearOAuthState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE_NAME);
}

/**
 * Resolve redirect URI for a given flow.
 * - Prefer a single GOOGLE_OAUTH_REDIRECT_URI (intended unified callback).
 * - Allow flow-specific override for Calendar to preserve existing tokens.
 * - Fall back to unified /api/auth/google/callback for local defaults.
 */
export function resolveRedirectUri(flow: GoogleOAuthFlow): string {
  const appUrl = getAppUrl();
  const unifiedDefault = `${appUrl}/api/auth/google/callback`;

  if (flow === 'calendar' && process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI;
  }

  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  return unifiedDefault;
}

/**
 * List allowed redirect URIs for validation.
 * Includes unified default and legacy per-flow callbacks to keep existing refresh tokens working.
 */
export function allowedRedirectUris(flow: GoogleOAuthFlow): string[] {
  const appUrl = getAppUrl();
  const defaults = [
    `${appUrl}/api/auth/google/callback`,
    `${appUrl}/api/auth/gmail/callback`,
    `${appUrl}/api/auth/calendar/callback`,
  ];

  const envUris = [
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
    flow === 'calendar' ? process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI : undefined,
  ].filter(Boolean) as string[];

  return Array.from(new Set([...envUris, ...defaults]));
}

/**
 * Validate redirect URI matches configured/allowed values.
 */
export function validateRedirectUri(flow: GoogleOAuthFlow, redirectUri: string): boolean {
  return allowedRedirectUris(flow).includes(redirectUri);
}

/**
 * Build Google OAuth authorization URL for the given flow.
 */
export function buildGoogleOAuthUrl(flow: GoogleOAuthFlow, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = resolveRedirectUri(flow);

  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
  }

  const scopes = FLOW_SCOPES[flow].join(' ');

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
 * Expose scopes for callers that need them for debugging/auditing.
 */
export function getScopesForFlow(flow: GoogleOAuthFlow): string[] {
  return FLOW_SCOPES[flow];
}
