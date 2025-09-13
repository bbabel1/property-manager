import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapPropertyToBuildium, mapCountryToBuildium, mapUiPropertyTypeToBuildium } from '@/lib/buildium-mappers'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = await request.json()
    const {
      propertyType,
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      yearBuilt,
      structureDescription,
      owners,
      units,
      operatingBankAccountId,
      depositTrustAccountId,
      reserve,
      propertyManagerId,
      status,
      // New management/service/fee fields (camelCase from client)
      management_scope,
      service_assignment,
      service_plan,
      included_services, // legacy name pre-rename
      active_services,
      fee_assignment,
      fee_type,
      fee_percentage,
      management_fee,
      billing_frequency
    } = body

    // Validate required fields
    if (!propertyType || !name || !addressLine1 || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Resolve organization context (required by NOT NULL constraint and RLS policies)
    const db = supabaseAdmin || supabase
    let orgId: string | null = request.headers.get('x-org-id') || null
    if (!orgId) {
      // Fallback: pick the user's first org membership (handle 0, 1, or many rows)
      try {
        const { data: rows } = await db
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1)
        const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
        orgId = (first as any)?.org_id || null
      } catch {}
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Create property data object matching database schema (snake_case)
    const normalizedCountry = mapGoogleCountryToEnum(country)
    const propertyData = {
      name,
      structure_description: structureDescription,
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      city,
      state,
      postal_code: postalCode,
      country: normalizedCountry,
      // Persist UI property_type to enum (NULL means None)
      property_type: (propertyType === 'Mult-Family') ? 'Mult-Family' : propertyType,
      operating_bank_account_id: operatingBankAccountId || null,
      deposit_trust_account_id: depositTrustAccountId || null,
      reserve: reserve ? parseFloat(reserve.toString()) : null,
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
      status: status || 'Active',
      rental_owner_ids: [],
      // Management/Service/Fees (nullable if not provided)
      management_scope: management_scope || null,
      service_assignment: service_assignment || null,
      service_plan: service_plan || null,
      active_services: Array.isArray(active_services)
        ? (active_services.length ? active_services : null)
        : (Array.isArray(included_services) && included_services.length ? included_services : null),
      fee_assignment: fee_assignment || null,
      fee_type: fee_type || null,
      fee_percentage: (fee_percentage ?? null) !== null ? Number(fee_percentage) : null,
      management_fee: (management_fee ?? null) !== null ? Number(management_fee) : null,
      billing_frequency: billing_frequency || null,
      // Optional location fields from client (if present)
      borough: typeof body?.borough === 'string' ? body.borough : null,
      neighborhood: typeof body?.neighborhood === 'string' ? body.neighborhood : null,
      longitude: body?.longitude != null ? Number(body.longitude) : null,
      latitude: body?.latitude != null ? Number(body.latitude) : null,
      location_verified: !!body?.locationVerified,
      org_id: orgId,
    }

    // Create the property
    const { data: property, error: propertyError } = await db
      .from('properties')
      .insert(propertyData)
      .select()
      .single()

    if (propertyError) {
      logger.error({ error: propertyError, propertyData }, 'Error creating property (DB)')
      return NextResponse.json(
        { error: 'Failed to create property', details: propertyError.message },
        { status: 500 }
      )
    }

    // Record initial sync status for property (local create)
    try { await recordSyncStatus(db, property.id, null, 'pending') } catch {}

    // Create ownership records if owners are provided
    if (owners && owners.length > 0) {
      // Ensure owners belong to the same org. If owner.org_id is null, backfill it.
      try {
        const ownerIds = owners.map((o: any) => o.id)
        if (ownerIds.length) {
          await db
            .from('owners')
            .update({ org_id: orgId })
            .in('id', ownerIds)
            .is('org_id', null as any)
        }
      } catch {}

      const ownershipRecords = owners.map((owner: any) => ({
        owner_id: owner.id,
        property_id: property.id,
        ownership_percentage: owner.ownershipPercentage ? parseFloat(owner.ownershipPercentage.toString()) : null,
        disbursement_percentage: owner.disbursementPercentage ? parseFloat(owner.disbursementPercentage.toString()) : null,
        primary: !!owner.primary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        org_id: orgId,
      }))

      // Use correct table name 'ownerships'
      const { error: ownershipError } = await db
        .from('ownerships')
        .insert(ownershipRecords)

      if (ownershipError) {
        console.error('Error creating ownership records:', ownershipError)
        // Note: In a production app, you might want to rollback the property creation here
        return NextResponse.json(
          { error: 'Failed to create ownership records' },
          { status: 500 }
        )
      }

      // Note: primary_owner field has been removed; ownership is managed solely
      // through the 'ownerships' table. No additional property update needed.
    }

    // Create units if provided
    if (Array.isArray(units) && units.length > 0) {
      const now = new Date().toISOString()
      const unitRows = units
        .filter((u: any) => (u?.unitNumber || '').trim().length > 0)
        .map((u: any) => ({
          property_id: property.id,
          unit_number: u.unitNumber,
          unit_bedrooms: u.unitBedrooms || null,
          unit_bathrooms: u.unitBathrooms || null,
          unit_size: u.unitSize ? Number(u.unitSize) : null,
          description: u.description || null,
          // Default unit address fields from the property's address
          address_line1: property.address_line1 || null,
          address_line2: property.address_line2 || null,
          address_line3: property.address_line3 || null,
          city: property.city || null,
          state: property.state || null,
          postal_code: property.postal_code || null,
          country: property.country || null,
          created_at: now,
          updated_at: now,
          org_id: orgId,
        }))
      if (unitRows.length) {
        const { data: insertedUnits, error: unitsErr } = await db.from('units').insert(unitRows).select('*')
        if (unitsErr) {
          logger.error({ error: unitsErr }, 'Error creating units (DB)')
          return NextResponse.json({ error: 'Failed to create units' }, { status: 500 })
        }
        // Replace units with inserted rows (for Buildium sync later)
        (body as any).__insertedUnits = insertedUnits || []

        // Mark units pending for sync
        try {
          await Promise.all(((body as any).__insertedUnits as any[]).map(u => recordSyncStatus(db, u.id, null, 'pending')))
        } catch {}
      }
    }

    // ===================== Buildium Sync (Property → Units → Owners) =====================
    try {
      // Only attempt if Buildium credentials are configured: require both client id and secret
      if (process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET) {
        // 1) Create Property first (owners will be linked afterwards)
        // Preload any existing Buildium owner IDs to include if already present
        const prelinkedOwnerIds: number[] = []
        if (owners && owners.length > 0) {
          for (const o of owners) {
            const { data: localOwner } = await db
              .from('owners')
              .select('buildium_owner_id')
              .eq('id', o.id)
              .single()
            if (localOwner?.buildium_owner_id) prelinkedOwnerIds.push(Number(localOwner.buildium_owner_id))
          }
        }

        // 2) Create/Update Property payload
        // Resolve local bank account UUID -> Buildium BankAccountId
        let buildiumOperatingBankAccountId: number | undefined
        if (operatingBankAccountId) {
          try {
            const { data: ba } = await db
              .from('bank_accounts')
              .select('buildium_bank_id')
              .eq('id', operatingBankAccountId)
              .single()
            if (ba?.buildium_bank_id) buildiumOperatingBankAccountId = Number(ba.buildium_bank_id)
          } catch {}
        }
        const propertyPayload = mapPropertyToBuildium({
          name,
          structure_description: structureDescription || undefined,
          is_active: status !== 'Inactive',
          operating_bank_account_id: buildiumOperatingBankAccountId,
          reserve,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          state,
          postal_code: postalCode,
          country,
          year_built: yearBuilt,
          rental_type: 'Rental',
          property_type: propertyType
        } as any)
        // Attach PropertyManagerId from staff.buildium_user_id when available
        if (propertyManagerId) {
          try {
            const { data: pm } = await db
              .from('staff')
              .select('buildium_user_id')
              .eq('id', propertyManagerId)
              .not('buildium_user_id', 'is', null)
              .single()
            const pmId = pm?.buildium_user_id ? Number(pm.buildium_user_id) : null
            if (pmId) (propertyPayload as any).PropertyManagerId = pmId
          } catch {}
        }
        if (prelinkedOwnerIds.length) (propertyPayload as any).RentalOwnerIds = prelinkedOwnerIds

        // If request included units, include them in the Buildium property create payload (per Buildium docs)
        let includedUnitsInCreate = false
        if (Array.isArray(units) && units.length > 0) {
          const toEnumBedrooms = (v: any): any => {
            switch (String(v || '').trim()) {
              case 'Studio': return 'Studio'
              case '1': return 'OneBed'
              case '2': return 'TwoBed'
              case '3': return 'ThreeBed'
              case '4': return 'FourBed'
              case '5': return 'FiveBed'
              case '6': return 'SixBed'
              case '7': return 'SevenBed'
              case '8': return 'EightBed'
              case '9': case '9+': return 'NineBedPlus'
              case '5+': return 'FiveBed'
              default: return 'NotSet'
            }
          }
          const toEnumBathrooms = (v: any): any => {
            switch (String(v || '').trim()) {
              case '1': return 'OneBath'
              case '1.5': return 'OnePointFiveBath'
              case '2': return 'TwoBath'
              case '2.5': return 'TwoPointFiveBath'
              case '3': return 'ThreeBath'
              case '3.5': return 'ThreePointFiveBath'
              case '4': return 'FourBath'
              case '4.5': return 'FourPointFiveBath'
              case '5': return 'FiveBath'
              case '5+': return 'FivePlusBath'
              case '4+': return 'FourBath' // Fallback for 4+
              default: return 'NotSet'
            }
          }
          const buildiumUnits = units
            .filter((u: any) => (u?.unitNumber || '').trim().length > 0)
            .map((u: any) => ({
              UnitNumber: u.unitNumber,
              UnitBedrooms: toEnumBedrooms(u.unitBedrooms),
              UnitBathrooms: toEnumBathrooms(u.unitBathrooms),
              UnitSize: u.unitSize ? Number(u.unitSize) : undefined,
              Description: u.description || undefined,
              Address: {
                AddressLine1: addressLine1,
                AddressLine2: addressLine2 || undefined,
                City: city,
                State: state,
                PostalCode: postalCode,
                Country: mapCountryToBuildium(country) || 'UnitedStates'
              }
            }))
          if (buildiumUnits.length) {
            ;(propertyPayload as any).Units = buildiumUnits
            includedUnitsInCreate = true
          }
        }

        // Validate required fields for Buildium property before attempting
        const propValidation = validateBuildiumPropertyPayload(propertyPayload)
        if (!propValidation.ok) {
          logger.warn({ missing: propValidation.missing }, 'Skipping Buildium property create: missing fields')
          try { await recordSyncStatus(db, property.id, null, 'failed', `Missing fields: ${propValidation.missing.join(', ')}`) } catch {}
        }

        // Mark syncing and attempt create
        try { await recordSyncStatus(db, property.id, null, 'syncing') } catch {}
        let propAttempted = false
        if (propValidation.ok) {
          // Mark syncing and attempt create
          try { await recordSyncStatus(db, property.id, null, 'syncing') } catch {}
          const propRes = await buildiumFetch('POST', '/rentals', undefined, propertyPayload)
          propAttempted = true
          if (propRes.ok && propRes.json?.Id) {
            const buildiumId = Number(propRes.json.Id)
            await db.from('properties').update({ buildium_property_id: buildiumId }).eq('id', property.id)
            try { await recordSyncStatus(db, property.id, buildiumId, 'synced') } catch {}
          } else {
            // Structured error logging to surface Buildium validation details (e.g., 422 field errors)
            const errorLog = {
              status: propRes.status,
              errorText: propRes.errorText,
              responseJson: propRes.json,
              requestPreview: {
                Name: (propertyPayload as any)?.Name,
                RentalType: (propertyPayload as any)?.RentalType,
                RentalSubType: (propertyPayload as any)?.RentalSubType,
                OperatingBankAccountId: (propertyPayload as any)?.OperatingBankAccountId,
                Address: (propertyPayload as any)?.Address,
                UnitsCount: Array.isArray((propertyPayload as any)?.Units) ? (propertyPayload as any).Units.length : undefined,
              }
            }
            try { logger.warn(errorLog, 'Buildium property sync failed') } catch { console.warn('Buildium property sync failed', errorLog) }
            try { await recordSyncStatus(db, property.id, null, 'failed', `HTTP ${propRes.status}: ${propRes.errorText || 'unknown'}`) } catch {}
          }
        }
        const buildiumPropertyId = (await (async()=>{
          const { data } = await db.from('properties').select('buildium_property_id').eq('id', property.id).single()
          return data?.buildium_property_id as number | null
        })())

        // 3) Map Units via initial property create: if we included units, fetch them from Buildium and link IDs
        if (buildiumPropertyId) {
          const insertedUnits: any[] = (body as any).__insertedUnits || []
          if (includedUnitsInCreate && insertedUnits.length > 0) {
            try { await Promise.all(insertedUnits.map(u => recordSyncStatus(db, u.id, null, 'syncing'))) } catch {}
            // Buildium units listing is property-scoped via query param
            const listRes = await buildiumFetch('GET', `/rentals/units`, { propertyids: buildiumPropertyId })
            if (listRes.ok && Array.isArray(listRes.json)) {
              const remoteUnits: any[] = listRes.json
              for (const local of insertedUnits) {
                const match = remoteUnits.find(it => String(it?.UnitNumber || '') === String(local.unit_number || ''))
                if (match?.Id) {
                  const buId = Number(match.Id)
                  await db.from('units').update({ buildium_unit_id: buId }).eq('id', local.id)
                  try { await recordSyncStatus(db, local.id, buId, 'synced') } catch {}
                } else {
                  try { await recordSyncStatus(db, local.id, null, 'failed', 'Unit not found after property create') } catch {}
                }
              }
            } else {
              // Could not fetch units; mark as failed with context
              try { logger.warn({ status: listRes.status, error: listRes.errorText, responseJson: listRes.json }, 'Buildium units fetch after property create failed') } catch {}
              for (const local of insertedUnits) {
                try { await recordSyncStatus(db, local.id, null, 'failed', `Units fetch failed: HTTP ${listRes.status}`) } catch {}
              }
            }
          }
        } else {
          // Property didn't sync; mark any units as failed
          const insertedUnits: any[] = (body as any).__insertedUnits || []
          if (insertedUnits.length > 0) {
            for (const local of insertedUnits) {
              try { await recordSyncStatus(db, local.id, null, 'failed', 'Property did not sync to Buildium') } catch {}
            }
          }
        }

        // 4) Create/link owners now that we have a Buildium PropertyId
        if (buildiumPropertyId && owners && owners.length > 0) {
          const rentalOwnerIds: number[] = [...prelinkedOwnerIds]
          for (const o of owners) {
            let buildiumOwnerId: number | null = null
            const { data: localOwner } = await db
              .from('owners')
              .select('id, buildium_owner_id, contact_id')
              .eq('id', o.id)
              .single()
            buildiumOwnerId = localOwner?.buildium_owner_id || null
            if (!buildiumOwnerId) {
              const { data: contact } = await db
                .from('contacts')
                .select('*')
                .eq('id', localOwner?.contact_id)
                .single()
              if (contact) {
                const ownerPayload = {
                  FirstName: contact.first_name || '',
                  LastName: contact.last_name || '',
                  Email: contact.primary_email || undefined,
                  PhoneNumber: contact.primary_phone || undefined,
                  Address: {
                    // Fallback to the newly created property's address when contact fields are missing
                    AddressLine1: contact.primary_address_line_1 || addressLine1,
                    AddressLine2: contact.primary_address_line_2 || addressLine2 || undefined,
                    City: contact.primary_city || city,
                    State: contact.primary_state || state,
                    PostalCode: contact.primary_postal_code || postalCode,
                    Country: mapCountryToBuildium(contact.primary_country) || mapCountryToBuildium(country) || 'UnitedStates'
                  },
                  IsActive: true,
                  PropertyIds: [buildiumPropertyId]
                }
                const ownerSync = await buildiumFetch('POST', '/rentals/owners', undefined, ownerPayload)
                if (ownerSync.ok && ownerSync.json?.Id) {
                  buildiumOwnerId = Number(ownerSync.json.Id)
                  await db.from('owners').update({ buildium_owner_id: buildiumOwnerId }).eq('id', localOwner?.id)
                } else {
                  console.warn('Buildium owner create failed:', ownerSync.status, ownerSync.errorText)
                }
              }
            }
            if (buildiumOwnerId) rentalOwnerIds.push(buildiumOwnerId)
          }
          // Update property with full owner set
          if (rentalOwnerIds.length) {
            await buildiumFetch('PUT', `/rentals/${buildiumPropertyId}`, undefined, { RentalOwnerIds: rentalOwnerIds })
          }
        }
      }
    } catch (syncErr) {
      console.warn('Non-fatal: Buildium sync block failed:', syncErr)
    }

    // Create property staff record if property manager is assigned
    if (propertyManagerId) {
      const { error: staffError } = await db
        .from('property_staff')
        .insert({
          property_id: property.id,
          staff_id: propertyManagerId,
          role: 'PROPERTY_MANAGER'
        })

      if (staffError) {
        console.error('Error creating property staff record:', staffError)
      }
    }

    return NextResponse.json(
      { 
        message: 'Property created successfully',
        property: property
      },
      { status: 201 }
    )

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating property')
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    )
  }
}

