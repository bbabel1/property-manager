import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'
import { logger } from '@/lib/logger'

type Issue = { code: string; message: string; path?: string }

/**
 * GET /api/buildium/readiness/:propertyId
 * Checks minimum required fields for Buildium sync.
 *
 * This is a lightweight checklist: it verifies property basics, at least one unit,
 * and at least one owner. Bank account and services are optional but flagged if missing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })

    // Property basics
    const { data: property, error: propError } = await db
      .from('properties')
      .select(
        `
        id,
        name,
        address_line1,
        city,
        state,
        postal_code,
        country,
        property_type,
        operating_bank_account_id,
        service_assignment,
        service_plan,
        active_services
      `,
      )
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (propError) {
      logger.error({ error: propError }, 'Readiness property fetch failed')
      return NextResponse.json({ error: 'Failed to load property' }, { status: 500 })
    }
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Units count
    const { count: unitCount, error: unitError } = await db
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    if (unitError) {
      logger.error({ error: unitError }, 'Readiness unit count failed')
    }

    // Owners count
    const { count: ownerCount, error: ownerError } = await db
      .from('ownerships')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    if (ownerError) {
      logger.error({ error: ownerError }, 'Readiness owner count failed')
    }

    const issues: Issue[] = []
    if (!property.name) issues.push({ code: 'NAME', message: 'Property name is required' })
    if (!property.address_line1)
      issues.push({ code: 'ADDRESS', message: 'Address line 1 is required', path: 'address_line1' })
    if (!property.city) issues.push({ code: 'CITY', message: 'City is required', path: 'city' })
    if (!property.state) issues.push({ code: 'STATE', message: 'State is required', path: 'state' })
    if (!property.postal_code)
      issues.push({ code: 'POSTAL_CODE', message: 'Postal code is required', path: 'postal_code' })
    if (!property.country)
      issues.push({ code: 'COUNTRY', message: 'Country is required', path: 'country' })
    if (!property.property_type)
      issues.push({ code: 'PROPERTY_TYPE', message: 'Property type is required', path: 'property_type' })
    if (!unitCount || unitCount === 0)
      issues.push({ code: 'UNITS', message: 'At least one unit is required', path: 'units' })
    if (!ownerCount || ownerCount === 0)
      issues.push({ code: 'OWNERS', message: 'At least one owner is required', path: 'ownerships' })

    // Optional but flagged
    if (!property.operating_bank_account_id) {
      issues.push({
        code: 'BANK_ACCOUNT',
        message: 'Operating bank account is recommended before Buildium sync',
        path: 'operating_bank_account_id',
      })
    }

    const ready = issues.filter((i) => i.code !== 'BANK_ACCOUNT').length === 0

    return NextResponse.json({
      ready,
      issues,
    })
  } catch (error) {
    logger.error({ error }, 'GET /api/buildium/readiness failed')
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
