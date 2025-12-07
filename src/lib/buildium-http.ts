// Minimal Buildium HTTP helper used by API routes to standardize headers and URLs
// CRITICAL: All Buildium credential access must flow through getOrgScopedBuildiumConfig
import { getOrgScopedBuildiumConfig } from './buildium/credentials-manager';
import { logger } from '@/lib/logger';

export type BuildiumMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Buildium HTTP fetch helper
 * 
 * BREAKING CHANGE: Now requires orgId parameter (or explicit undefined for system jobs)
 * All credential access flows through getOrgScopedBuildiumConfig (central choke point)
 * 
 * @param method - HTTP method
 * @param path - API path (e.g., '/rentals')
 * @param params - Query parameters
 * @param payload - Request body (for POST/PUT)
 * @param orgId - Organization ID (undefined for system jobs without org context)
 */
export async function buildiumFetch(
  method: BuildiumMethod,
  path: string,
  params?: Record<string, any>,
  payload?: any,
  orgId?: string | undefined
): Promise<{ ok: boolean; status: number; json?: any; errorText?: string }> {
  // Get credentials from central manager
  const config = await getOrgScopedBuildiumConfig(orgId);
  
  if (!config) {
    const errorMsg = orgId 
      ? `Buildium credentials not available for org ${orgId}`
      : 'Buildium credentials not available (no orgId provided and no env vars)';
    
    logger.error({ orgId }, errorMsg);
    return { 
      ok: false, 
      status: 0, 
      errorText: errorMsg 
    };
  }

  // Log warning if orgId is undefined (for observability)
  if (orgId === undefined) {
    logger.warn('Buildium call without orgId, using env fallback');
  }

  const base = config.baseUrl;
  const q = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.append(k, String(v))
    }
  }
  const queryString = q.toString().replace(/\+/g, '%20')
  const url = `${base}${path}${queryString ? `?${queryString}` : ''}`
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': config.clientId,
        'x-buildium-client-secret': config.clientSecret,
      },
      body: payload && method !== 'GET' ? JSON.stringify(payload) : undefined
    })
    const text = await res.text()
    let json: any
    try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
    if (res.ok) {
      console.log(`[Buildium] ${method} ${path} -> ${res.status}`, json?.Id ? { Id: json.Id } : json)
    } else {
      console.warn(`[Buildium] ${method} ${path} -> ${res.status}`, json ?? text)
    }
    return { ok: res.ok, status: res.status, json, errorText: res.ok ? undefined : text }
  } catch (e) {
    console.warn(`[Buildium] ${method} ${path} failed`, (e as Error).message)
    return { ok: false, status: 0, errorText: (e as Error).message }
  }
}

/**
 * @deprecated Use buildiumFetch with orgId parameter instead
 * This shim is temporary and will be removed after all call sites are migrated
 */
export async function buildiumFetchLegacy(
  method: BuildiumMethod,
  path: string,
  params?: Record<string, any>,
  payload?: any
): Promise<{ ok: boolean; status: number; json?: any; errorText?: string }> {
  logger.warn('buildiumFetchLegacy called - please migrate to buildiumFetch with orgId parameter');
  return buildiumFetch(method, path, params, payload, undefined);
}