// Buildium HTTP helper moved to '@/lib/buildium-http'

// Helper: robust Buildium owner search with optional filters and pagination
async function searchBuildiumOwnerId(params: {
  email?: string
  firstName?: string
  lastName?: string
  buildiumPropertyId?: number
}): Promise<number | null> {
  const emailLc = (params.email || '').toLowerCase()
  const ownername = [params.firstName, params.lastName].filter(Boolean).join(' ').trim() || undefined
  const limit = 200
  let offset = 0
  const maxPages = 60 // up to 12,000 owners

  for (let page = 0; page < maxPages; page++) {
    const q: Record<string, any> = { limit, offset }
    if (params.buildiumPropertyId) q.propertyids = params.buildiumPropertyId
    if (ownername) q.ownername = ownername

    // Use /v1/rentals/owners with filters
    const res = await buildiumFetch('GET', '/rentals/owners', q)
    if (!res.ok || !Array.isArray(res.json)) break
    const arr: any[] = res.json

    // If searching by email, match locally (case-insensitive)
    if (emailLc) {
      const match = arr.find(it => String(it?.Email || '').toLowerCase() === emailLc)
      if (match?.Id) return Number(match.Id)
    }

    // As a secondary heuristic, if ownername was provided, try an exact name match on FirstName/LastName
    if (ownername) {
      const [fn, ...lnp] = ownername.split(' ')
      const ln = lnp.join(' ').trim()
      const matchByName = arr.find(it =>
        (String(it?.FirstName || '').toLowerCase() === (fn || '').toLowerCase()) &&
        (String(it?.LastName || '').toLowerCase() === (ln || '').toLowerCase())
      )
      if (matchByName?.Id) return Number(matchByName.Id)
    }

    if (arr.length < limit) break // no more pages
    offset += limit
  }
  return null
}

