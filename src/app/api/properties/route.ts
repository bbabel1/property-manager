import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapPropertyToBuildium, mapCountryToBuildium, mapUiPropertyTypeToBuildium } from '@/lib/buildium-mappers'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import type { Database as DatabaseSchema } from '@/types/database'
import {
  normalizeAssignmentLevel,
  normalizeAssignmentLevelEnum,
  normalizeBillingFrequency,
  normalizeCountryWithDefault,
  normalizeFeeType,
  normalizeFeeFrequency,
  normalizeManagementServicesList,
  normalizePropertyStatus,
  normalizePropertyType,
  normalizeServicePlan,
  normalizeUnitBathrooms,
  normalizeUnitBedrooms,
  toNumberOrDefault,
  toNumberOrNull,
} from '@/lib/normalizers'

type PropertiesInsert = DatabaseSchema['public']['Tables']['properties']['Insert']
type PropertiesUpdate = DatabaseSchema['public']['Tables']['properties']['Update']
type UnitsInsert = DatabaseSchema['public']['Tables']['units']['Insert']
type OwnershipInsert = DatabaseSchema['public']['Tables']['ownerships']['Insert']

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = await request.json()
    const url = new URL(request.url)
    const syncToBuildium = url.searchParams.get('syncToBuildium') === 'true'
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
    const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(country ?? ''))
    const activeServicesInput = Array.isArray(active_services) || typeof active_services === 'string'
      ? active_services
      : Array.isArray(included_services) || typeof included_services === 'string'
      ? included_services
      : null
    const normalizedActiveServices = normalizeManagementServicesList(activeServicesInput)
    const normalizedPropertyType = normalizePropertyType(propertyType)
    const propertyStatus = normalizePropertyStatus(status)

    // Coerce empty-string UUID fields to null to satisfy DB uuid type
    const opId = typeof operatingBankAccountId === 'string' && operatingBankAccountId.trim() === ''
      ? null
      : operatingBankAccountId ?? null
    const depId = typeof depositTrustAccountId === 'string' && depositTrustAccountId.trim() === ''
      ? null
      : depositTrustAccountId ?? null

    const now = new Date().toISOString()
    const propertyData: PropertiesInsert = {
      name,
      structure_description: structureDescription ?? null,
      address_line1: addressLine1,
      address_line2: addressLine2 ?? null,
      address_line3: body?.addressLine3 ?? null,
      city: city ?? null,
      state: state ?? null,
      postal_code: postalCode,
      country: normalizedCountry,
      property_type: normalizedPropertyType,
      operating_bank_account_id: opId,
      deposit_trust_account_id: depId,
      reserve: toNumberOrNull(reserve),
      year_built: toNumberOrNull(yearBuilt),
      status: propertyStatus,
      is_active: propertyStatus === 'Active',
      rental_owner_ids: null,
      management_scope: normalizeAssignmentLevelEnum(management_scope),
      service_assignment: normalizeAssignmentLevel(service_assignment),
      service_plan: normalizeServicePlan(service_plan),
      active_services: normalizedActiveServices,
      fee_assignment: normalizeAssignmentLevelEnum(fee_assignment),
      fee_type: normalizeFeeType(fee_type),
      fee_percentage: toNumberOrNull(fee_percentage),
      management_fee: toNumberOrNull(management_fee),
      billing_frequency: normalizeBillingFrequency(billing_frequency),
      borough: typeof body?.borough === 'string' && body.borough.trim() ? body.borough : null,
      neighborhood: typeof body?.neighborhood === 'string' && body.neighborhood.trim() ? body.neighborhood : null,
      longitude: toNumberOrNull(body?.longitude),
      latitude: toNumberOrNull(body?.latitude),
      location_verified: body?.locationVerified != null ? !!body.locationVerified : body?.location_verified != null ? !!body.location_verified : null,
      org_id: orgId,
      created_at: now,
      updated_at: now,
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

      const ownershipRecords: OwnershipInsert[] = owners.map((owner: any) => ({
        owner_id: String(owner.id),
        property_id: property.id,
        ownership_percentage: toNumberOrDefault(owner.ownershipPercentage, 0),
        disbursement_percentage: toNumberOrDefault(owner.disbursementPercentage, 0),
        primary: Boolean(owner.primary),
        created_at: now,
        updated_at: now,
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
      const unitRows: UnitsInsert[] = units
        .filter((u: any) => (u?.unitNumber || '').trim().length > 0)
        .map((u: any) => {
          const unitNumber = String(u.unitNumber || '').trim()
          const bedrooms = normalizeUnitBedrooms(u.unitBedrooms)
          const bathrooms = normalizeUnitBathrooms(u.unitBathrooms)
          return {
            property_id: property.id,
            unit_number: unitNumber,
            unit_bedrooms: bedrooms,
            unit_bathrooms: bathrooms,
            unit_size: toNumberOrNull(u.unitSize),
            market_rent: toNumberOrNull(u.marketRent),
            description: u.description ?? null,
            address_line1: property.address_line1,
            address_line2: property.address_line2 ?? null,
            address_line3: property.address_line3 ?? null,
            city: property.city ?? null,
            state: property.state ?? null,
            postal_code: property.postal_code,
            country: property.country,
            created_at: now,
            updated_at: now,
            org_id: orgId,
            service_plan: normalizeServicePlan(u.servicePlan),
            fee_type: normalizeFeeType(u.feeType),
            fee_frequency: normalizeFeeFrequency(u.feeFrequency),
            fee_percent: toNumberOrNull(u.feePercent),
            management_fee: toNumberOrNull(u.managementFee),
            fee_notes: u.feeNotes ?? null,
            unit_type: u.unitType ?? null,
            service_start: u.serviceStart ?? null,
            service_end: u.serviceEnd ?? null,
            active_services: Array.isArray(u.activeServices)
              ? (u.activeServices as string[]).filter(Boolean).join(', ') || null
              : typeof u.activeServices === 'string'
              ? u.activeServices
              : null,
            is_active: typeof u.isActive === 'boolean' ? u.isActive : null,
          } as UnitsInsert
        })
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
      // Only attempt if explicitly requested and Buildium credentials are configured
      if (syncToBuildium && process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET) {
        // 1) Ensure Owners exist in Buildium and collect their Buildium IDs
        const prelinkedOwnerIds: number[] = []
        if (owners && owners.length > 0) {
          for (const o of owners) {
            try {
              const { data: localOwner } = await db
                .from('owners')
                .select('*')
                .eq('id', o.id)
                .single()
              if (!localOwner) continue
              if (localOwner.buildium_owner_id) {
                prelinkedOwnerIds.push(Number(localOwner.buildium_owner_id))
                continue
              }
              // Create owner in Buildium when missing
              const ownerSync = await buildiumEdgeClient.syncOwnerToBuildium(localOwner)
              if (ownerSync.success && ownerSync.buildiumId) {
                prelinkedOwnerIds.push(ownerSync.buildiumId)
                try {
                  await db
                    .from('owners')
                    .update({ buildium_owner_id: ownerSync.buildiumId, buildium_updated_at: new Date().toISOString() })
                    .eq('id', localOwner.id)
                } catch {}
              } else {
                logger.warn({ ownerId: localOwner.id, error: ownerSync.error }, 'Failed to sync owner to Buildium prior to property create')
              }
            } catch (e) {
              logger.warn({ error: e instanceof Error ? e.message : String(e) }, 'Error ensuring owner Buildium ID')
            }
          }
        }

        // 2) Create/Update Property payload
        // Resolve local bank account UUID -> Buildium BankAccountId (auto-sync bank account if missing)
        let buildiumOperatingBankAccountId: number | undefined
        if (operatingBankAccountId) {
          try {
            const { data: ba } = await db
              .from('bank_accounts')
              .select('id, buildium_bank_id, gl_account')
              .eq('id', operatingBankAccountId)
              .single()
            if (ba?.buildium_bank_id) {
              buildiumOperatingBankAccountId = Number(ba.buildium_bank_id)
            } else if (ba?.id) {
              // Attempt to create the bank account in Buildium first
              let payload: any
              try {
                const { data: full } = await db
                  .from('bank_accounts')
                  .select('*')
                  .eq('id', ba.id)
                  .single()
                payload = { ...full }
                if (full?.gl_account) {
                  const { data: gl } = await db
                    .from('gl_accounts')
                    .select('buildium_gl_account_id')
                    .eq('id', full.gl_account)
                    .maybeSingle()
                  const glId = (gl as any)?.buildium_gl_account_id
                  if (typeof glId === 'number' && glId > 0) payload = { ...payload, GLAccountId: glId }
                }
              } catch {}
              const result = await buildiumEdgeClient.syncBankAccountToBuildium(payload || { id: ba.id })
              if (result.success && result.buildiumId) {
                try {
                  await db.from('bank_accounts').update({ buildium_bank_id: result.buildiumId, updated_at: new Date().toISOString() }).eq('id', ba.id)
                } catch {}
                buildiumOperatingBankAccountId = result.buildiumId
              } else {
                logger.warn({ operatingBankAccountId, error: result.error }, 'Failed to create operating bank account in Buildium before property create')
              }
            }
          } catch (e) {
            logger.warn({ error: e instanceof Error ? e.message : String(e) }, 'Unable to resolve operating bank account for Buildium')
          }
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
