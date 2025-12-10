/**
 * NYC Open Data Config Manager
 *
 * Stores org-scoped NYC Open Data dataset IDs, base URL, and encrypted app token.
 * Provides env fallback and masking for safe UI responses.
 */

import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

export type NYCOpenDataDatasets = {
  elevatorDevices: string
  elevatorInspections: string
  elevatorViolations: string
  dobViolations: string
  dobActiveViolations: string
  dobEcbViolations: string
  hpdViolations: string
  hpdComplaints: string
  fdnyViolations: string
  asbestosViolations: string
}

export type NYCOpenDataConfig = {
  baseUrl: string
  appToken: string | null
  hasAppToken: boolean
  geoserviceBaseUrl: string
  geoserviceApiKey: string | null
  hasGeoserviceApiKey: boolean
  datasets: NYCOpenDataDatasets
  isEnabled: boolean
  source: 'db' | 'env' | 'default'
}

export type NYCOpenDataConfigUpsert = Partial<NYCOpenDataDatasets> & {
  baseUrl?: string
  appToken?: string
  isEnabled?: boolean
  appTokenUnchanged?: boolean
  geoserviceBaseUrl?: string
  geoserviceApiKey?: string
  geoserviceApiKeyUnchanged?: boolean
}

const DEFAULT_BASE_URL = process.env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/'
const DEFAULT_GEOSERVICE_BASE_URL =
  process.env.NYC_GEOSERVICE_BASE_URL || 'https://api.nyc.gov/geoclient/v2/'

export const DEFAULT_DATASET_IDS: NYCOpenDataDatasets = {
  elevatorDevices: 'juyv-2jek', // DOB NOW Build – Elevator Devices
  elevatorInspections: 'e5aq-a4j2', // DOB NOW Elevator Safety Compliance Filings
  elevatorViolations: 'rff7-h44d', // Active Elevator Violations
  dobViolations: '3h2n-5cm9',
  dobActiveViolations: '6drr-tyq2',
  dobEcbViolations: '6bgk-3dad',
  hpdViolations: 'wvxf-dwi5',
  hpdComplaints: 'ygpa-z7cr',
  fdnyViolations: 'avgm-ztsb',
  asbestosViolations: 'r6c3-8mpt',
}

function buildConfigFromRow(row: any): NYCOpenDataConfig {
  return {
    baseUrl: row?.base_url || DEFAULT_BASE_URL,
    appToken: row?.app_token_encrypted || null,
    hasAppToken: Boolean((row?.app_token_encrypted || '').length),
    geoserviceBaseUrl: row?.geoservice_base_url || DEFAULT_GEOSERVICE_BASE_URL,
    geoserviceApiKey: row?.geoservice_api_key_encrypted || null,
    hasGeoserviceApiKey: Boolean((row?.geoservice_api_key_encrypted || '').length),
    datasets: {
      elevatorDevices: row?.dataset_elevator_devices || DEFAULT_DATASET_IDS.elevatorDevices,
      elevatorInspections: row?.dataset_elevator_inspections || DEFAULT_DATASET_IDS.elevatorInspections,
      elevatorViolations: row?.dataset_elevator_violations || DEFAULT_DATASET_IDS.elevatorViolations,
      dobViolations: row?.dataset_dob_violations || DEFAULT_DATASET_IDS.dobViolations,
      dobActiveViolations: row?.dataset_dob_active_violations || DEFAULT_DATASET_IDS.dobActiveViolations,
      dobEcbViolations: row?.dataset_dob_ecb_violations || DEFAULT_DATASET_IDS.dobEcbViolations,
      hpdViolations: row?.dataset_hpd_violations || DEFAULT_DATASET_IDS.hpdViolations,
      hpdComplaints: row?.dataset_hpd_complaints || DEFAULT_DATASET_IDS.hpdComplaints,
      fdnyViolations: row?.dataset_fdny_violations || DEFAULT_DATASET_IDS.fdnyViolations,
      asbestosViolations: row?.dataset_asbestos_violations || DEFAULT_DATASET_IDS.asbestosViolations,
    },
    isEnabled: row?.is_enabled ?? true,
    source: 'db',
  }
}

export function maskAppToken(token: string | null): string | null {
  if (!token) return null
  if (token.length <= 6) return '***'
  return `${token.substring(0, 3)}***${token.substring(token.length - 3)}`
}

/**
 * Resolve config for an org with env fallback.
 */
export async function getNYCOpenDataConfig(orgId?: string): Promise<NYCOpenDataConfig> {
  if (orgId) {
    try {
      const { data: row, error } = await supabaseAdmin
        .from('nyc_open_data_integrations')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!error && row) {
        return buildConfigFromRow(row)
      }

      if (error) {
        logger.error({ orgId, error }, 'Failed to fetch NYC Open Data config from DB')
      }
    } catch (error) {
      logger.error({ orgId, error }, 'Unexpected error fetching NYC Open Data config')
    }
  }

  // Env fallback
  const envToken = process.env.NYC_OPEN_DATA_APP_TOKEN || process.env.NYC_OPEN_DATA_API_KEY || null
  const envGeoserviceKey = process.env.NYC_GEOSERVICE_API_KEY || process.env.NYC_GEOSERVICE_KEY || null
  return {
    baseUrl: DEFAULT_BASE_URL,
    appToken: envToken,
    hasAppToken: Boolean(envToken),
    geoserviceBaseUrl: DEFAULT_GEOSERVICE_BASE_URL,
    geoserviceApiKey: envGeoserviceKey,
    hasGeoserviceApiKey: Boolean(envGeoserviceKey),
    datasets: DEFAULT_DATASET_IDS,
    isEnabled: true,
    source: envToken ? 'env' : 'default',
  }
}

