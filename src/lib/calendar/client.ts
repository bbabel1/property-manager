/**
 * Google Calendar API Client
 * 
 * Wrapper for Google Calendar API operations with automatic token refresh and rate limiting.
 */

import { google } from 'googleapis';
import { getStaffCalendarIntegration, getAccessToken, type GoogleCalendarIntegration } from './token-manager';
import { resolveRedirectUri } from '@/lib/google/oauth';

/**
 * Get authenticated Google Calendar client for a user
 */
export async function getCalendarClient(userId: string, orgId: string) {
  const integration = await getStaffCalendarIntegration(userId, orgId);
  
  if (!integration) {
    throw new Error('Google Calendar integration not found. Please connect your Google Calendar account.');
  }

  if (!integration.is_active) {
    throw new Error('Google Calendar integration is inactive. Please reconnect your Google Calendar account.');
  }

  // Get access token (will auto-refresh if needed)
  const accessToken = await getAccessToken(integration);

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    resolveRedirectUri('calendar')
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Return Calendar API client
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Retry with exponential backoff for rate-limited requests
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (error?.code === 429 || error?.response?.status === 429) {
        const retryAfter = error?.response?.headers?.['retry-after'];
        const delay = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Not a rate limit error or max retries reached
      throw error;
    }
  }
  
  throw lastError || new Error('Unknown error in rate limit retry');
}

/**
 * Format Google Calendar API errors consistently
 */
export function formatCalendarError(error: any): { code: string; message: string } {
  if (error?.code === 401 || error?.response?.status === 401) {
    return { code: 'UNAUTHORIZED', message: 'Google Calendar authentication failed. Please reconnect your account.' };
  }
  
  if (error?.code === 403 || error?.response?.status === 403) {
    return { code: 'FORBIDDEN', message: 'Access denied to Google Calendar. Please check your permissions.' };
  }
  
  if (error?.code === 429 || error?.response?.status === 429) {
    return { code: 'RATE_LIMIT_EXCEEDED', message: 'Google Calendar API rate limit exceeded. Please try again later.' };
  }
  
  if (error?.message) {
    return { code: 'CALENDAR_API_ERROR', message: error.message };
  }
  
  return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred with Google Calendar.' };
}
