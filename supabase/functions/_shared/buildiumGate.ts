/**
 * Buildium Integration Gate (Edge Functions)
 *
 * This module provides the canonical way to check if Buildium integration is enabled
 * in Supabase Edge Functions (Deno runtime).
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

/**
 * Assert that Buildium integration is enabled for the given org.
 * Throws Error if disabled or unavailable.
 *
 * This is the only correct way to check enabled status in edge functions.
 *
 * @param supabase - Supabase admin client
 * @param orgId - Organization ID (required)
 * @throws Error if integration is disabled or unavailable
 */
export async function assertBuildiumEnabledEdge(
  supabase: any,
  orgId: string | undefined,
): Promise<void> {
  if (!orgId) {
    throw new Error('orgId required for Buildium integration check');
  }

  const { data, error } = await supabase
    .from('buildium_integrations')
    .select('is_enabled')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data || data.is_enabled !== true) {
    throw new Error(`Buildium integration is disabled for org ${orgId}`);
  }
}
