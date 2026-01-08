/**
 * Buildium Credentials Manager
 * 
 * CRITICAL: This is the ONLY place that should read process.env.BUILDIUM_* variables.
 * All Buildium operations must flow through this service.
 * 
 * Provides org-scoped credential management with:
 * - Database-backed credentials (encrypted)
 * - Environment variable fallback (for backward compatibility)
 * - In-memory caching with staleness detection
 * - Base URL validation
 * - Secret masking for audit logs and API responses
 */

import { supabaseAdmin } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/gmail/token-encryption';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

// Type definitions
export type BuildiumConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  isEnabled: boolean;
  orgId?: string;
  updatedAt?: string; // For cache staleness detection
};

export type BuildiumCredentials = {
  clientId?: string; // Optional, use "unchanged" flag
  clientSecret?: string; // Optional, use "unchanged" flag
  baseUrl?: string; // Optional, use "unchanged" flag
  webhookSecret?: string; // Optional, use "unchanged" flag
  isEnabled?: boolean;
  unchangedFields?: ('clientId' | 'clientSecret' | 'baseUrl' | 'webhookSecret')[]; // Explicit unchanged markers
};

export type BuildiumConfigError =
  | { code: 'missing_org'; message: string }
  | { code: 'disabled'; message: string }
  | { code: 'no_credentials'; message: string }
  | { code: 'invalid_base_url'; message: string }
  | { code: 'auth_failed'; message: string }
  | { code: 'network_error'; message: string }
  | { code: 'rate_limited'; message: string };

type CacheEntry = {
  config: BuildiumConfig;
  expiresAt: number;
  updatedAt: string;
};

// In-memory cache: Map<orgId, CacheEntry>
const configCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESERVED_ENV_CACHE_KEY = '__env__';

/**
 * Validate Buildium base URL against allowlist
 * Extracts hostname via URL parsing (handles protocol, trailing slash, query strings)
 */
export function validateBuildiumBaseUrl(url: string): boolean {
  try {
    // Handle URLs with or without protocol
    let urlToParse = url.trim();
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      urlToParse = `https://${urlToParse}`;
    }

    const parsedUrl = new URL(urlToParse);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Allowlist: apisandbox.buildium.com, api.buildium.com
    const allowedHostnames = ['apisandbox.buildium.com', 'api.buildium.com'];

    // In test environments, allow any host to enable fixture/mocked URLs.
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    return allowedHostnames.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Mask secret for display in logs and API responses
 * Returns format: cli_***123 (first 3 chars + last 3 chars)
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length <= 6) {
    return '***';
  }
  const first = secret.substring(0, 3);
  const last = secret.substring(secret.length - 3);
  return `${first}***${last}`;
}

/**
 * Get org-scoped Buildium configuration
 * CENTRAL CHOKE POINT - This is the ONLY way to get Buildium credentials
 * 
 * @param orgId - Organization ID (undefined for system jobs)
 * @param forceRefresh - Bypass cache and force refresh from DB
 * @returns BuildiumConfig or null if unavailable/disabled
 */
