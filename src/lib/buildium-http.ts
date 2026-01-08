// Minimal Buildium HTTP helper used by API routes to standardize headers and URLs
// CRITICAL: All Buildium credential access must flow through getOrgScopedBuildiumConfig
import { getOrgScopedBuildiumConfig } from './buildium/credentials-manager';
import { logger } from '@/lib/logger';

export type BuildiumMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type BuildiumParams = Record<string, string | number | boolean | null | undefined>

export type BuildiumFetchResult = {
  ok: boolean
  status: number
  statusText: string
  json?: unknown
  errorText?: string
}

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
  params?: BuildiumParams,
  payload?: unknown,
  orgId?: string | undefined
): Promise<BuildiumFetchResult> {
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
      statusText: errorMsg,
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
    let text = ''
    let json: unknown
    if (typeof (res as any)?.text === 'function') {
      text = await res.text()
      try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
    } else if (typeof (res as any)?.json === 'function') {
      try {
        json = await (res as any).json()
        text = json ? JSON.stringify(json) : ''
      } catch {
        json = undefined
        text = ''
      }
    }
    if (res.ok) {
      const parsedId = (json as { Id?: unknown } | null | undefined)?.Id
      console.log(
        `[Buildium] ${method} ${path} -> ${res.status}`,
        parsedId ? { Id: parsedId } : json,
      )
    } else {
      console.warn(`[Buildium] ${method} ${path} -> ${res.status}`, json ?? text)
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, json, errorText: res.ok ? undefined : text }
  } catch (e) {
    console.warn(`[Buildium] ${method} ${path} failed`, (e as Error).message)
    const message = (e as Error).message
    return { ok: false, status: 0, statusText: message, errorText: message }
  }
}

/**
 * @deprecated Use buildiumFetch with orgId parameter instead
 * This shim is temporary and will be removed after all call sites are migrated
 */
export async function buildiumFetchLegacy(
  method: BuildiumMethod,
  path: string,
  params?: BuildiumParams,
  payload?: unknown
): Promise<BuildiumFetchResult> {
  logger.warn('buildiumFetchLegacy called - please migrate to buildiumFetch with orgId parameter');
  return buildiumFetch(method, path, params, payload, undefined);
}