// Record sync status via RPC (entity_type = 'Rental' for both properties and units)
async function recordSyncStatus(db: any, entityId: string, buildiumId: number | null, status: 'pending'|'syncing'|'synced'|'failed', errorMessage?: string) {
  try {
    await db.rpc('update_buildium_sync_status', {
      p_entity_type: 'Rental',
      p_entity_id: entityId,
      p_buildium_id: buildiumId,
      p_status: status,
      p_error_message: errorMessage || null
    })
  } catch (e) {
    console.warn('recordSyncStatus failed', (e as Error).message)
  }
}

// Validate required fields for Buildium property create
function validateBuildiumPropertyPayload(payload: any): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!payload?.Name) missing.push('Name')
  const addr = payload?.Address || {}
  if (!addr?.AddressLine1) missing.push('Address.AddressLine1')
  if (!addr?.City) missing.push('Address.City')
  if (!addr?.State) missing.push('Address.State')
  if (!addr?.PostalCode) missing.push('Address.PostalCode')
  if (!addr?.Country) missing.push('Address.Country')
  if (!payload?.RentalType) missing.push('RentalType')
  if (!payload?.RentalSubType) missing.push('RentalSubType')
  // OperatingBankAccountId is optional per Buildium schema
  // if (!payload?.OperatingBankAccountId) missing.push('OperatingBankAccountId')
  return { ok: missing.length === 0, missing }
}

