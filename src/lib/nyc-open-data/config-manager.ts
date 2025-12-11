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
  dobSafetyViolations: string
  dobViolations: string
  dobActiveViolations: string
  dobEcbViolations: string
  dobComplaints: string
  bedbugReporting: string
  dobNowApprovedPermits: string
  dobNowSafetyBoiler: string
  dobNowSafetyFacade: string
  dobPermitIssuanceOld: string
  dobCertificateOfOccupancyOld: string
  dobCertificateOfOccupancyNow: string
  hpdViolations: string
  hpdComplaints: string
  hpdRegistrations: string
  fdnyViolations: string
  asbestosViolations: string
  sidewalkViolations: string
  heatSensorProgram: string
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
  // Legacy compatibility
  elevatorViolations?: string
  sidewalkViolations?: string
  dobComplaints?: string
  dobCertificateOfOccupancyOld?: string
  dobCertificateOfOccupancyNow?: string
  heatSensorProgram?: string
}

const DEFAULT_BASE_URL = process.env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/'
const DEFAULT_GEOSERVICE_BASE_URL =
  process.env.NYC_GEOSERVICE_BASE_URL || 'https://api.nyc.gov/geoclient/v2/'

export const DEFAULT_DATASET_IDS: NYCOpenDataDatasets = {
  elevatorDevices: 'juyv-2jek', // DOB NOW Build – Elevator Devices
  elevatorInspections: 'e5aq-a4j2', // DOB NOW Elevator Safety Compliance Filings
  dobSafetyViolations: '855j-jady', // DOB Safety Violations (NYC Open Data)
  dobViolations: '3h2n-5cm9',
  dobActiveViolations: '6drr-tyq2',
  dobEcbViolations: '6bgk-3dad',
  dobComplaints: 'eabe-havv', // DOB Complaints Received
  bedbugReporting: 'wz6d-d3jb', // Bedbug Reporting (HPD)
  dobNowApprovedPermits: 'rbx6-tga4', // DOB NOW: Build – Approved Permits
  dobNowSafetyBoiler: '52dp-yji6', // DOB NOW: Safety Boiler
  dobNowSafetyFacade: 'xubg-57si', // DOB NOW: Safety – Facades Compliance Filings
  dobPermitIssuanceOld: 'ipu4-2q9a', // DOB Permit Issuance (OLD/BIS)
  dobCertificateOfOccupancyOld: 'bs8b-p36w', // DOB Certificate Of Occupancy (Old)
  dobCertificateOfOccupancyNow: 'pkdm-hqz6', // DOB NOW: Certificate of Occupancy
  hpdViolations: 'wvxf-dwi5',
  hpdComplaints: 'ygpa-z7cr',
  hpdRegistrations: 'tesw-yqqr', // HPD Registrations
  fdnyViolations: 'avgm-ztsb',
  asbestosViolations: 'r6c3-8mpt',
  sidewalkViolations: '6kbp-uz6m', // Sidewalk Management Database - Violations
  heatSensorProgram: 'h4mf-f24e', // Buildings Selected for the Heat Sensor Program (HSP)
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
      dobSafetyViolations: row?.dataset_elevator_violations || DEFAULT_DATASET_IDS.dobSafetyViolations,
      dobViolations: row?.dataset_dob_violations || DEFAULT_DATASET_IDS.dobViolations,
      dobActiveViolations: row?.dataset_dob_active_violations || DEFAULT_DATASET_IDS.dobActiveViolations,
      dobEcbViolations: row?.dataset_dob_ecb_violations || DEFAULT_DATASET_IDS.dobEcbViolations,
      dobComplaints: row?.dataset_dob_complaints || DEFAULT_DATASET_IDS.dobComplaints,
      bedbugReporting: row?.dataset_bedbug_reporting || DEFAULT_DATASET_IDS.bedbugReporting,
      dobNowApprovedPermits:
        row?.dataset_dob_now_approved_permits || DEFAULT_DATASET_IDS.dobNowApprovedPermits,
      dobPermitIssuanceOld:
        row?.dataset_dob_permit_issuance_old || DEFAULT_DATASET_IDS.dobPermitIssuanceOld,
      dobCertificateOfOccupancyOld:
        row?.dataset_dob_certificate_of_occupancy_old || DEFAULT_DATASET_IDS.dobCertificateOfOccupancyOld,
      dobCertificateOfOccupancyNow:
        row?.dataset_dob_certificate_of_occupancy_now || DEFAULT_DATASET_IDS.dobCertificateOfOccupancyNow,
      dobNowSafetyBoiler: row?.dataset_dob_now_safety_boiler || DEFAULT_DATASET_IDS.dobNowSafetyBoiler,
      dobNowSafetyFacade: row?.dataset_dob_now_safety_facade || DEFAULT_DATASET_IDS.dobNowSafetyFacade,
      hpdViolations: row?.dataset_hpd_violations || DEFAULT_DATASET_IDS.hpdViolations,
      hpdComplaints: row?.dataset_hpd_complaints || DEFAULT_DATASET_IDS.hpdComplaints,
      hpdRegistrations: row?.dataset_hpd_registrations || DEFAULT_DATASET_IDS.hpdRegistrations,
      fdnyViolations: row?.dataset_fdny_violations || DEFAULT_DATASET_IDS.fdnyViolations,
      asbestosViolations: row?.dataset_asbestos_violations || DEFAULT_DATASET_IDS.asbestosViolations,
      sidewalkViolations: row?.dataset_sidewalk_violations || DEFAULT_DATASET_IDS.sidewalkViolations,
      heatSensorProgram: row?.dataset_heat_sensor_program || DEFAULT_DATASET_IDS.heatSensorProgram,
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
    dobSafetyViolations:
      payload.dobSafetyViolations ||
      payload.elevatorViolations || // backward compatibility
      existing?.dataset_elevator_violations ||
      DEFAULT_DATASET_IDS.dobSafetyViolations,
    dobViolations: payload.dobViolations || existing?.dataset_dob_violations || DEFAULT_DATASET_IDS.dobViolations,
    dobActiveViolations:
      payload.dobActiveViolations || existing?.dataset_dob_active_violations || DEFAULT_DATASET_IDS.dobActiveViolations,
    dobEcbViolations:
      payload.dobEcbViolations || existing?.dataset_dob_ecb_violations || DEFAULT_DATASET_IDS.dobEcbViolations,
    dobComplaints:
      payload.dobComplaints || existing?.dataset_dob_complaints || DEFAULT_DATASET_IDS.dobComplaints,
    bedbugReporting:
      payload.bedbugReporting || existing?.dataset_bedbug_reporting || DEFAULT_DATASET_IDS.bedbugReporting,
    dobNowApprovedPermits:
      payload.dobNowApprovedPermits ||
      existing?.dataset_dob_now_approved_permits ||
      DEFAULT_DATASET_IDS.dobNowApprovedPermits,
    dobPermitIssuanceOld:
      payload.dobPermitIssuanceOld ||
      existing?.dataset_dob_permit_issuance_old ||
      DEFAULT_DATASET_IDS.dobPermitIssuanceOld,
    dobCertificateOfOccupancyOld:
      payload.dobCertificateOfOccupancyOld ||
      existing?.dataset_dob_certificate_of_occupancy_old ||
      DEFAULT_DATASET_IDS.dobCertificateOfOccupancyOld,
    dobCertificateOfOccupancyNow:
      payload.dobCertificateOfOccupancyNow ||
      existing?.dataset_dob_certificate_of_occupancy_now ||
      DEFAULT_DATASET_IDS.dobCertificateOfOccupancyNow,
    dobNowSafetyBoiler:
      payload.dobNowSafetyBoiler || existing?.dataset_dob_now_safety_boiler || DEFAULT_DATASET_IDS.dobNowSafetyBoiler,
    dobNowSafetyFacade:
      payload.dobNowSafetyFacade || existing?.dataset_dob_now_safety_facade || DEFAULT_DATASET_IDS.dobNowSafetyFacade,
    hpdViolations: payload.hpdViolations || existing?.dataset_hpd_violations || DEFAULT_DATASET_IDS.hpdViolations,
    hpdComplaints: payload.hpdComplaints || existing?.dataset_hpd_complaints || DEFAULT_DATASET_IDS.hpdComplaints,
    hpdRegistrations:
      payload.hpdRegistrations || existing?.dataset_hpd_registrations || DEFAULT_DATASET_IDS.hpdRegistrations,
    fdnyViolations: payload.fdnyViolations || existing?.dataset_fdny_violations || DEFAULT_DATASET_IDS.fdnyViolations,
    asbestosViolations:
      payload.asbestosViolations || existing?.dataset_asbestos_violations || DEFAULT_DATASET_IDS.asbestosViolations,
    sidewalkViolations:
      payload.sidewalkViolations || existing?.dataset_sidewalk_violations || DEFAULT_DATASET_IDS.sidewalkViolations,
    heatSensorProgram:
      payload.heatSensorProgram || existing?.dataset_heat_sensor_program || DEFAULT_DATASET_IDS.heatSensorProgram,
  }

  const upsertPayload = {
    org_id: orgId,
    base_url: payload.baseUrl || existing?.base_url || DEFAULT_BASE_URL,
    app_token_encrypted: nextAppTokenEncrypted,
    geoservice_api_key_encrypted: nextGeoserviceTokenEncrypted,
    geoservice_base_url: payload.geoserviceBaseUrl || existing?.geoservice_base_url || DEFAULT_GEOSERVICE_BASE_URL,
    dataset_elevator_devices: datasets.elevatorDevices,
    dataset_elevator_inspections: datasets.elevatorInspections,
    dataset_elevator_violations: datasets.dobSafetyViolations,
    dataset_dob_violations: datasets.dobViolations,
    dataset_dob_active_violations: datasets.dobActiveViolations,
    dataset_dob_ecb_violations: datasets.dobEcbViolations,
    dataset_dob_complaints: datasets.dobComplaints,
    dataset_bedbug_reporting: datasets.bedbugReporting,
    dataset_dob_now_approved_permits: datasets.dobNowApprovedPermits,
    dataset_dob_permit_issuance_old: datasets.dobPermitIssuanceOld,
    dataset_dob_certificate_of_occupancy_old: datasets.dobCertificateOfOccupancyOld,
    dataset_dob_certificate_of_occupancy_now: datasets.dobCertificateOfOccupancyNow,
    dataset_dob_now_safety_boiler: datasets.dobNowSafetyBoiler,
    dataset_dob_now_safety_facade: datasets.dobNowSafetyFacade,
    dataset_hpd_violations: datasets.hpdViolations,
    dataset_hpd_complaints: datasets.hpdComplaints,
    dataset_hpd_registrations: datasets.hpdRegistrations,
    dataset_fdny_violations: datasets.fdnyViolations,
    dataset_asbestos_violations: datasets.asbestosViolations,
    dataset_sidewalk_violations: datasets.sidewalkViolations,
    dataset_heat_sensor_program: datasets.heatSensorProgram,
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
