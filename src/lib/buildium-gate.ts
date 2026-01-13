/**
 * Buildium Integration Gate
 *
 * This module provides the canonical way to check if Buildium integration is enabled.
 * All Buildium operations MUST pass through this gate before proceeding.
 *
 * Canonical Meaning of "Enabled":
 * - buildium_integrations.is_enabled = true
 * - Credentials exist (client_id_encrypted, client_secret_encrypted are set)
 * - deleted_at IS NULL
 *
 * Canonical Meaning of "Disabled":
 * - is_enabled = false (regardless of whether credentials are present)
 * - Do NOT let "credentials present" behave like "enabled"
 */

import { getOrgScopedBuildiumConfig } from './buildium/credentials-manager';
import { logger } from './logger';

export class BuildiumDisabledError extends Error {
  code = 'BUILDIUM_DISABLED' as const;
  status = 403;

  constructor(public orgId?: string) {
    super(
      orgId
        ? `Buildium integration is disabled for org ${orgId}`
        : 'Buildium integration is disabled',
    );
    this.name = 'BuildiumDisabledError';
  }
}

/**
 * Assert that Buildium integration is enabled for the given org.
 * Throws BuildiumDisabledError if disabled or unavailable.
 *
 * This is the only correct way to check enabled status in server routes.
 *
 * @param orgId - Organization ID (required for org-scoped checks)
 * @param context - Optional context string for logging
 * @throws BuildiumDisabledError if integration is disabled or unavailable
 */
export async function assertBuildiumEnabled(
  orgId: string | undefined,
  context?: string,
): Promise<void> {
  const config = await getOrgScopedBuildiumConfig(orgId);

  if (!config || !config.isEnabled) {
    logger.warn({ orgId, context }, 'Buildium integration disabled');
    throw new BuildiumDisabledError(orgId);
  }
}
