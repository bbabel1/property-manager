// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Remote module shims for Deno type checking (see https://typescript-eslint.io/rules/triple-slash-reference/)
/// <reference path="../../../types/deno-remotes.d.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Deno globals for Edge runtime (see https://typescript-eslint.io/rules/triple-slash-reference/)
/// <reference path="../../../types/deno.d.ts" />
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

export const BUILDIUM_DISABLED_CODE = 'BUILDIUM_DISABLED' as const;

export class BuildiumDisabledEdgeError extends Error {
  code = BUILDIUM_DISABLED_CODE;
  status = 403;
  constructor(public orgId?: string) {
    super(
      orgId
        ? `Buildium integration is disabled for org ${orgId}`
        : 'Buildium integration is disabled',
    );
    this.name = 'BuildiumDisabledEdgeError';
  }
}

export function buildiumDisabledResponse(
  headers?: HeadersInit,
  message?: string,
  code: string = BUILDIUM_DISABLED_CODE,
): Response {
  return new Response(JSON.stringify({ error: { code, message: message || 'Buildium integration is disabled' } }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });
}

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
  supabase: SupabaseClient,
  orgId: string | undefined,
): Promise<void> {
  if (!orgId) {
    throw new BuildiumDisabledEdgeError('unknown');
  }

  const { data, error } = await supabase
    .from('buildium_integrations')
    .select('is_enabled')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data || data.is_enabled !== true) {
    throw new BuildiumDisabledEdgeError(orgId);
  }
}
import type { SupabaseClient } from '@supabase/supabase-js';
