/**
 * NYC Open Data Integration API
 *
 * GET    /api/nyc-data/integration - Fetch org-scoped Open Data config (masked token)
 * PUT    /api/nyc-data/integration - Upsert config (encrypts token)
 * DELETE /api/nyc-data/integration - Soft delete config
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import {
  deleteNYCOpenDataConfig,
  getNYCOpenDataConfig,
  maskAppToken,
  saveNYCOpenDataConfig,
} from '@/lib/nyc-open-data/config-manager'

async function resolveOrgId(request: NextRequest, userId: string): Promise<string> {
  const headerOrgId = request.headers.get('x-org-id')
  if (headerOrgId) return headerOrgId.trim()

  const cookieOrgId = request.cookies.get('x-org-id')?.value
  if (cookieOrgId) return cookieOrgId.trim()

  const { data: membership, error } = await supabaseAdmin
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !membership) {
    throw new Error('ORG_CONTEXT_REQUIRED')
  }

  return membership.org_id
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, auth.user.id)

    const config = await getNYCOpenDataConfig(orgId)

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
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: { code: 'missing_org', message: 'Organization context required' } }, { status: 400 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch NYC Open Data integration' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, auth.user.id)
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

    await saveNYCOpenDataConfig(orgId, {
      baseUrl,
      appToken: body.appToken || undefined,
      appTokenUnchanged: body.appTokenUnchanged === true,
      geoserviceBaseUrl: typeof body.geoserviceBaseUrl === 'string' ? body.geoserviceBaseUrl : undefined,
      geoserviceApiKey: body.geoserviceApiKey || undefined,
      geoserviceApiKeyUnchanged: body.geoserviceApiKeyUnchanged === true,
      isEnabled: body.isEnabled,
      elevatorDevices: datasetsInput.elevatorDevices || datasetsInput.dataset_elevator_devices || undefined,
      elevatorInspections: datasetsInput.elevatorInspections || datasetsInput.dataset_elevator_inspections || undefined,
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
      dobNowSafetyBoiler:
        datasetsInput.dobNowSafetyBoiler || datasetsInput.dataset_dob_now_safety_boiler || undefined,
      dobNowSafetyFacade:
        datasetsInput.dobNowSafetyFacade || datasetsInput.dataset_dob_now_safety_facade || undefined,
      dobPermitIssuanceOld:
        datasetsInput.dobPermitIssuanceOld || datasetsInput.dataset_dob_permit_issuance_old || undefined,
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
      fdnyViolations: datasetsInput.fdnyViolations || datasetsInput.dataset_fdny_violations || undefined,
      asbestosViolations: datasetsInput.asbestosViolations || datasetsInput.dataset_asbestos_violations || undefined,
      sidewalkViolations: datasetsInput.sidewalkViolations || datasetsInput.dataset_sidewalk_violations || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: { code: 'missing_org', message: 'Organization context required' } }, { status: 400 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to save NYC Open Data integration' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, auth.user.id)
    await deleteNYCOpenDataConfig(orgId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: { code: 'missing_org', message: 'Organization context required' } }, { status: 400 })
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete NYC Open Data integration' } },
      { status: 500 }
    )
  }
}