export async function getOrgScopedBuildiumConfig(
  orgId?: string,
  forceRefresh = false
): Promise<BuildiumConfig | null> {
  const cacheKey = orgId || RESERVED_ENV_CACHE_KEY;

  // Check cache first (unless forceRefresh)
  if (!forceRefresh) {
    const cached = configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Verify cache staleness by checking DB updated_at if orgId provided
      if (orgId) {
        try {
          const { data: dbRow } = await supabaseAdmin
            .from('buildium_integrations')
            .select('updated_at')
            .eq('org_id', orgId)
            .is('deleted_at', null)
            .maybeSingle();

          // If DB row exists and updated_at differs, cache is stale
          if (dbRow && dbRow.updated_at !== cached.updatedAt) {
            logger.info({ orgId, cachedUpdatedAt: cached.updatedAt, dbUpdatedAt: dbRow.updated_at }, 'Buildium config cache stale, refreshing');
            configCache.delete(cacheKey);
          } else {
            // Cache is valid
            return cached.config;
          }
        } catch (error) {
          logger.warn({ orgId, error }, 'Failed to check cache staleness, using cached config');
          return cached.config;
        }
      } else {
        // For env fallback, cache is valid
        return cached.config;
      }
    }
  }

  // Try DB first (if orgId provided)
  if (orgId) {
    try {
      const { data: dbRow, error } = await supabaseAdmin
        .from('buildium_integrations')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        logger.error({ orgId, error }, 'Failed to fetch Buildium credentials from DB');
      } else if (dbRow) {
        // Check if enabled
        if (!dbRow.is_enabled) {
          logger.info({ orgId }, 'Buildium integration disabled for org');
          return null;
        }

        // Decrypt credentials
        try {
          const config: BuildiumConfig = {
            baseUrl: dbRow.base_url,
            clientId: decryptToken(dbRow.client_id_encrypted),
            clientSecret: decryptToken(dbRow.client_secret_encrypted),
            webhookSecret: decryptToken(dbRow.webhook_secret_encrypted),
            isEnabled: dbRow.is_enabled,
            orgId: dbRow.org_id,
            updatedAt: dbRow.updated_at,
          };

          // Validate base_url
          if (!validateBuildiumBaseUrl(config.baseUrl)) {
            logger.error({ orgId, baseUrl: config.baseUrl }, 'Invalid Buildium base_url in DB');
            return null;
          }

          // Cache the config
          configCache.set(cacheKey, {
            config,
            expiresAt: Date.now() + CACHE_TTL_MS,
            updatedAt: dbRow.updated_at,
          });

          return config;
        } catch (decryptError) {
          logger.error({ orgId, error: decryptError }, 'Failed to decrypt Buildium credentials');
          return null;
        }
      }
    } catch (error) {
      logger.error({ orgId, error }, 'Error fetching Buildium credentials from DB');
    }
  }

  // Fallback to environment variables (for backward compatibility)
  let envBaseUrl = process.env.BUILDIUM_BASE_URL;
  let envClientId = process.env.BUILDIUM_CLIENT_ID;
  let envClientSecret = process.env.BUILDIUM_CLIENT_SECRET;
  let envWebhookSecret = process.env.BUILDIUM_WEBHOOK_SECRET;

  // Test-only fallback: if env vars are missing under NODE_ENV=test, provide harmless defaults
  if (process.env.NODE_ENV === 'test') {
    envBaseUrl = envBaseUrl || 'https://apisandbox.buildium.com';
    envClientId = envClientId || 'test-client-id';
    envClientSecret = envClientSecret || 'test-client-secret';
    envWebhookSecret = envWebhookSecret || 'test-webhook-secret';
  }

  if (envBaseUrl && envClientId && envClientSecret && envWebhookSecret) {
    // Validate base_url
    if (!validateBuildiumBaseUrl(envBaseUrl)) {
      logger.error({ baseUrl: envBaseUrl }, 'Invalid Buildium base_url in env vars');
      return null;
    }

    const config: BuildiumConfig = {
      baseUrl: envBaseUrl,
      clientId: envClientId,
      clientSecret: envClientSecret,
      webhookSecret: envWebhookSecret,
      isEnabled: true, // Env vars are always enabled
    };

    // Cache the env config
    configCache.set(cacheKey, {
      config,
      expiresAt: Date.now() + CACHE_TTL_MS,
      updatedAt: new Date().toISOString(),
    });

    // Log warning if orgId is undefined (for observability)
    if (!orgId) {
      logger.warn('Buildium call without orgId, using env fallback');
    }

    return config;
  }

  // No credentials available
  if (orgId) {
    logger.error({ orgId }, 'Buildium credentials missing for org (no DB record or env vars)');
  } else {
    logger.error('Buildium credentials missing (no env vars)');
  }

  return null;
}

/**
 * Store Buildium credentials for an organization
 */
