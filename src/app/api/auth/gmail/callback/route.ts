/**
 * Gmail OAuth Callback
 *
 * GET /api/auth/gmail/callback
 * Handles Google OAuth callback and stores tokens
 */

import { handleGoogleOAuthCallback } from '@/lib/google/oauth-callback';

export async function GET(request: Request) {
  return handleGoogleOAuthCallback(request);
}
