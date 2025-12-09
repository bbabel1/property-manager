/**
 * Google Calendar OAuth Callback
 * 
 * GET /api/auth/calendar/callback
 * Handles Google OAuth callback and stores tokens
 */

import { handleGoogleOAuthCallback } from '@/lib/google/oauth-callback';

export async function GET(request: Request) {
  return handleGoogleOAuthCallback(request);
}
