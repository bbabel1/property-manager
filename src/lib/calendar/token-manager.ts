/**
 * Google Calendar Token Manager
 * 
 * Handles token storage, retrieval, and refresh for Google Calendar integrations.
 */

import { supabaseAdmin } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/gmail/token-encryption';

export interface GoogleCalendarIntegration {
  id: string;
  staff_id: number;
  user_id: string;
  org_id: string;
  email: string;
  calendar_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string;
  scope: string;
  is_active: boolean;
}

/**
 * Get active Google Calendar integration for a staff user
 */
export async function getStaffCalendarIntegration(
  userId: string,
  orgId: string
): Promise<GoogleCalendarIntegration | null> {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as GoogleCalendarIntegration;
}

/**
 * Get decrypted access token, refreshing if needed
 */
export async function getAccessToken(integration: GoogleCalendarIntegration): Promise<string> {
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const bufferMinutes = 5; // Refresh if expiring within 5 minutes

  // Check if token needs refresh
  if (expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000) {
    await refreshAccessToken(integration);
    // Fetch updated integration
    const updated = await getStaffCalendarIntegration(integration.user_id, integration.org_id);
    if (!updated) {
      throw new Error('Failed to refresh token');
    }
    integration = updated;
  }

  return decryptToken(integration.access_token_encrypted);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(integration: GoogleCalendarIntegration): Promise<void> {
  if (!integration.refresh_token_encrypted) {
    throw new Error('No refresh token available. Please reconnect your Google Calendar account.');
  }

  const refreshToken = decryptToken(integration.refresh_token_encrypted);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  // Request new access token from Google
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Token refresh failed:', error);
    
    // If refresh token is invalid, deactivate integration
    if (response.status === 400) {
      await supabaseAdmin
        .from('google_calendar_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
    }
    
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600; // Default to 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Update integration with new token
  await supabaseAdmin
    .from('google_calendar_integrations')
    .update({
      access_token_encrypted: encryptToken(newAccessToken),
      refresh_token_encrypted: data.refresh_token 
        ? encryptToken(data.refresh_token) 
        : integration.refresh_token_encrypted, // Keep existing if not provided
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);
}

/**
 * Store Google Calendar integration tokens
 */
export async function storeCalendarIntegration(
  staffId: number,
  userId: string,
  orgId: string,
  email: string,
  calendarId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
  scope: string
): Promise<GoogleCalendarIntegration> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Check if existing integration exists to preserve refresh token
  const { data: existing } = await supabaseAdmin
    .from('google_calendar_integrations')
    .select('refresh_token_encrypted')
    .eq('staff_id', staffId)
    .eq('org_id', orgId)
    .maybeSingle();

  // Preserve existing refresh token if new one not provided
  let refreshTokenEncrypted: string | null = null;
  if (refreshToken) {
    refreshTokenEncrypted = encryptToken(refreshToken);
  } else if (existing?.refresh_token_encrypted) {
    refreshTokenEncrypted = existing.refresh_token_encrypted; // Preserve existing
  }

  const integrationData = {
    staff_id: staffId,
    user_id: userId,
    org_id: orgId,
    email,
    calendar_id: calendarId,
    access_token_encrypted: encryptToken(accessToken),
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: expiresAt.toISOString(),
    scope,
    is_active: true,
  };

  // Upsert integration (update if exists, insert if not)
  const { data, error } = await supabaseAdmin
    .from('google_calendar_integrations')
    .upsert(integrationData, {
      onConflict: 'staff_id,org_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to store Google Calendar integration: ${error?.message || 'Unknown error'}`);
  }

  return data as GoogleCalendarIntegration;
}

/**
 * Delete Google Calendar integration (soft delete)
 */
export async function deleteCalendarIntegration(integrationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('google_calendar_integrations')
    .update({ is_active: false })
    .eq('id', integrationId);

  if (error) {
    throw new Error(`Failed to delete Google Calendar integration: ${error.message}`);
  }
}