/**
 * Upsert org config (encrypts token at application layer).
 */
export async function saveNYCOpenDataConfig(orgId: string, payload: NYCOpenDataConfigUpsert): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('nyc_open_data_integrations')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  const normalizedAppToken = payload.appToken === '' ? null : payload.appToken
  const normalizedGeoKey = payload.geoserviceApiKey === '' ? null : payload.geoserviceApiKey

  const nextAppTokenEncrypted =
    payload.appTokenUnchanged && existing?.app_token_encrypted
      ? existing.app_token_encrypted
      : normalizedAppToken !== undefined
      ? normalizedAppToken
      : existing?.app_token_encrypted || null
  const nextGeoserviceTokenEncrypted =
    payload.geoserviceApiKeyUnchanged && existing?.geoservice_api_key_encrypted
      ? existing.geoservice_api_key_encrypted
      : normalizedGeoKey !== undefined
      ? normalizedGeoKey
      : existing?.geoservice_api_key_encrypted || null

  const datasets: NYCOpenDataDatasets = {
    elevatorDevices: payload.elevatorDevices || existing?.dataset_elevator_devices || DEFAULT_DATASET_IDS.elevatorDevices,
    elevatorInspections:
      payload.elevatorInspections || existing?.dataset_elevator_inspections || DEFAULT_DATASET_IDS.elevatorInspections,
    elevatorViolations:
      payload.elevatorViolations || existing?.dataset_elevator_violations || DEFAULT_DATASET_IDS.elevatorViolations,
    dobViolations: payload.dobViolations || existing?.dataset_dob_violations || DEFAULT_DATASET_IDS.dobViolations,
    dobActiveViolations:
      payload.dobActiveViolations || existing?.dataset_dob_active_violations || DEFAULT_DATASET_IDS.dobActiveViolations,
    dobEcbViolations:
      payload.dobEcbViolations || existing?.dataset_dob_ecb_violations || DEFAULT_DATASET_IDS.dobEcbViolations,
    hpdViolations: payload.hpdViolations || existing?.dataset_hpd_violations || DEFAULT_DATASET_IDS.hpdViolations,
    hpdComplaints: payload.hpdComplaints || existing?.dataset_hpd_complaints || DEFAULT_DATASET_IDS.hpdComplaints,
    fdnyViolations: payload.fdnyViolations || existing?.dataset_fdny_violations || DEFAULT_DATASET_IDS.fdnyViolations,
    asbestosViolations:
      payload.asbestosViolations || existing?.dataset_asbestos_violations || DEFAULT_DATASET_IDS.asbestosViolations,
  }

  const upsertPayload = {
    org_id: orgId,
    base_url: payload.baseUrl || existing?.base_url || DEFAULT_BASE_URL,
    app_token_encrypted: nextAppTokenEncrypted,
    geoservice_api_key_encrypted: nextGeoserviceTokenEncrypted,
    geoservice_base_url: payload.geoserviceBaseUrl || existing?.geoservice_base_url || DEFAULT_GEOSERVICE_BASE_URL,
    dataset_elevator_devices: datasets.elevatorDevices,
    dataset_elevator_inspections: datasets.elevatorInspections,
    dataset_elevator_violations: datasets.elevatorViolations,
    dataset_dob_violations: datasets.dobViolations,
    dataset_dob_active_violations: datasets.dobActiveViolations,
    dataset_dob_ecb_violations: datasets.dobEcbViolations,
    dataset_hpd_violations: datasets.hpdViolations,
    dataset_hpd_complaints: datasets.hpdComplaints,
    dataset_fdny_violations: datasets.fdnyViolations,
    dataset_asbestos_violations: datasets.asbestosViolations,
    is_enabled: payload.isEnabled ?? existing?.is_enabled ?? true,
    deleted_at: null,
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from('nyc_open_data_integrations')
      .update(upsertPayload)
      .eq('id', existing.id)
    if (error) {
      logger.error({ orgId, error }, 'Failed to update NYC Open Data config')
      throw error
    }
  } else {
    const { error } = await supabaseAdmin.from('nyc_open_data_integrations').insert(upsertPayload)
    if (error) {
      logger.error({ orgId, error }, 'Failed to insert NYC Open Data config')
      throw error
    }
  }
}

export async function deleteNYCOpenDataConfig(orgId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('nyc_open_data_integrations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .is('deleted_at', null)

  if (error) {
    logger.error({ orgId, error }, 'Failed to soft delete NYC Open Data config')
    throw error
  }
}
