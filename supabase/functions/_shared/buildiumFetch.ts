/**
 * Buildium Fetch Wrapper for Edge Functions
 *
 * This wrapper ensures that:
 * 1. Buildium integration is enabled before making API calls
 * 2. All Buildium fetch calls go through this wrapper (enforced by egress guard)
 * 3. Egress-allowed header is set to allow the request through
 */

import { assertBuildiumEnabledEdge } from './buildiumGate.ts';

type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string };

function resolveBuildiumCredentials(
  input?: Partial<BuildiumCredentials> | null,
): BuildiumCredentials {
  const baseUrl = (
    input?.baseUrl ||
    Deno.env.get('BUILDIUM_BASE_URL') ||
    'https://apisandbox.buildium.com/v1'
  ).replace(/\/$/, '');
  const clientId = (input?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || '').trim();
  const clientSecret = (input?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || '').trim();
  return { baseUrl, clientId, clientSecret };
}

/**
 * Buildium fetch wrapper for edge functions
 *
 * Checks that integration is enabled, then makes the fetch call with proper headers.
 *
 * @param supabase - Supabase admin client
 * @param orgId - Organization ID (required)
 * @param method - HTTP method
 * @param path - API path (e.g., '/rentals')
 * @param body - Request body (optional)
 * @param credentials - Credentials from request body or env (optional)
 * @returns Response from Buildium API
 */
export async function buildiumFetchEdge(
  supabase: any,
  orgId: string,
  method: string,
  path: string,
  body?: unknown,
  credentials?: Partial<BuildiumCredentials>,
  init?: RequestInit,
): Promise<Response> {
  // Assert enabled first
  await assertBuildiumEnabledEdge(supabase, orgId);

  // Get credentials from request body or env
  const creds = resolveBuildiumCredentials(credentials);

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error('Buildium credentials not provided');
  }

  const baseUrl = creds.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;

  const mergedHeaders = new Headers(init?.headers || {});
  mergedHeaders.set('Accept', 'application/json');
  mergedHeaders.set('Content-Type', 'application/json');
  mergedHeaders.set('X-Buildium-Client-Id', creds.clientId);
  mergedHeaders.set('X-Buildium-Client-Secret', creds.clientSecret);
  mergedHeaders.set('x-buildium-egress-allowed', '1'); // Required for egress guard

  return await fetch(url, {
    method,
    ...init,
    headers: mergedHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}
