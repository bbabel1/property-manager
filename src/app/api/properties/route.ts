import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapPropertyToBuildium, mapCountryToBuildium } from '@/lib/buildium-mappers'
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
import { normalizeStaffRole } from '@/lib/staff-role'

type PropertiesInsert = DatabaseSchema['public']['Tables']['properties']['Insert']
// type PropertiesUpdate = DatabaseSchema['public']['Tables']['properties']['Update'] // Unused
type UnitsInsert = DatabaseSchema['public']['Tables']['units']['Insert']
type OwnershipInsert = DatabaseSchema['public']['Tables']['ownerships']['Insert']
type PropertyRow = DatabaseSchema['public']['Tables']['properties']['Row']
type OwnershipRow = DatabaseSchema['public']['Tables']['ownerships']['Row']
type OwnerRow = DatabaseSchema['public']['Tables']['owners']['Row']
type ContactRow = DatabaseSchema['public']['Tables']['contacts']['Row']

type PropertyWithOwners = PropertyRow & {
  ownerships?: Array<
    OwnershipRow & {
      owners: (OwnerRow & { contacts: ContactRow | null }) | null
    }
  > | null
}

interface PropertyRequestBody {
  propertyType: string
  name: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
  yearBuilt?: number | string | null
  structureDescription?: string | null
  owners?: Array<{ ownerId: string; percentage?: number; primary?: boolean }>
  units?: Array<{ unitNumber: string; bedrooms?: string; bathrooms?: string; sqFt?: number }>
  operatingBankAccountId?: string | null
  depositTrustAccountId?: string | null
  reserve?: string | null
  propertyManagerId?: string | null
  status?: string | null
  management_scope?: string | null
  service_assignment?: string | null
  service_plan?: string | null
  included_services?: string[] | string | null
  active_services?: string[] | string | null
  fee_assignment?: string | null
  fee_type?: string | null
  fee_percentage?: number | string | null
  fee_dollar_amount?: number | string | null
  billing_frequency?: string | null
}