export async function storeBuildiumCredentials(
  orgId: string,
  credentials: BuildiumCredentials,
  actorUserId: string
): Promise<void> {
  // Validate base_url if provided
  if (credentials.baseUrl && !validateBuildiumBaseUrl(credentials.baseUrl)) {
    throw new Error('Invalid base_url: must be apisandbox.buildium.com or api.buildium.com');
  }

  // Get existing record to preserve unchanged fields
  const { data: existing } = await supabaseAdmin
    .from('buildium_integrations')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  // Prepare update data
  const updateData: Record<string, any> = {
    org_id: orgId,
    is_enabled: credentials.isEnabled ?? existing?.is_enabled ?? false,
    updated_at: new Date().toISOString(),
  };

  // Handle base_url
  if (credentials.baseUrl) {
    updateData.base_url = credentials.baseUrl;
  } else if (existing?.base_url) {
    updateData.base_url = existing.base_url;
  } else {
    throw new Error('base_url is required');
  }

  // Handle client_id
  if (credentials.clientId) {
    updateData.client_id_encrypted = encryptToken(credentials.clientId);
  } else if (existing?.client_id_encrypted && credentials.unchangedFields?.includes('clientId')) {
    updateData.client_id_encrypted = existing.client_id_encrypted;
  } else if (!existing) {
    throw new Error('clientId is required for new integration');
  }

  // Handle client_secret
  if (credentials.clientSecret) {
    updateData.client_secret_encrypted = encryptToken(credentials.clientSecret);
  } else if (existing?.client_secret_encrypted && credentials.unchangedFields?.includes('clientSecret')) {
    updateData.client_secret_encrypted = existing.client_secret_encrypted;
  } else if (!existing) {
    throw new Error('clientSecret is required for new integration');
  }

  // Handle webhook_secret (track rotation)
  const webhookSecretChanged = credentials.webhookSecret && credentials.webhookSecret !== (existing ? decryptToken(existing.webhook_secret_encrypted) : null);
  if (credentials.webhookSecret) {
    updateData.webhook_secret_encrypted = encryptToken(credentials.webhookSecret);
    if (webhookSecretChanged) {
      updateData.webhook_secret_rotated_at = new Date().toISOString();
    }
  } else if (existing?.webhook_secret_encrypted && credentials.unchangedFields?.includes('webhookSecret')) {
    updateData.webhook_secret_encrypted = existing.webhook_secret_encrypted;
  } else if (!existing) {
    throw new Error('webhookSecret is required for new integration');
  }

	  // Insert or update (avoid ON CONFLICT to work without a unique index in dev)
	  const action: 'INSERT' | 'UPDATE' = existing ? 'UPDATE' : 'INSERT';
	  if (existing) {
	    const updatePayload = updateData as Database['public']['Tables']['buildium_integrations']['Update'];
	    const { data: updated, error } = await supabaseAdmin
      .from('buildium_integrations')
      .update(updatePayload)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .select()
      .maybeSingle();
	
	    if (error || !updated) {
	      throw new Error(`Failed to store Buildium credentials: ${error?.message || 'Unknown error'}`);
	    }
	  } else {
	    const insertPayload = updateData as Database['public']['Tables']['buildium_integrations']['Insert'];
	    const { data: inserted, error } = await supabaseAdmin
      .from('buildium_integrations')
      .insert({
        ...insertPayload,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
	
	    if (error || !inserted) {
	      throw new Error(`Failed to store Buildium credentials: ${error?.message || 'Unknown error'}`);
	    }
	  }

  // Write audit log with masked secrets
  const maskedChanges: Record<string, any> = {};
  if (credentials.clientId) maskedChanges.client_id = maskSecret(credentials.clientId);
  if (credentials.clientSecret) maskedChanges.client_secret = maskSecret(credentials.clientSecret);
  if (credentials.baseUrl) maskedChanges.base_url = credentials.baseUrl;
  if (credentials.webhookSecret) maskedChanges.webhook_secret = maskSecret(credentials.webhookSecret);
  if (credentials.isEnabled !== undefined) maskedChanges.is_enabled = credentials.isEnabled;

  await supabaseAdmin.from('buildium_integration_audit_log').insert({
    org_id: orgId,
    actor_user_id: actorUserId,
    action,
    field_changes: maskedChanges,
  });

  // Invalidate cache
  configCache.delete(orgId);
}

/**
 * Delete Buildium credentials (soft delete)
 */
export async function deleteBuildiumCredentials(orgId: string, actorUserId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('buildium_integrations')
    .update({
      deleted_at: new Date().toISOString(),
      is_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to delete Buildium credentials: ${error.message}`);
  }

  // Write audit log
  await supabaseAdmin.from('buildium_integration_audit_log').insert({
    org_id: orgId,
    actor_user_id: actorUserId,
    action: 'DELETE',
    field_changes: {},
  });

  // Invalidate cache
  configCache.delete(orgId);
}

/**
 * Toggle Buildium integration enable/disable
 */
export async function toggleBuildiumIntegration(
  orgId: string,
  enabled: boolean,
  actorUserId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('buildium_integrations')
    .update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to toggle Buildium integration: ${error.message}`);
  }

  // Write audit log
  await supabaseAdmin.from('buildium_integration_audit_log').insert({
    org_id: orgId,
    actor_user_id: actorUserId,
    action: enabled ? 'ENABLE' : 'DISABLE',
    field_changes: { is_enabled: enabled },
  });

  // Invalidate cache
  configCache.delete(orgId);
}

/**
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(
  orgId: string,
  newSecret: string,
  actorUserId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('buildium_integrations')
    .update({
      webhook_secret_encrypted: encryptToken(newSecret),
      webhook_secret_rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to rotate webhook secret: ${error.message}`);
  }

  // Write audit log
  await supabaseAdmin.from('buildium_integration_audit_log').insert({
    org_id: orgId,
    actor_user_id: actorUserId,
    action: 'UPDATE',
    field_changes: { webhook_secret: maskSecret(newSecret) },
  });

  // Invalidate cache
  configCache.delete(orgId);
}

/**
 * Test Buildium connection
 * Throttled per-org (1 request per minute)
 */
export async function testBuildiumConnection(orgId: string): Promise<{ success: boolean; error?: BuildiumConfigError }> {
  // Check throttling (1 request per minute per org)
  const { data: existing } = await supabaseAdmin
    .from('buildium_integrations')
    .select('last_tested_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing?.last_tested_at) {
    const lastTested = new Date(existing.last_tested_at);
    const now = new Date();
    const minutesSinceLastTest = (now.getTime() - lastTested.getTime()) / 1000 / 60;

    if (minutesSinceLastTest < 1) {
      return {
        success: false,
        error: {
          code: 'rate_limited',
          message: 'Test connection rate limited. Please wait 1 minute between tests.',
        },
      };
    }
  }

  // Get config
  const config = await getOrgScopedBuildiumConfig(orgId, true); // Force refresh for test
  if (!config) {
    return {
      success: false,
      error: {
        code: 'no_credentials',
        message: 'Buildium credentials not configured for this organization',
      },
    };
  }

  if (!config.isEnabled) {
    return {
      success: false,
      error: {
        code: 'disabled',
        message: 'Buildium integration is disabled for this organization',
      },
    };
  }

  // Make test API call to Buildium (e.g., /account-info endpoint)
  try {
    // Use a lightweight endpoint to validate credentials
    const normalizedBase = config.baseUrl.replace(/\/+$/, '');
    const testUrl = `${normalizedBase}/users`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': config.clientId,
        'x-buildium-client-secret': config.clientSecret,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Update audit log
        await supabaseAdmin.from('buildium_integration_audit_log').insert({
          org_id: orgId,
          actor_user_id: '00000000-0000-0000-0000-000000000000', // System user
          action: 'TEST_CONNECTION',
          test_result: 'auth_failed',
        });

        return {
          success: false,
          error: {
            code: 'auth_failed',
            message: 'Authentication failed. Please check your Client ID and Client Secret.',
          },
        };
      }

      // Update audit log
      await supabaseAdmin.from('buildium_integration_audit_log').insert({
        org_id: orgId,
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        action: 'TEST_CONNECTION',
        test_result: 'network_error',
      });

      return {
        success: false,
        error: {
          code: 'network_error',
          message: `Buildium API returned error: ${response.status} ${response.statusText}`,
        },
      };
    }

    // Success - update last_tested_at
    await supabaseAdmin
      .from('buildium_integrations')
      .update({
        last_tested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .is('deleted_at', null);

    // Update audit log
    await supabaseAdmin.from('buildium_integration_audit_log').insert({
      org_id: orgId,
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      action: 'TEST_CONNECTION',
      test_result: 'success',
    });

    // Invalidate cache to refresh last_tested_at
    configCache.delete(orgId);

    return { success: true };
  } catch (error: any) {
    // Network error
    await supabaseAdmin.from('buildium_integration_audit_log').insert({
      org_id: orgId,
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      action: 'TEST_CONNECTION',
      test_result: 'network_error',
    });

    return {
      success: false,
      error: {
        code: 'network_error',
        message: `Network error: ${error.message || 'Failed to connect to Buildium API'}`,
      },
    };
  }
}
