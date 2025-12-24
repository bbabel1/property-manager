/**
 * NYC Open Data Integration API
 *
 * GET    /api/nyc-data/integration - Fetch global Open Data config (masked token)
 * PUT    /api/nyc-data/integration - Upsert dataset catalog entries
 * DELETE /api/nyc-data/integration - No-op (legacy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import {
  deleteNYCOpenDataConfig,
  getNYCOpenDataConfig,
  maskAppToken,
  saveNYCOpenDataConfig,
} from '@/lib/nyc-open-data/config-manager'

export async function GET(_request: NextRequest) {
  try {
    await requireAuth()

    const config = await getNYCOpenDataConfig()

    return NextResponse.json({
      is_enabled: config.isEnabled,
      base_url: config.baseUrl,
      geoservice_base_url: config.geoserviceBaseUrl,
      has_geoservice_api_key: config.hasGeoserviceApiKey,
      geoservice_api_key_masked: maskAppToken(config.geoserviceApiKey),
      datasets: config.datasets,
      has_app_token: config.hasAppToken,
      app_token_masked: maskAppToken(config.appToken),
      app_token_full: config.appToken,
      source: config.source,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch NYC Open Data integration' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()

    const baseUrl = typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0 ? body.baseUrl.trim() : undefined
    if (baseUrl) {
      try {
        // basic URL validation
        new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`)
      } catch {
        return NextResponse.json(
          { error: { code: 'invalid_base_url', message: 'baseUrl must be a valid URL or host' } },
          { status: 400 }
        )
      }
    }

    const datasetsInput = body.datasets || {}

    await saveNYCOpenDataConfig('global', {
      baseUrl,
      appToken: body.appToken || undefined,
      geoserviceBaseUrl: typeof body.geoserviceBaseUrl === 'string' ? body.geoserviceBaseUrl : undefined,
      geoserviceApiKey: body.geoserviceApiKey || undefined,
      isEnabled: body.isEnabled,
      elevatorDevices: datasetsInput.elevatorDevices || datasetsInput.dataset_elevator_devices || undefined,
      elevatorInspections: datasetsInput.elevatorInspections || datasetsInput.dataset_elevator_inspections || undefined,
      elevatorViolationsActive:
        datasetsInput.elevatorViolationsActive || datasetsInput.dataset_elevator_violations_active || undefined,
      elevatorViolationsHistoric:
        datasetsInput.elevatorViolationsHistoric || datasetsInput.dataset_elevator_violations_historic || undefined,
      elevatorComplaints:
        datasetsInput.elevatorComplaints || datasetsInput.dataset_elevator_complaints || undefined,
      dobSafetyViolations:
        datasetsInput.dobSafetyViolations ||
        datasetsInput.elevatorViolations || // backward compatibility with old key
        datasetsInput.dataset_elevator_violations ||
        undefined,
      dobViolations: datasetsInput.dobViolations || datasetsInput.dataset_dob_violations || undefined,
      dobActiveViolations: datasetsInput.dobActiveViolations || datasetsInput.dataset_dob_active_violations || undefined,
      dobEcbViolations: datasetsInput.dobEcbViolations || datasetsInput.dataset_dob_ecb_violations || undefined,
      dobComplaints: datasetsInput.dobComplaints || datasetsInput.dataset_dob_complaints || undefined,
      bedbugReporting: datasetsInput.bedbugReporting || datasetsInput.dataset_bedbug_reporting || undefined,
      dobNowApprovedPermits:
        datasetsInput.dobNowApprovedPermits || datasetsInput.dataset_dob_now_approved_permits || undefined,
      dobNowJobFilings:
        datasetsInput.dobNowJobFilings || datasetsInput.dataset_dob_now_job_filings || undefined,
      dobNowSafetyBoiler:
        datasetsInput.dobNowSafetyBoiler || datasetsInput.dataset_dob_now_safety_boiler || undefined,
      dobNowSafetyFacade:
        datasetsInput.dobNowSafetyFacade || datasetsInput.dataset_dob_now_safety_facade || undefined,
      dobPermitIssuanceOld:
        datasetsInput.dobPermitIssuanceOld || datasetsInput.dataset_dob_permit_issuance_old || undefined,
      dobJobApplications:
        datasetsInput.dobJobApplications || datasetsInput.dataset_dob_job_applications || undefined,
      dobCertificateOfOccupancyOld:
        datasetsInput.dobCertificateOfOccupancyOld ||
        datasetsInput.dataset_dob_certificate_of_occupancy_old ||
        undefined,
      dobCertificateOfOccupancyNow:
        datasetsInput.dobCertificateOfOccupancyNow ||
        datasetsInput.dataset_dob_certificate_of_occupancy_now ||
        undefined,
      hpdViolations: datasetsInput.hpdViolations || datasetsInput.dataset_hpd_violations || undefined,
      hpdComplaints: datasetsInput.hpdComplaints || datasetsInput.dataset_hpd_complaints || undefined,
      hpdRegistrations: datasetsInput.hpdRegistrations || datasetsInput.dataset_hpd_registrations || undefined,
      buildingsSubjectToHPD:
        datasetsInput.buildingsSubjectToHPD || datasetsInput.dataset_buildings_subject_to_hpd || undefined,
      heatSensorProgram: datasetsInput.heatSensorProgram || datasetsInput.dataset_heat_sensor_program || undefined,
      fdnyViolations: datasetsInput.fdnyViolations || datasetsInput.dataset_fdny_violations || undefined,
      asbestosViolations: datasetsInput.asbestosViolations || datasetsInput.dataset_asbestos_violations || undefined,
      sidewalkViolations: datasetsInput.sidewalkViolations || datasetsInput.dataset_sidewalk_violations || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to save NYC Open Data integration' } },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    await requireAuth()
    await deleteNYCOpenDataConfig('global')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete NYC Open Data integration' } },
      { status: 500 }
    )
  }
}