interface OrgMembershipRow {
  org_id: string
}

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
      fee_dollar_amount,
      billing_frequency
    } = body

    const typedBody = body as PropertyRequestBody & {
      __insertedUnits?: Array<{ id: string; unit_number?: string; buildium_unit_id?: number | null }>
    }
    if (!Array.isArray(typedBody.__insertedUnits)) {
      typedBody.__insertedUnits = []
    }

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
        orgId = (first as OrgMembershipRow)?.org_id || null
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
    const extractOptionalText = (value: unknown): string | null => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }

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
      bill_pay_list: extractOptionalText(body?.bill_pay_list ?? body?.billPayList),
      bill_pay_notes: extractOptionalText(body?.bill_pay_notes ?? body?.billPayNotes),
      fee_assignment: normalizeAssignmentLevelEnum(fee_assignment),
      fee_type: normalizeFeeType(fee_type),
      fee_percentage: toNumberOrNull(fee_percentage),
      fee_dollar_amount: toNumberOrNull(fee_dollar_amount),
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

    const insertPayload: Record<string, unknown> = { ...propertyData }
    const performInsert = () =>
      db
        .from('properties')
        .insert(insertPayload as PropertiesInsert)
        .select()
        .single()

    let attempt = 0
    let property: PropertyRow | null = null
    let propertyError: any = null
    do {
      attempt += 1
      ;({ data: property, error: propertyError } = await performInsert())
      if (propertyError?.code === 'PGRST204') {
        const message = propertyError.message ?? ''
        const columnMatch = message.match(/'([^']+)' column/i)
        const column = columnMatch?.[1]
        if (column && column in insertPayload) {
          logger.warn(
            { column, attempt, error: propertyError },
            'Property insert retry after removing missing column from payload due to stale schema cache'
          )
          delete insertPayload[column]
          continue
        }
      }
      break
    } while (attempt < 5)

    if (propertyError) {
      logger.error({ error: propertyError, propertyData }, 'Error creating property (DB)')
      return NextResponse.json(
        { error: 'Failed to create property', details: propertyError.message },
        { status: 500 }
      )
    }

    const createdProperty = property as PropertyRow
    const rollbackProperty = async (reason: string) => {
      const propertyId = createdProperty.id
      try {
        await db.from('units').delete().eq('property_id', propertyId)
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason
          },
          'Rollback units failed after property create error'
        )
      }
      try {
        await db.from('ownerships').delete().eq('property_id', propertyId)
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason
          },
          'Rollback ownerships failed after property create error'
        )
      }
      try {
        await db.from('properties').delete().eq('id', propertyId)
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason
          },
          'Rollback property failed after property create error'
        )
      }
    }

    // Create ownership records if owners are provided
    if (owners && owners.length > 0) {
      // Ensure owners belong to the same org. If owner.org_id is null, backfill it.
      try {
        const ownerIds = owners.map((o: { id: string }) => o.id)
        if (ownerIds.length) {
          await db
            .from('owners')
            .update({ org_id: orgId })
            .in('id', ownerIds)
            .is('org_id', null)
        }
      } catch {}

      const ownershipRecords: OwnershipInsert[] = owners.map((owner: { id: string; ownershipPercentage?: number; disbursementPercentage?: number; primary?: boolean }) => ({
        owner_id: String(owner.id),
        property_id: createdProperty.id,
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
        await rollbackProperty('ownership insert failure')
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
        .filter((u) => (u?.unitNumber || '').trim().length > 0)
        .map((u) => {
          const unitNumber = String(u.unitNumber || '').trim()
          const bedrooms = normalizeUnitBedrooms(u.unitBedrooms)
          const bathrooms = normalizeUnitBathrooms(u.unitBathrooms)
          return {
            property_id: createdProperty.id,
            unit_number: unitNumber,
            unit_bedrooms: bedrooms,
            unit_bathrooms: bathrooms,
            unit_size: toNumberOrNull(u.unitSize),
            market_rent: toNumberOrNull(u.marketRent),
            description: u.description ?? null,
            address_line1: createdProperty.address_line1,
            address_line2: createdProperty.address_line2 ?? null,
            address_line3: createdProperty.address_line3 ?? null,
            city: createdProperty.city ?? null,
            state: createdProperty.state ?? null,
            postal_code: createdProperty.postal_code,
            country: createdProperty.country,
            created_at: now,
            updated_at: now,
            org_id: orgId,
            service_plan: normalizeServicePlan(u.servicePlan),
            fee_type: normalizeFeeType(u.feeType),
            fee_frequency: normalizeFeeFrequency(u.feeFrequency),
            fee_percent: toNumberOrNull(u.feePercent),
            fee_dollar_amount: toNumberOrNull(u.feeDollarAmount),
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
        const unitInsertPayloads = unitRows.map(row => ({ ...row } as Record<string, unknown>))
        let unitInsertAttempt = 0
        let insertedUnits: UnitsInsert[] | null = null
        let unitsErr: any = null
        do {
          unitInsertAttempt += 1
          const { data, error } = await db.from('units').insert(unitInsertPayloads as UnitsInsert[]).select('*')
          if (!error) {
            insertedUnits = data as UnitsInsert[] | null
            unitsErr = null
            break
          }
          unitsErr = error
          const errCode = (error as { code?: string }).code
          const errMessage = (error as { message?: string }).message ?? ''
          const errDetails = (error as { details?: string }).details ?? ''
          const errHint = (error as { hint?: string }).hint ?? ''
          const columnRegexes = [
            /'([^']+)' column/gi,
            /column "([^"]+)"/gi,
            /column ([a-z0-9_]+)/gi,
          ]
          let missingColumn: string | null = null
          for (const regex of columnRegexes) {
            let match: RegExpExecArray | null
            const sources = [errMessage, errDetails, errHint]
            for (const text of sources) {
              regex.lastIndex = 0
              match = regex.exec(text)
              if (match?.[1]) {
                missingColumn = match[1]
                break
              }
            }
            if (missingColumn) break
          }
          if ((errCode === 'PGRST204' || errCode === '42703') && missingColumn) {
            let removed = false
            for (const payload of unitInsertPayloads) {
              if (missingColumn in payload) {
                delete payload[missingColumn]
                removed = true
              }
            }
            if (removed) {
              logger.warn(
                { column: missingColumn, attempt: unitInsertAttempt, error: unitsErr },
                'Retrying unit insert without missing column due to stale schema cache'
              )
              continue
            }
          }
          break
        } while (unitInsertAttempt < 5)

        if (unitsErr) {
          logger.error({ error: unitsErr }, 'Error creating units (DB)')
          await rollbackProperty('unit insert failure')
          return NextResponse.json({ error: 'Failed to create units' }, { status: 500 })
        }
        const insertedUnitRows = insertedUnits ?? []
        typedBody.__insertedUnits = insertedUnitRows as Array<{ id: string; unit_number?: string; buildium_unit_id?: number | null }>
      }
    }

    if (syncToBuildium) {
      try {
        await recordSyncStatus(db, createdProperty.id, null, 'pending')
      } catch {}
      if (Array.isArray(typedBody.__insertedUnits) && typedBody.__insertedUnits.length > 0) {
        try {
          await Promise.all(
            typedBody.__insertedUnits.map((u) => recordSyncStatus(db, u.id, null, 'pending'))
          )
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
              let payload: Record<string, unknown> | undefined
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
                  const glId = (gl as { buildium_gl_account_id?: number })?.buildium_gl_account_id
                  if (typeof glId === 'number' && glId > 0) payload = { ...payload, GLAccountId: glId }
                }
              } catch {}
              const result = await buildiumEdgeClient.syncBankAccountToBuildium(payload || { id: ba.id } as Record<string, unknown>)
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
          reserve: toNumberOrNull(reserve),
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          state,
          postal_code: postalCode,
          country,
          year_built: toNumberOrNull(yearBuilt),
          rental_type: 'Rental',
          property_type: propertyType
        } as unknown as PropertyRow)
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
            if (pmId) (propertyPayload as unknown as Record<string, unknown>).PropertyManagerId = pmId
          } catch {}
        }
        if (prelinkedOwnerIds.length) (propertyPayload as unknown as Record<string, unknown>).RentalOwnerIds = prelinkedOwnerIds

        // If request included units, include them in the Buildium property create payload (per Buildium docs)
        let includedUnitsInCreate = false
        if (Array.isArray(units) && units.length > 0) {
          const toEnumBedrooms = (v: string | number | null | undefined): string | null => {
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
          const toEnumBathrooms = (v: string | number | null | undefined): string | null => {
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
            .filter((u) => (u?.unitNumber || '').trim().length > 0)
            .map((u) => ({
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
            ;(propertyPayload as unknown as Record<string, unknown>).Units = buildiumUnits
            includedUnitsInCreate = true
          }
        }

        // Validate required fields for Buildium property before attempting
        const propValidation = validateBuildiumPropertyPayload(propertyPayload)
        if (!propValidation.ok) {
          logger.warn({ missing: propValidation.missing }, 'Skipping Buildium property create: missing fields')
          try { await recordSyncStatus(db, createdProperty.id, null, 'failed', `Missing fields: ${propValidation.missing.join(', ')}`) } catch {}
        }

        // Mark syncing and attempt create
        try { await recordSyncStatus(db, createdProperty.id, null, 'syncing') } catch {}
        const _propAttempted = false
        if (propValidation.ok) {
          // Mark syncing and attempt create
          try { await recordSyncStatus(db, createdProperty.id, null, 'syncing') } catch {}
          const propRes = await buildiumFetch('POST', '/rentals', undefined, propertyPayload)
          // propAttempted = true
          if (propRes.ok && propRes.json?.Id) {
            const buildiumId = Number(propRes.json.Id)
            await db.from('properties').update({ buildium_property_id: buildiumId }).eq('id', createdProperty.id)
            try { await recordSyncStatus(db, createdProperty.id, buildiumId, 'synced') } catch {}
          } else {
            // Structured error logging to surface Buildium validation details (e.g., 422 field errors)
            const errorLog = {
              status: propRes.status,
              errorText: propRes.errorText,
              responseJson: propRes.json,
              requestPreview: {
                Name: (propertyPayload as unknown as Record<string, unknown>)?.Name,
                RentalType: (propertyPayload as unknown as Record<string, unknown>)?.RentalType,
                RentalSubType: (propertyPayload as unknown as Record<string, unknown>)?.RentalSubType,
                OperatingBankAccountId: (propertyPayload as unknown as Record<string, unknown>)?.OperatingBankAccountId,
                Address: (propertyPayload as unknown as Record<string, unknown>)?.Address,
                UnitsCount: Array.isArray((propertyPayload as unknown as Record<string, unknown>)?.Units) ? ((propertyPayload as unknown as Record<string, unknown>).Units as unknown[]).length : undefined,
              }
            }
            try { logger.warn(errorLog, 'Buildium property sync failed') } catch { console.warn('Buildium property sync failed', errorLog) }
            try { await recordSyncStatus(db, createdProperty.id, null, 'failed', `HTTP ${propRes.status}: ${propRes.errorText || 'unknown'}`) } catch {}
          }
        }
        const buildiumPropertyId = (await (async()=>{
          const { data } = await db.from('properties').select('buildium_property_id').eq('id', createdProperty.id).single()
          return data?.buildium_property_id as number | null
        })())

        // 3) Map Units via initial property create: if we included units, fetch them from Buildium and link IDs
        if (buildiumPropertyId) {
          const insertedUnits: Array<{ id: string; unit_number?: string; buildium_unit_id?: number }> = typedBody.__insertedUnits || []
          if (includedUnitsInCreate && insertedUnits.length > 0) {
            try { await Promise.all(insertedUnits.map(u => recordSyncStatus(db, u.id, null, 'syncing'))) } catch {}
            // Buildium units listing is property-scoped via query param
            const listRes = await buildiumFetch('GET', `/rentals/units`, { propertyids: buildiumPropertyId })
            if (listRes.ok && Array.isArray(listRes.json)) {
              const remoteUnits: Array<{ Id: number; UnitNumber: string }> = listRes.json
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
          const insertedUnits: Array<{ id: string }> = typedBody.__insertedUnits || []
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
          property_id: createdProperty.id,
          staff_id: propertyManagerId,
          role: 'Property Manager'
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
async function _searchBuildiumOwnerId(params: {
  email?: string
  firstName?: string
  lastName?: string
  buildiumPropertyId?: number
}): Promise<number | null> {
  const emailLc = (params.email || '').toLowerCase()
  const ownername = [(await params).firstName, (await params).lastName].filter(Boolean).join(' ').trim() || undefined
  const limit = 200
  let offset = 0
  const maxPages = 60 // up to 12,000 owners

  for (let page = 0; page < maxPages; page++) {
    const q: Record<string, unknown> = { limit, offset }
    if (params.buildiumPropertyId) q.propertyids = (await params).buildiumPropertyId
    if (ownername) q.ownername = ownername

    // Use /v1/rentals/owners with filters
    const res = await buildiumFetch('GET', '/rentals/owners', q)
    if (!res.ok || !Array.isArray(res.json)) break
    const arr: Array<Record<string, unknown>> = res.json

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
async function recordSyncStatus(db: typeof supabase, entityId: string, buildiumId: number | null, status: 'pending'|'syncing'|'synced'|'failed', errorMessage?: string) {
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
function validateBuildiumPropertyPayload(payload: Record<string, unknown> | { Name?: string; Address?: unknown; RentalType?: string; RentalSubType?: string }): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!payload?.Name) missing.push('Name')
  const addr = (payload?.Address as Record<string, unknown>) || {}
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
      city,
      state,
      property_type,
      status,
      created_at,
      total_vacant_units,
      total_inactive_units,
      total_occupied_units,
      total_active_units,
      primary_owner,
      operating_bank_account_id,
      deposit_trust_account_id
    `
    const withOwners = `${baseCols}, ownerships(id, owners(contacts(first_name, last_name, company_name)))`

    const columns = canJoinOwners ? withOwners : baseCols
    const { data, error } = await db
      .from('properties')
      .select(columns)
      .order('created_at', { ascending: false })
      .returns<PropertyWithOwners[]>()

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties' },
        { status: 500 }
      )
    }

    const managerIds = Array.from(
      new Set(
        (data || [])
          .map((p) => (p as any)?.property_manager_id)
          .filter((v): v is string | number => Boolean(v)),
      ),
    )

    const managerMap = new Map<
      string,
      { name: string; email?: string | null; phone?: string | null; role?: string | null }
    >()
    if (managerIds.length) {
      try {
        const { data: managers } = await db
          .from('staff')
          .select('id, display_name, first_name, last_name, email, phone, role')
          .in('id', managerIds as any)
        for (const mgr of managers || []) {
          const normalized = normalizeStaffRole((mgr as any)?.role)
          if (normalized === 'Property Manager') {
            const name =
              (mgr as any)?.display_name ||
              [(mgr as any)?.first_name, (mgr as any)?.last_name].filter(Boolean).join(' ').trim() ||
              'Property Manager'
            managerMap.set(String((mgr as any).id), {
              name,
              email: (mgr as any)?.email ?? null,
              phone: (mgr as any)?.phone ?? null,
              role: (mgr as any)?.role ?? null,
            })
          }
        }
      } catch (err) {
        console.warn('Failed to load property managers for list', err)
      }
    }

    const mapped = (data || []).map((p) => {
      const ownerships = Array.isArray(p?.ownerships) ? p.ownerships : []
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
      if (!primaryOwnerName && typeof p?.primary_owner === 'string') {
        const trimmed = p.primary_owner.trim()
        if (trimmed.length > 0) primaryOwnerName = trimmed
      }
      return {
        id: p.id,
        name: p.name,
        addressLine1: p.address_line1,
        city: p.city,
        state: p.state,
        propertyType: p.property_type,
        status: p.status,
        createdAt: p.created_at,
        totalVacantUnits: p.total_vacant_units ?? 0,
        totalInactiveUnits: p.total_inactive_units ?? 0,
        totalOccupiedUnits: p.total_occupied_units ?? 0,
        totalActiveUnits: p.total_active_units ?? 0,
        ownersCount,
        primaryOwnerName,
        propertyManagerName: managerMap.get(String((p as any)?.property_manager_id ?? ''))?.name ?? null,
        operatingBankAccountId: p.operating_bank_account_id,
        depositTrustAccountId: p.deposit_trust_account_id,
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
