/**
 * Google OAuth Callback (Unified)
 *
 * GET /api/auth/google/callback
 * Delegates to shared Google OAuth callback handler.
 */

import { handleGoogleOAuthCallback } from '@/lib/google/oauth-callback';

export async function GET(request: Request) {
  return handleGoogleOAuthCallback(request);
}
