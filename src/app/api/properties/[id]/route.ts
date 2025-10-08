import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { validateCSRFToken } from '@/lib/csrf'
import type { Database as DatabaseSchema } from '@/types/database'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import {
  normalizeAssignmentLevel,
  normalizeAssignmentLevelEnum,
  normalizeBillingFrequency,
  normalizeCountryWithDefault,
  normalizeFeeType,
  normalizeManagementServicesList,
  normalizePropertyStatus,
  normalizePropertyType,
  normalizeServicePlan,
  toNumberOrDefault,
  toNumberOrNull,
} from '@/lib/normalizers'

const ADMIN_ROLE_SET = new Set(['org_admin', 'org_manager', 'platform_admin'])

type PropertiesUpdate = DatabaseSchema['public']['Tables']['properties']['Update']
type OwnershipInsert = DatabaseSchema['public']['Tables']['ownerships']['Insert']

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    const propertyId = resolvedParams.id

    // Check authentication
    const user = await requireUser(request);

    // CSRF protection
    const isValidCSRF = await validateCSRFToken(request);
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const adminClient = supabaseAdmin || supabase

    // Resolve property + org context before mutating anything
    const {
      data: propertyRow,
      error: propertyFetchError,
    } = await adminClient
      .from('properties')
      .select('id, org_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyFetchError) {
      console.error('Error loading property for update:', propertyFetchError)
      return NextResponse.json({ error: 'Failed to load property' }, { status: 500 })
    }
    if (!propertyRow) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const headerOrgId = request.headers.get('x-org-id')
    let resolvedOrgId: string | null = propertyRow.org_id ?? null

    const ensureMembership = async (orgId: string | null) => {
      if (!orgId) return null
      const { data: membership } = await adminClient
        .from('org_memberships')
        .select('org_id, role')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle()
      return membership ?? null
    }

    let membership = await ensureMembership(resolvedOrgId)

    if (!membership) {
      // Property missing org assignment or user supplied org context
      const candidateOrgId = resolvedOrgId
        ?? headerOrgId
        ?? (await (async () => {
          const { data: memberships, error } = await adminClient
            .from('org_memberships')
            .select('org_id, role')
            .eq('user_id', user.id)
          if (error) {
            console.error('Error loading user memberships:', error)
            return null
          }
          const list = (memberships || []).filter(m => ADMIN_ROLE_SET.has(String(m.role)))
          if (list.length === 1) return list[0].org_id as string
          return null
        })())

      if (candidateOrgId) {
        resolvedOrgId = candidateOrgId
        membership = await ensureMembership(candidateOrgId)
      }
    }

    if (!membership || !ADMIN_ROLE_SET.has(String(membership.role))) {
      return NextResponse.json({ error: 'Not authorized to manage this property' }, { status: 403 })
    }

    if (!resolvedOrgId) {
      return NextResponse.json({ error: 'Property is missing organization context' }, { status: 400 })
    }

    const body = await request.json()
    const getField = (...keys: string[]) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          return body[key]
        }
      }
      return undefined
    }

    // Validate required fields
    const requiredFieldGroups: string[][] = [
      ['name'],
      ['address_line1', 'addressLine1'],
      ['city'],
      ['state'],
      ['postal_code', 'postalCode'],
      ['country'],
      ['status'],
    ]
    for (const fields of requiredFieldGroups) {
      if (!getField(...fields)) {
        return NextResponse.json({ error: `Missing required field: ${fields[0]}` }, { status: 400 })
      }
    }

    // Update the property
    const now = new Date().toISOString()
    const updatePatch: PropertiesUpdate = {
      updated_at: now,
      org_id: resolvedOrgId,
    }

    const nameInput = getField('name')
    if (nameInput !== undefined) updatePatch.name = nameInput

    const addressLine1Input = getField('address_line1', 'addressLine1')
    if (addressLine1Input !== undefined) updatePatch.address_line1 = addressLine1Input
    const addressLine2Input = getField('address_line2', 'addressLine2')
    if (addressLine2Input !== undefined) updatePatch.address_line2 = addressLine2Input ?? null
    const addressLine3Input = getField('address_line3', 'addressLine3')
    if (addressLine3Input !== undefined) updatePatch.address_line3 = addressLine3Input ?? null

    const cityInput = getField('city')
    if (cityInput !== undefined) updatePatch.city = cityInput ?? null
    const stateInput = getField('state')
    if (stateInput !== undefined) updatePatch.state = stateInput ?? null
    const postalCodeInput = getField('postal_code', 'postalCode')
    if (postalCodeInput !== undefined) updatePatch.postal_code = postalCodeInput

    const countryInput = getField('country')
    if (countryInput !== undefined) {
      updatePatch.country = normalizeCountryWithDefault(mapGoogleCountryToEnum(String(countryInput)))
    }

    const propertyTypeInput = getField('property_type', 'propertyType')
    if (propertyTypeInput !== undefined) updatePatch.property_type = normalizePropertyType(propertyTypeInput)

    const statusInput = getField('status')
    if (statusInput !== undefined) {
      const normalizedStatus = normalizePropertyStatus(statusInput)
      updatePatch.status = normalizedStatus
      updatePatch.is_active = normalizedStatus === 'Active'
    }
    const reserveInput = getField('reserve')
    if (reserveInput !== undefined) updatePatch.reserve = toNumberOrNull(reserveInput)

    const yearBuiltInput = getField('year_built', 'yearBuilt')
    if (yearBuiltInput !== undefined) updatePatch.year_built = toNumberOrNull(yearBuiltInput)

    const operatingAccountInput = getField('operating_bank_account_id', 'operatingBankAccountId')
    if (operatingAccountInput !== undefined) updatePatch.operating_bank_account_id = operatingAccountInput ?? null

    const depositAccountInput = getField('deposit_trust_account_id', 'depositTrustAccountId')
    if (depositAccountInput !== undefined) updatePatch.deposit_trust_account_id = depositAccountInput ?? null

    const managementScopeInput = getField('management_scope', 'managementScope')
    if (managementScopeInput !== undefined) {
      updatePatch.management_scope = normalizeAssignmentLevelEnum(managementScopeInput)
    }

    const serviceAssignmentInput = getField('service_assignment', 'serviceAssignment')
    if (serviceAssignmentInput !== undefined) {
      updatePatch.service_assignment = normalizeAssignmentLevel(serviceAssignmentInput)
    }

    const servicePlanInput = getField('service_plan', 'servicePlan')
    if (servicePlanInput !== undefined) {
      updatePatch.service_plan = normalizeServicePlan(servicePlanInput)
    }

    const activeServicesInput = getField('active_services', 'activeServices')
    const includedServicesInput = getField('included_services', 'includedServices')
    if (activeServicesInput !== undefined) {
      updatePatch.active_services = normalizeManagementServicesList(activeServicesInput)
    } else if (includedServicesInput !== undefined) {
      updatePatch.active_services = normalizeManagementServicesList(includedServicesInput)
    }

    const feeAssignmentInput = getField('fee_assignment', 'feeAssignment')
    if (feeAssignmentInput !== undefined) {
      updatePatch.fee_assignment = normalizeAssignmentLevelEnum(feeAssignmentInput)
    }

    const feeTypeInput = getField('fee_type', 'feeType')
    if (feeTypeInput !== undefined) {
      updatePatch.fee_type = normalizeFeeType(feeTypeInput)
    }

    const feePercentageInput = getField('fee_percentage', 'feePercentage')
    if (feePercentageInput !== undefined) {
      updatePatch.fee_percentage = toNumberOrNull(feePercentageInput)
    }

    const managementFeeInput = getField('management_fee', 'managementFee')
    if (managementFeeInput !== undefined) {
      updatePatch.management_fee = toNumberOrNull(managementFeeInput)
    }

    const billingFrequencyInput = getField('billing_frequency', 'billingFrequency')
    if (billingFrequencyInput !== undefined) {
      updatePatch.billing_frequency = normalizeBillingFrequency(billingFrequencyInput)
    }

    const boroughInput = getField('borough')
    if (boroughInput !== undefined) {
      updatePatch.borough = typeof boroughInput === 'string' && boroughInput.trim() ? boroughInput : null
    }

    const neighborhoodInput = getField('neighborhood')
    if (neighborhoodInput !== undefined) {
      updatePatch.neighborhood = typeof neighborhoodInput === 'string' && neighborhoodInput.trim() ? neighborhoodInput : null
    }

    const longitudeInput = getField('longitude')
    if (longitudeInput !== undefined) {
      updatePatch.longitude = toNumberOrNull(longitudeInput)
    }

    const latitudeInput = getField('latitude')
    if (latitudeInput !== undefined) {
      updatePatch.latitude = toNumberOrNull(latitudeInput)
    }

    const locationVerifiedInput = getField('location_verified', 'locationVerified')
    if (locationVerifiedInput !== undefined) {
      updatePatch.location_verified = !!locationVerifiedInput
    }

    const structureDescriptionInput = getField('structure_description', 'structureDescription')
    if (structureDescriptionInput !== undefined) {
      updatePatch.structure_description = structureDescriptionInput ?? null
    }

    const { data, error } = await adminClient
      .from('properties')
      .update(updatePatch)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) {
      console.error('Error updating property:', error)
      return NextResponse.json({ error: 'Failed to update property' }, { status: 500 })
    }

    // Handle ownership updates (non-destructive when empty)
    // Only replace ownerships when owners array is provided AND non-empty.
    // This prevents accidental wipes when a client sends an empty array due to UI hydration timing.
    if (body.owners && Array.isArray(body.owners) && body.owners.length > 0) {
      console.log('🔍 API: Processing ownership updates for property:', propertyId)
      console.log('🔍 API: Owners data:', body.owners)

      // Ensure we have org_id for ownership inserts
      let orgId: string | null = resolvedOrgId
      try {
        // 0) Prefer explicit org id from header if provided and it matches the authorized org
        const hdrOrg = request.headers.get('x-org-id')
        if (hdrOrg && hdrOrg === resolvedOrgId) orgId = hdrOrg

        // 1) Try from the updated property row
        if (!orgId) orgId = (data as any)?.org_id ?? null

        // 2) Try reloading the property
        if (!orgId) {
          const { data: propRow } = await adminClient
            .from('properties')
            .select('org_id')
            .eq('id', propertyId)
            .maybeSingle()
          orgId = (propRow as any)?.org_id ?? null
        }

        // 3) Try user's org membership (first org)
        if (!orgId) {
          const { data: mem } = await adminClient
            .from('org_memberships')
            .select('org_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          orgId = (mem as any)?.org_id ?? null
        }

        // 4) Try deriving from first owner in payload
        if (!orgId) {
          const firstOwner = body.owners?.[0]
          if (firstOwner?.id) {
            const { data: own } = await adminClient
              .from('owners')
              .select('org_id')
              .eq('id', firstOwner.id)
              .maybeSingle()
            orgId = (own as any)?.org_id ?? null
          }
        }

        // 5) Single-tenant convenience: if exactly one org exists, use it
        if (!orgId) {
          const { data: orgs } = await adminClient
            .from('organizations')
            .select('id')
          if (Array.isArray(orgs) && orgs.length === 1) orgId = orgs[0].id
        }

        // If we resolved orgId and property has none, persist it for consistency
        if (orgId) {
          await adminClient
            .from('properties')
            .update({ org_id: orgId, updated_at: new Date().toISOString() })
            .eq('id', propertyId)
        }
      } catch {}

      if (!orgId) {
        console.error('🔍 API: Cannot upsert ownerships — missing org_id for property and user:', propertyId)
        return NextResponse.json({ error: 'Missing org context; cannot upsert ownerships' }, { status: 400 })
      }
      
      // First, delete all existing ownership records for this property
      const { data: previousOwnerships, error: previousOwnershipsError } = await adminClient
        .from('ownerships')
        .select('id, property_id, owner_id, ownership_percentage, disbursement_percentage, primary, org_id, created_at, updated_at')
        .eq('property_id', propertyId)

      if (previousOwnershipsError) {
        console.error('🔍 API: Failed to load existing ownership records:', previousOwnershipsError)
        return NextResponse.json({ error: 'Failed to update ownerships' }, { status: 500 })
      }

      const { error: deleteError } = await adminClient
        .from('ownerships')
        .delete()
        .eq('property_id', propertyId)

      if (deleteError) {
        console.error('🔍 API: Error deleting existing ownership records:', deleteError)
        return NextResponse.json({ error: 'Failed to clear existing ownerships' }, { status: 500 })
      } else {
        console.log('🔍 API: Successfully deleted existing ownership records')
      }

      // Then insert new ownership records
      const insertErrors: any[] = []
      const ownershipInsertNow = new Date().toISOString()
      for (const owner of body.owners) {
        console.log('🔍 API: Inserting ownership record for owner:', owner.id)
        const ownershipPayload: OwnershipInsert = {
          property_id: propertyId,
          owner_id: String(owner.id),
          ownership_percentage: toNumberOrDefault(owner.ownershipPercentage, 0),
          disbursement_percentage: toNumberOrDefault(owner.disbursementPercentage, 0),
          primary: Boolean(owner.primary),
          org_id: orgId,
          created_at: ownershipInsertNow,
          updated_at: ownershipInsertNow,
        }
        const { data: ownershipData, error: insertError } = await adminClient
          .from('ownerships')
          .insert(ownershipPayload)
          .select()

        if (insertError) {
          console.error('🔍 API: Error inserting ownership record:', insertError)
          insertErrors.push(insertError)
        } else {
          console.log('🔍 API: Successfully inserted ownership record:', ownershipData)
        }
      }
      if (insertErrors.length) {
        console.error('🔍 API: Ownership insert failures, attempting to restore previous state.')
        if (Array.isArray(previousOwnerships) && previousOwnerships.length > 0) {
          try {
            await adminClient.from('ownerships').insert(previousOwnerships.map(prev => ({
              id: prev.id,
              property_id: prev.property_id,
              owner_id: prev.owner_id,
              ownership_percentage: prev.ownership_percentage,
              disbursement_percentage: prev.disbursement_percentage,
              primary: prev.primary,
              org_id: prev.org_id,
              created_at: prev.created_at,
              updated_at: prev.updated_at,
            })))
          } catch (restoreError) {
            console.error('🔍 API: Failed to restore prior ownerships after insert error:', restoreError)
          }
        }
        return NextResponse.json({ error: 'Failed to upsert one or more ownerships', details: insertErrors.map(e => e.message || String(e)) }, { status: 400 })
      }
    } else {
      console.log('🔍 API: Skipping ownership updates (no owners provided or empty)')
    }

    // Handle property manager assignment (optional)
    if (Object.prototype.hasOwnProperty.call(body, 'property_manager_id')) {
      const staffId = body.property_manager_id
      // Remove existing link for PROPERTY_MANAGER
      const { error: detachError } = await adminClient
        .from('property_staff')
        .delete()
        .eq('property_id', propertyId)
        .eq('role', 'PROPERTY_MANAGER')
      if (detachError) {
        console.error('🔍 API: Failed clearing existing property manager link:', detachError)
        return NextResponse.json({ error: 'Failed to update property manager assignment' }, { status: 500 })
      }
      if (staffId) {
        const numericStaffId = typeof staffId === 'string' ? Number(staffId) : staffId
        if (Number.isNaN(numericStaffId)) {
          return NextResponse.json({ error: 'Invalid property manager id' }, { status: 400 })
        }
        const { data: staffRow, error: staffError } = await adminClient
          .from('staff')
          .select('id, org_id, buildium_user_id')
          .eq('id', numericStaffId)
          .maybeSingle()
        if (staffError) {
          console.error('🔍 API: Failed to load staff member:', staffError)
          return NextResponse.json({ error: 'Failed to load property manager' }, { status: 500 })
        }
        if (!staffRow) {
          return NextResponse.json({ error: 'Property manager not found' }, { status: 404 })
        }
        if (staffRow.org_id && staffRow.org_id !== resolvedOrgId) {
          return NextResponse.json({ error: 'Property manager belongs to a different organization' }, { status: 403 })
        }

        const { error: attachError } = await adminClient.from('property_staff').insert({
          property_id: propertyId,
          staff_id: numericStaffId,
          role: 'PROPERTY_MANAGER',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        if (attachError) {
          console.error('🔍 API: Failed to assign property manager:', attachError)
          return NextResponse.json({ error: 'Failed to assign property manager' }, { status: 500 })
        }
      }
      // Phase 2: surface Buildium RentalManager id to callers for sync
      try {
        const sid = typeof staffId === 'string' ? Number(staffId) : staffId
        if (sid) {
          const { data: st } = await adminClient
            .from('staff')
            .select('buildium_user_id')
            .eq('id', sid)
            .maybeSingle()
          if (st?.buildium_user_id) {
            ;(data as any).rental_manager = Number(st.buildium_user_id)
          }
        }
      } catch {}
    }

    // primary_owner field removed - ownership is now managed through ownerships table

    // Invalidate cached property detail and financials fetches
    try {
      revalidateTag(`property-details:${propertyId}`)
      revalidateTag(`property-financials:${propertyId}`)
    } catch {}

    return NextResponse.json({ 
      success: true, 
      property: data 
    })

  } catch (error) {
    console.error('Error in PUT /api/properties/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
