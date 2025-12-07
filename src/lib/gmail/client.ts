/**
 * Gmail API Client
 * 
 * Wrapper for Gmail API operations with automatic token refresh.
 */

import { google } from 'googleapis';
import { getStaffGmailIntegration, getAccessToken, type GmailIntegration } from './token-manager';

/**
 * Get authenticated Gmail client for a user
 */
export async function getGmailClient(userId: string, orgId: string) {
  const integration = await getStaffGmailIntegration(userId, orgId);
  
  if (!integration) {
    throw new Error('Gmail integration not found. Please connect your Gmail account.');
  }

  if (!integration.is_active) {
    throw new Error('Gmail integration is inactive. Please reconnect your Gmail account.');
  }

  // Get access token (will auto-refresh if needed)
  const accessToken = await getAccessToken(integration);

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Return Gmail API client
  return google.gmail({ version: 'v1', auth: oauth2Client });
}