export async function GET() {
  try {
    // Fetch only fields needed for the properties list and map to camelCase
    const db = supabaseAdmin || supabase
    const canJoinOwners = Boolean(supabaseAdmin)
    const baseCols = `
      id,
      name,
      address_line1,
      property_type,
      status,
      created_at,
      total_vacant_units,
      total_inactive_units,
      total_occupied_units,
      total_active_units
    `
    const withOwners = `${baseCols}, ownerships(id, owners(contacts(first_name, last_name, company_name)))`

    const { data, error } = await db
      .from('properties')
      .select(canJoinOwners ? withOwners : baseCols)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties' },
        { status: 500 }
      )
    }

    const mapped = (data || []).map((p: any) => {
      const ownerships = Array.isArray(p.ownerships) ? p.ownerships : []
      const ownersCount = ownerships.length
      let primaryOwnerName: string | undefined
      if (canJoinOwners && ownerships.length) {
        const pick = ownerships[0]
        if (pick?.owners?.contacts) {
          const c = Array.isArray(pick.owners.contacts) ? pick.owners.contacts[0] : pick.owners.contacts
          if (c?.company_name) primaryOwnerName = c.company_name
          else if (c) primaryOwnerName = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
        }
      }
      return {
        id: p.id,
        name: p.name,
        addressLine1: p.address_line1,
        propertyType: p.property_type,
        status: p.status,
        createdAt: p.created_at,
        totalVacantUnits: p.total_vacant_units ?? 0,
        totalInactiveUnits: p.total_inactive_units ?? 0,
        totalOccupiedUnits: p.total_occupied_units ?? 0,
        totalActiveUnits: p.total_active_units ?? 0,
        ownersCount,
        primaryOwnerName,
      }
    })

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
