
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
  normalizeCountryWithDefault,
  normalizePropertyStatus,
  normalizePropertyType,
  toNumberOrDefault,
  toNumberOrNull,
} from '@/lib/normalizers'

const ADMIN_ROLE_SET = new Set(['org_admin', 'org_manager', 'platform_admin'])

type PropertiesUpdate = DatabaseSchema['public']['Tables']['properties']['Update']
type OwnershipInsert = DatabaseSchema['public']['Tables']['ownerships']['Insert']
type PropertyRow = DatabaseSchema['public']['Tables']['properties']['Row']
type AssignmentLevel = DatabaseSchema['public']['Enums']['assignment_level']

type PropertyUpdatePatch = Omit<PropertiesUpdate, 'service_assignment'> & {
  service_assignment?: AssignmentLevel
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

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

    const {
      data: membershipRoles,
      error: membershipRolesError,
    } = await adminClient
      .from('membership_roles')
      .select('org_id, role_id')
      .eq('user_id', user.id)

    if (membershipRolesError) {
      console.error('Error loading membership roles for property update:', membershipRolesError)
    }

    const fetchOrgMemberships = async () => {
      try {
        const query = adminClient
          .from('org_memberships')
          .select('org_id, role')
          .eq('user_id', user.id)
        if (typeof (query as any)?.maybeSingle === 'function') {
          const { data, error } = await (query as any).maybeSingle()
          if (error) return { data: [], error }
          return { data: data ? [data] : [], error: null }
        }
        if (typeof (query as any)?.then === 'function') {
          return (await query) as { data?: any[]; error?: any }
        }
        return { data: [], error: null }
      } catch (error) {
        return { data: [], error }
      }
    }

    const resolvedMembershipRecords =
      membershipRoles && membershipRoles.length > 0
        ? membershipRoles
        : (() => {
            return fetchOrgMemberships().then(({ data, error }) => {
              if (error) {
                console.error('Error loading org memberships for property update:', error)
                return []
              }
              return (data || []).map((m: any) => ({
                org_id: m?.org_id ?? null,
                role_id: m?.role ?? m?.role_id ?? null,
              }))
            })
          })()

    const rolesByOrg = new Map<string, string[]>()
    const membershipRows =
      resolvedMembershipRecords instanceof Promise
        ? await resolvedMembershipRecords
        : resolvedMembershipRecords

    for (const row of membershipRows || []) {
      const roleName = (row as { role_id?: string | null }).role_id
      if (row?.org_id && roleName) {
        const list = rolesByOrg.get(row.org_id) ?? []
        rolesByOrg.set(row.org_id, [...list, String(roleName)])
      }
    }

    const getAdminMembership = (orgId: string | null) => {
      if (!orgId) return null
      const roles = rolesByOrg.get(orgId) ?? []
      const matchedRole = roles.find(role => ADMIN_ROLE_SET.has(String(role)))
      return matchedRole ? { org_id: orgId, role: matchedRole } : null
    }

    const adminOrgIds = Array.from(rolesByOrg.entries())
      .filter(([, roles]) => roles.some(role => ADMIN_ROLE_SET.has(String(role))))
      .map(([orgId]) => orgId)

    let membership = getAdminMembership(resolvedOrgId)

    if (!membership && headerOrgId) {
      membership = getAdminMembership(headerOrgId)
      if (membership) resolvedOrgId = headerOrgId
    }

    if (!membership && adminOrgIds.length === 1) {
      resolvedOrgId = adminOrgIds[0]
      membership = getAdminMembership(resolvedOrgId)
    }

    if (!membership) {
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
    const updatePatch: PropertyUpdatePatch = {
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

    const operatingAccountInput = getField(
      'operating_bank_gl_account_id',
      'operatingBankGlAccountId',
      // Backwards-compatibility: old key name (now treated as a gl_accounts.id)
      'operating_bank_account_id',
      'operatingBankAccountId',
    )
    if (operatingAccountInput !== undefined) updatePatch.operating_bank_gl_account_id = operatingAccountInput ?? null

    const depositAccountInput = getField(
      'deposit_trust_gl_account_id',
      'depositTrustGlAccountId',
      // Backwards-compatibility: old key name (now treated as a gl_accounts.id)
      'deposit_trust_account_id',
      'depositTrustAccountId',
    )
    if (depositAccountInput !== undefined) updatePatch.deposit_trust_gl_account_id = depositAccountInput ?? null

    const managementScopeInput = getField('management_scope', 'managementScope')
    if (managementScopeInput !== undefined) {
      updatePatch.management_scope = normalizeAssignmentLevelEnum(managementScopeInput)
    }

    const serviceAssignmentInput = getField('service_assignment', 'serviceAssignment')
    if (serviceAssignmentInput !== undefined) {
      const normalizedServiceAssignment = normalizeAssignmentLevel(serviceAssignmentInput)
      if (normalizedServiceAssignment) {
        updatePatch.service_assignment = normalizedServiceAssignment
      }
    }

    const billPayListInput = getField('bill_pay_list', 'billPayList')
    if (billPayListInput !== undefined) {
      updatePatch.bill_pay_list = billPayListInput ?? null
    }

    const billPayNotesInput = getField('bill_pay_notes', 'billPayNotes')
    if (billPayNotesInput !== undefined) {
      updatePatch.bill_pay_notes = billPayNotesInput ?? null
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
        if (!orgId) orgId = data?.org_id ?? null

        // 2) Try reloading the property
        if (!orgId) {
          const { data: propRow, error: propLoadError } = await adminClient
            .from('properties')
            .select('org_id')
            .eq('id', propertyId)
            .maybeSingle()
          if (propLoadError) {
            console.error('Error reloading property org_id', propLoadError)
          } else {
            orgId = propRow?.org_id ?? null
          }
        }

        // 3) Try user's org membership (first org)
        if (!orgId) {
          const { data: mem, error: memLookupError } = await adminClient
            .from('org_memberships')
            .select('org_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          if (memLookupError) {
            console.error('Error loading first org membership', memLookupError)
          } else {
            orgId = mem?.org_id ?? null
          }
        }

        // 4) Try deriving from first owner in payload
        if (!orgId) {
          const firstOwner = body.owners?.[0]
          if (firstOwner?.id) {
            const { data: own, error: ownerLookupError } = await adminClient
              .from('owners')
              .select('org_id')
              .eq('id', firstOwner.id)
              .maybeSingle()
            if (ownerLookupError) {
              console.error('Error loading owner org_id', ownerLookupError)
            } else {
              orgId = own?.org_id ?? null
            }
          }
        }

        // 5) Single-tenant convenience: if exactly one org exists, use it
        if (!orgId) {
          const { data: orgs, error: orgListError } = await adminClient
            .from('organizations')
            .select('id')
          if (orgListError) {
            console.error('Error loading organizations to infer org_id', orgListError)
          } else if (Array.isArray(orgs) && orgs.length === 1) orgId = orgs[0].id
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
      
      const isUuid = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // Pre-resolve all owner IDs before mutating ownerships
      const resolvedOwners: {
        owner_id: string;
        ownershipPercentage: number;
        disbursementPercentage: number;
        primary: boolean;
      }[] = [];
      for (const owner of body.owners) {
        let resolvedOwnerId = String(owner.id);
        if (!isUuid(resolvedOwnerId)) {
          const numericId = Number(resolvedOwnerId);
          if (!Number.isNaN(numericId)) {
            // First, try as Buildium owner id
            const { data: ownerRow, error: ownerLookupError } = await adminClient
              .from('owners')
              .select('id')
              .eq('buildium_owner_id', numericId)
              .eq('org_id', orgId)
              .maybeSingle();
            if (ownerLookupError) {
              console.error('Error looking up owner by Buildium id', ownerLookupError);
              return NextResponse.json(
                { error: 'Failed to resolve owner by Buildium id' },
                { status: 500 },
              );
            }

            // Fallback: try matching contact_id (form may send contact ids)
            let resolvedId = ownerRow?.id;
            if (!resolvedId) {
              const { data: byContact, error: ownerByContactError } = await adminClient
                .from('owners')
                .select('id')
                .eq('contact_id', numericId)
                .eq('org_id', orgId)
                .maybeSingle();
              if (ownerByContactError) {
                console.error('Error looking up owner by contact id', ownerByContactError);
                return NextResponse.json(
                  { error: 'Failed to resolve owner by contact id' },
                  { status: 500 },
                );
              }
              resolvedId = byContact?.id;
            }

            if (!resolvedId) {
              return NextResponse.json(
                { error: `Owner with Buildium/contact id ${numericId} not found in this org` },
                { status: 400 }
              );
            }
            resolvedOwnerId = resolvedId;
          } else {
            return NextResponse.json(
              { error: `Invalid owner id: ${resolvedOwnerId}` },
              { status: 400 }
            );
          }
        }
        resolvedOwners.push({
          owner_id: resolvedOwnerId,
          ownershipPercentage: toNumberOrDefault(owner.ownershipPercentage, 0),
          disbursementPercentage: toNumberOrDefault(owner.disbursementPercentage, 0),
          primary: Boolean(owner.primary),
        });
      }

      // First, delete all existing ownership records for this property (after resolving owners)
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

      // Then insert new ownership records (all at once to satisfy constraint that percentages must sum to 100%)
      const ownershipInsertNow = new Date().toISOString();
      const ownershipRecords: OwnershipInsert[] = resolvedOwners.map(owner => ({
        property_id: propertyId,
        owner_id: owner.owner_id,
        ownership_percentage: owner.ownershipPercentage,
        disbursement_percentage: owner.disbursementPercentage,
        primary: owner.primary,
        org_id: orgId,
        created_at: ownershipInsertNow,
        updated_at: ownershipInsertNow,
      }));

      const { data: ownershipData, error: insertError } = await adminClient
        .from('ownerships')
        .insert(ownershipRecords)
        .select();

      if (insertError) {
        console.error('🔍 API: Error inserting ownership records:', insertError);
        // Attempt to restore previous state on error
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
        return NextResponse.json({ 
          error: 'Failed to update ownerships', 
          details: insertError.message || String(insertError) 
        }, { status: 400 })
      }
      
      console.log('🔍 API: Successfully inserted ownership records:', ownershipData);
    } else {
      console.log('🔍 API: Skipping ownership updates (no owners provided or empty)')
    }

    let rentalManagerId: number | null = null

    // Handle property manager assignment (optional)
    if (Object.prototype.hasOwnProperty.call(body, 'property_manager_id')) {
      const staffId = body.property_manager_id
      // Remove existing link for Property Manager
      const { error: detachError } = await adminClient
        .from('property_staff')
        .delete()
        .eq('property_id', propertyId)
        .eq('role', 'Property Manager')
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
          .select('id, buildium_user_id, user_id')
          .eq('id', numericStaffId)
          .maybeSingle()
        if (staffError) {
          console.error('🔍 API: Failed to load staff member:', staffError)
          return NextResponse.json({ error: 'Failed to load property manager' }, { status: 500 })
        }
        if (!staffRow) {
          return NextResponse.json({ error: 'Property manager not found' }, { status: 404 })
        }
        if (resolvedOrgId && staffRow.user_id) {
          const { data: staffMembership, error: staffMembershipError } = await adminClient
            .from('membership_roles')
            .select('org_id')
            .eq('user_id', staffRow.user_id)
            .eq('org_id', resolvedOrgId)
            .limit(1)
            .maybeSingle<{ org_id: string }>()
          if (staffMembershipError) {
            console.error('🔍 API: Failed to verify staff membership:', staffMembershipError)
            return NextResponse.json({ error: 'Failed to verify property manager organization' }, { status: 500 })
          }
          if (!staffMembership) {
            return NextResponse.json({ error: 'Property manager belongs to a different organization' }, { status: 403 })
          }
        }

        const { error: attachError } = await adminClient.from('property_staff').insert({
          property_id: propertyId,
          staff_id: numericStaffId,
          role: 'Property Manager',
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
          const { data: st, error: staffLookupError } = await adminClient
            .from('staff')
            .select('buildium_user_id')
            .eq('id', sid)
            .maybeSingle()
          if (staffLookupError) {
            console.error('Failed to load staff for rental manager id', staffLookupError)
          } else if (st?.buildium_user_id) {
            rentalManagerId = Number(st.buildium_user_id)
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

    const propertyResponse: (PropertyRow & { rental_manager?: number }) | null =
      data && rentalManagerId ? { ...data, rental_manager: rentalManagerId } : data

    return NextResponse.json({
      success: true,
      property: propertyResponse
    })

  } catch (error) {
    console.error('Error in PUT /api/properties/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
