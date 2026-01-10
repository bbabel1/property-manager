import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/db';
import { mapPropertyToBuildium, mapCountryToBuildium } from '@/lib/buildium-mappers';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { buildiumFetch } from '@/lib/buildium-http';
import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager';
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import type { Database as DatabaseSchema } from '@/types/database';
import {
  normalizeAssignmentLevel,
  normalizeAssignmentLevelEnum,
  normalizeCountryWithDefault,
  normalizePropertyStatus,
  normalizePropertyType,
  normalizeUnitBathrooms,
  normalizeUnitBedrooms,
  toNumberOrDefault,
  toNumberOrNull,
} from '@/lib/normalizers';
import { normalizeStaffRole } from '@/lib/staff-role';
import { enrichBuildingForProperty } from '@/lib/building-enrichment';
import { ComplianceSyncService } from '@/lib/compliance-sync-service';
import { buildNormalizedAddressKey } from '@/lib/normalized-address';
import type { BuildiumPropertyCreate } from '@/types/buildium';

type PropertiesInsert = DatabaseSchema['public']['Tables']['properties']['Insert'];
// type PropertiesUpdate = DatabaseSchema['public']['Tables']['properties']['Update'] // Unused
type UnitsInsert = DatabaseSchema['public']['Tables']['units']['Insert'];
type OwnershipInsert = DatabaseSchema['public']['Tables']['ownerships']['Insert'];
type PropertyRow = DatabaseSchema['public']['Tables']['properties']['Row'];
type OwnershipRow = DatabaseSchema['public']['Tables']['ownerships']['Row'];
type OwnerRow = DatabaseSchema['public']['Tables']['owners']['Row'];
type ContactRow = DatabaseSchema['public']['Tables']['contacts']['Row'];
type GlAccountRow = DatabaseSchema['public']['Tables']['gl_accounts']['Row'];
type BuildiumIdResponse = { Id?: number | string | null; id?: number | string | null };

type PropertyWithOwners = PropertyRow & {
  ownerships?: Array<
    OwnershipRow & {
      owners: (OwnerRow & { contacts: ContactRow | null }) | null;
    }
  > | null;
};
type PropertyListRow = PropertyWithOwners & {
  operating_bank_gl_account_id?: string | null;
  deposit_trust_gl_account_id?: string | null;
};
type PropertyStatusEnum = DatabaseSchema['public']['Enums']['property_status'];
type PropertyTypeEnum = DatabaseSchema['public']['Enums']['property_type_enum'];
type UpdateBuildiumSyncStatusArgs =
  DatabaseSchema['public']['Functions']['update_buildium_sync_status']['Args'];

const NYC_BOROUGHS = new Set(['manhattan', 'bronx', 'brooklyn', 'queens', 'staten island']);
const ENABLE_COMPLIANCE_SYNC_ON_CREATE =
  process.env.ENABLE_COMPLIANCE_SYNC_ON_CREATE === 'true';

interface PropertyRequestBody {
  propertyType: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  borough?: string | null;
  neighborhood?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationVerified?: boolean | null;
  yearBuilt?: number | string | null;
  structureDescription?: string | null;
  owners?: Array<{ ownerId: string; percentage?: number; primary?: boolean }>;
  units?: Array<{ unitNumber: string; bedrooms?: string; bathrooms?: string; sqFt?: number }>;
  operatingBankAccountId?: string | null;
  depositTrustAccountId?: string | null;
  reserve?: string | null;
  propertyManagerId?: string | null;
  status?: string | null;
  management_scope?: string | null;
  service_assignment?: string | null;
  bin?: string | null;
  bbl?: string | null;
  block?: string | null;
  lot?: string | null;
}

interface OrgMembershipRow {
  org_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const url = new URL(request.url);
    const syncToBuildium = url.searchParams.get('syncToBuildium') === 'true';
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
      bin,
      bbl,
      block,
      lot,
    } = body;

    const typedBody = body as PropertyRequestBody & {
      __insertedUnits?: Array<{
        id: string;
        unit_number?: string;
        buildium_unit_id?: number | null;
      }>;
    };
    if (!Array.isArray(typedBody.__insertedUnits)) {
      typedBody.__insertedUnits = [];
    }

    // Validate required fields
    if (!propertyType || !name || !addressLine1 || !city || !state || !postalCode || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve organization context (required by NOT NULL constraint and RLS policies)
    const db = supabaseAdmin || supabase;
    let orgId: string | null = request.headers.get('x-org-id') || null;
    if (!orgId) {
      // Fallback: pick the user's first org membership (handle 0, 1, or many rows)
      try {
        const { data: rows, error: membershipsError } = await db
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1);
        if (membershipsError) {
          logger.error({ error: membershipsError, userId: user.id }, 'Failed to resolve org memberships');
          return NextResponse.json(
            { error: 'Failed to resolve organization context' },
            { status: 500 },
          );
        }
        const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        orgId = (first as OrgMembershipRow)?.org_id || null;
      } catch {}
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const cleanId = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    const manualBin = cleanId(bin);
    const manualBbl = cleanId(bbl);
    const manualBlock = cleanId(block);
    const manualLot = cleanId(lot);

    // Create property data object matching database schema (snake_case)
    const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(country ?? ''));
    const normalizedPropertyType = normalizePropertyType(propertyType);
    const propertyStatus = normalizePropertyStatus(status);
    const normalizedManagementScope = normalizeAssignmentLevelEnum(management_scope);
    const normalizedServiceAssignment = normalizeAssignmentLevel(service_assignment);

    // Phase 5: bank accounts are modeled as gl_accounts rows flagged with is_bank_account=true.
    // Coerce empty-string UUID fields to null to satisfy DB uuid type.
    const operatingGlId =
      typeof operatingBankAccountId === 'string' && operatingBankAccountId.trim() === ''
        ? null
        : (operatingBankAccountId ?? null);
    const depositGlId =
      typeof depositTrustAccountId === 'string' && depositTrustAccountId.trim() === ''
        ? null
        : (depositTrustAccountId ?? null);

    const selectedBankGlIds = [operatingGlId, depositGlId].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (selectedBankGlIds.length) {
      const { data: glRows, error: glErr } = await db
        .from('gl_accounts')
        .select('id, is_bank_account')
        .eq('org_id', orgId)
        .in('id', selectedBankGlIds);
      if (glErr) throw glErr;
      const invalid = (glRows ?? [])
        .filter((row): row is GlAccountRow => row?.is_bank_account !== true)
        .map((row) => row.id);
      if (invalid.length) {
        return NextResponse.json(
          { error: 'Selected GL account is not a bank account', invalid },
          { status: 422 },
        );
      }
    }

    const now = new Date().toISOString();
    const extractOptionalText = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    if (!normalizedManagementScope) {
      return NextResponse.json(
        { error: 'Management scope is required (Building or Unit).' },
        { status: 422 },
      );
    }

    if (!normalizedServiceAssignment) {
      return NextResponse.json(
        { error: 'Service assignment is required (Property Level or Unit Level).' },
        { status: 422 },
      );
    }

    const normalizedAddress = buildNormalizedAddressKey({
      addressLine1,
      city,
      state,
      postalCode,
      country,
      borough: body?.borough ?? body?.city ?? null,
    });

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
      reserve: toNumberOrNull(reserve),
      year_built: toNumberOrNull(yearBuilt),
      status: propertyStatus,
      is_active: propertyStatus === 'Active',
      rental_owner_ids: null,
      normalized_address_key: normalizedAddress?.normalizedAddressKey || null,
      management_scope: normalizedManagementScope,
      service_assignment: normalizedServiceAssignment,
      bill_pay_list: extractOptionalText(body?.bill_pay_list ?? body?.billPayList),
      bill_pay_notes: extractOptionalText(body?.bill_pay_notes ?? body?.billPayNotes),
      borough: typeof body?.borough === 'string' && body.borough.trim() ? body.borough : null,
      neighborhood:
        typeof body?.neighborhood === 'string' && body.neighborhood.trim()
          ? body.neighborhood
          : null,
      longitude: toNumberOrNull(body?.longitude),
      latitude: toNumberOrNull(body?.latitude),
      location_verified:
        body?.locationVerified != null
          ? !!body.locationVerified
          : body?.location_verified != null
            ? !!body.location_verified
            : null,
      org_id: orgId,
      created_at: now,
      updated_at: now,
    };

    propertyData.operating_bank_gl_account_id = operatingGlId;
    propertyData.deposit_trust_gl_account_id = depositGlId;

    let enrichmentResult: Awaited<ReturnType<typeof enrichBuildingForProperty>> | null = null;
    let enrichmentFailed = false;
    try {
      enrichmentResult = await enrichBuildingForProperty(
        {
          addressLine1,
          city,
          state,
          postalCode,
          country,
          borough: body?.borough ?? body?.city ?? null,
          neighborhood: body?.neighborhood ?? null,
          latitude: toNumberOrNull(body?.latitude),
          longitude: toNumberOrNull(body?.longitude),
          normalizedAddressKey: normalizedAddress?.normalizedAddressKey || null,
          bin: manualBin,
          bbl: manualBbl,
          block: manualBlock,
          lot: manualLot,
        },
        {
          db,
          normalizedAddressKey: normalizedAddress?.normalizedAddressKey || null,
          binOverride: manualBin,
          bblOverride: manualBbl,
          blockOverride: manualBlock,
          lotOverride: manualLot,
        },
      );
    } catch (enrichErr) {
      const message = enrichErr instanceof Error ? enrichErr.message : 'Address enrichment failed';
      logger.error({ error: message }, 'Address enrichment failed');
      enrichmentFailed = true;
      propertyData.location_verified = false;
      const fallbackPatch: Partial<PropertiesInsert> = {
        normalized_address_key: normalizedAddress?.normalizedAddressKey || null,
        borough: propertyData.borough ?? null,
        neighborhood: propertyData.neighborhood ?? null,
        location_verified: false,
      };
      if (manualBin) fallbackPatch.bin = manualBin;
      if (manualBbl) fallbackPatch.bbl = manualBbl;
      const fallbackBlock = toNumberOrNull(manualBlock);
      if (fallbackBlock !== null) fallbackPatch.block = fallbackBlock;
      const fallbackLot = toNumberOrNull(manualLot);
      if (fallbackLot !== null) fallbackPatch.lot = fallbackLot;
      enrichmentResult = {
        building: null,
        propertyPatch: fallbackPatch,
        errors: [message],
      };
    }

    if (enrichmentResult?.propertyPatch) {
      const propertyPatch = enrichmentResult.propertyPatch as Partial<PropertiesInsert>;
      Object.assign(
        propertyData,
        Object.fromEntries(
          Object.entries(propertyPatch).filter(([, value]) => value !== undefined),
        ),
      );
    }

    const boroughName = propertyData.borough;
    const boroughLc = boroughName ? boroughName.toLowerCase() : null;
    const isNYC = boroughLc ? NYC_BOROUGHS.has(boroughLc) : false;
    if (isNYC && !propertyData.bin) {
      if (!enrichmentFailed) {
        return NextResponse.json(
          {
            error: 'BIN required for NYC properties to sync elevators',
            details: 'Provide a BIN or use the address autocomplete so Geoservice can resolve it',
          },
          { status: 422 },
        );
      }
      logger.warn(
        { borough: boroughName, errors: enrichmentResult?.errors || [] },
        'Skipping BIN requirement because address enrichment failed',
      );
    }

    const insertPayload: Record<string, unknown> = { ...propertyData };
    const performInsert = () =>
      db
        .from('properties')
        .insert(insertPayload as PropertiesInsert)
        .select()
        .single();

    let attempt = 0;
    let property: PropertyRow | null = null;
    let propertyError: { code?: string; message?: string } | null = null;
    do {
      attempt += 1;
      ({ data: property, error: propertyError } = await performInsert());
      if (propertyError?.code === 'PGRST204' && propertyError.message) {
        const columnMatch = propertyError.message.match(/'([^']+)' column/i);
        const column = columnMatch?.[1];
        if (column && column in insertPayload) {
          logger.warn(
            { column, attempt, error: propertyError },
            'Property insert retry after removing missing column from payload due to stale schema cache',
          );
          delete insertPayload[column];
          continue;
        }
      }
      break;
    } while (attempt < 5);

    if (propertyError) {
      logger.error({ error: propertyError, propertyData }, 'Error creating property (DB)');
      return NextResponse.json(
        { error: 'Failed to create property', details: propertyError.message },
        { status: 500 },
      );
    }

    const createdProperty = property as PropertyRow;
    const rollbackProperty = async (reason: string) => {
      const propertyId = createdProperty.id;
      try {
        await db.from('units').delete().eq('property_id', propertyId);
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason,
          },
          'Rollback units failed after property create error',
        );
      }
      try {
        await db.from('ownerships').delete().eq('property_id', propertyId);
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason,
          },
          'Rollback ownerships failed after property create error',
        );
      }
      try {
        await db.from('properties').delete().eq('id', propertyId);
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            propertyId,
            reason,
          },
          'Rollback property failed after property create error',
        );
      }
    };

    // Create ownership records if owners are provided
    if (owners && owners.length > 0) {
      // Ensure owners belong to the same org. If owner.org_id is null, backfill it.
      try {
        const ownerIds = owners.map((o: { id: string }) => o.id);
        if (ownerIds.length) {
          await db.from('owners').update({ org_id: orgId }).in('id', ownerIds).is('org_id', null);
        }
      } catch {}

      const ownershipRecords: OwnershipInsert[] = owners.map(
        (owner: {
          id: string;
          ownershipPercentage?: number;
          disbursementPercentage?: number;
          primary?: boolean;
        }) => ({
          owner_id: String(owner.id),
          property_id: createdProperty.id,
          ownership_percentage: toNumberOrDefault(owner.ownershipPercentage, 0),
          disbursement_percentage: toNumberOrDefault(owner.disbursementPercentage, 0),
          primary: Boolean(owner.primary),
          created_at: now,
          updated_at: now,
          org_id: orgId,
        }),
      );

      // Use correct table name 'ownerships'
      const { error: ownershipError } = await db.from('ownerships').insert(ownershipRecords);

      if (ownershipError) {
        console.error('Error creating ownership records:', ownershipError);
        await rollbackProperty('ownership insert failure');
        return NextResponse.json({ error: 'Failed to create ownership records' }, { status: 500 });
      }

      // Note: primary_owner field has been removed; ownership is managed solely
      // through the 'ownerships' table. No additional property update needed.
    }

    // Create units if provided
    if (Array.isArray(units) && units.length > 0) {
      const unitRows: UnitsInsert[] = units
        .filter((u) => (u?.unitNumber || '').trim().length > 0)
        .map((u) => {
          const unitNumber = String(u.unitNumber || '').trim();
          const bedrooms = normalizeUnitBedrooms(u.unitBedrooms);
          const bathrooms = normalizeUnitBathrooms(u.unitBathrooms);
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
            unit_type: u.unitType ?? null,
            service_start: u.serviceStart ?? null,
            service_end: u.serviceEnd ?? null,
            is_active: typeof u.isActive === 'boolean' ? u.isActive : null,
          };
        });
      if (unitRows.length) {
        const unitInsertPayloads = unitRows.map((row) => ({ ...row }));
        let unitInsertAttempt = 0;
        let insertedUnits: UnitsInsert[] | null = null;
        let unitsErr: { code?: string; message?: string; details?: string; hint?: string } | null =
          null;
        do {
          unitInsertAttempt += 1;
          const { data, error } = await db
            .from('units')
            .insert(unitInsertPayloads as UnitsInsert[])
            .select('*');
          if (!error) {
            insertedUnits = data as UnitsInsert[] | null;
            unitsErr = null;
            break;
          }
          unitsErr = error;
          const errCode = (error as { code?: string }).code;
          const errMessage = (error as { message?: string }).message ?? '';
          const errDetails = (error as { details?: string }).details ?? '';
          const errHint = (error as { hint?: string }).hint ?? '';
          const columnRegexes = [
            /'([^']+)' column/gi,
            /column "([^"]+)"/gi,
            /column ([a-z0-9_]+)/gi,
          ];
          let missingColumn: string | null = null;
          for (const regex of columnRegexes) {
            let match: RegExpExecArray | null;
            const sources = [errMessage, errDetails, errHint];
            for (const text of sources) {
              regex.lastIndex = 0;
              match = regex.exec(text);
              if (match?.[1]) {
                missingColumn = match[1];
                break;
              }
            }
            if (missingColumn) break;
          }
          if ((errCode === 'PGRST204' || errCode === '42703') && missingColumn) {
            let removed = false;
            for (const payload of unitInsertPayloads) {
              const payloadRecord = payload as unknown as Record<string, unknown>;
              if (missingColumn in payloadRecord) {
                delete payloadRecord[missingColumn];
                removed = true;
              }
            }
            if (removed) {
              logger.warn(
                { column: missingColumn, attempt: unitInsertAttempt, error: unitsErr },
                'Retrying unit insert without missing column due to stale schema cache',
              );
              continue;
            }
          }
          break;
        } while (unitInsertAttempt < 5);

        if (unitsErr) {
          logger.error({ error: unitsErr }, 'Error creating units (DB)');
          await rollbackProperty('unit insert failure');
          return NextResponse.json({ error: 'Failed to create units' }, { status: 500 });
        }
        const insertedUnitRows = insertedUnits ?? [];
        typedBody.__insertedUnits = insertedUnitRows as Array<{
          id: string;
          unit_number?: string;
          buildium_unit_id?: number | null;
        }>;
      }
    }

    if (syncToBuildium) {
      try {
        await recordSyncStatus(db, createdProperty.id, null, 'pending');
      } catch {}
      if (Array.isArray(typedBody.__insertedUnits) && typedBody.__insertedUnits.length > 0) {
        try {
          await Promise.all(
            typedBody.__insertedUnits.map((u) => recordSyncStatus(db, u.id, null, 'pending')),
          );
        } catch {}
      }
    }

    // ===================== Buildium Sync (Property → Units → Owners) =====================
    try {
      // Only attempt if explicitly requested and Buildium credentials are configured
      const buildiumConfig = await getOrgScopedBuildiumConfig(orgId);
      if (syncToBuildium && buildiumConfig) {
        // 1) Ensure Owners exist in Buildium and collect their Buildium IDs
        const prelinkedOwnerIds: number[] = [];
        if (owners && owners.length > 0) {
          for (const o of owners) {
            try {
              const { data: localOwner, error: localOwnerError } = await db
                .from('owners')
                .select('*')
                .eq('id', o.id)
                .single();
              if (localOwnerError) {
                logger.warn(
                  { ownerId: o.id, error: localOwnerError },
                  'Failed to load owner before Buildium sync',
                );
                continue;
              }
              if (!localOwner) continue;
              if (localOwner.buildium_owner_id) {
                prelinkedOwnerIds.push(Number(localOwner.buildium_owner_id));
                continue;
              }
              // Create owner in Buildium when missing
              const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
              const ownerSync = await edgeClient.syncOwnerToBuildium(localOwner);
              if (ownerSync.success && ownerSync.buildiumId) {
                prelinkedOwnerIds.push(ownerSync.buildiumId);
                try {
                  await db
                    .from('owners')
                    .update({
                      buildium_owner_id: ownerSync.buildiumId,
                      buildium_updated_at: new Date().toISOString(),
                    })
                    .eq('id', localOwner.id);
                } catch {}
              } else {
                logger.warn(
                  { ownerId: localOwner.id, error: ownerSync.error },
                  'Failed to sync owner to Buildium prior to property create',
                );
              }
            } catch (e) {
              logger.warn(
                { error: e instanceof Error ? e.message : String(e) },
                'Error ensuring owner Buildium ID',
              );
            }
          }
        }

        // 2) Resolve Operating Bank Account ID for Buildium
        // In Buildium, the GL Account ID for a bank account IS the bank account ID
        let buildiumOperatingBankAccountId: number | undefined;
        if (operatingGlId) {
          try {
            const { data: gl, error: glLookupError } = await db
              .from('gl_accounts')
              .select('id, buildium_gl_account_id, is_bank_account')
              .eq('id', operatingGlId)
              .maybeSingle();

            if (glLookupError) {
              logger.warn(
                { error: glLookupError, glAccountId: operatingGlId },
                'Unable to resolve operating bank account for Buildium',
              );
            } else if (gl?.buildium_gl_account_id && gl.buildium_gl_account_id > 0) {
              // Use the GL account ID directly as the bank account ID
              buildiumOperatingBankAccountId = gl.buildium_gl_account_id;
            }
          } catch (e) {
            logger.warn(
              { error: e instanceof Error ? e.message : String(e) },
              'Unable to resolve operating bank account for Buildium',
            );
          }
        }
        const propertyPayload = mapPropertyToBuildium({
          name,
          structure_description: structureDescription || undefined,
          is_active: status !== 'Inactive',
          buildium_operating_bank_account_id: buildiumOperatingBankAccountId,
          reserve: toNumberOrNull(reserve),
          address_line1: addressLine1 || '',
          address_line2: addressLine2 || undefined,
          city: city || '',
          state: state || '',
          postal_code: postalCode || '',
          country: country || 'United States',
          year_built: toNumberOrNull(yearBuilt),
          rental_type: 'Rental',
          property_type: propertyType || null,
        }) as BuildiumPropertyCreate & Record<string, unknown>;
        // Attach PropertyManagerId from staff.buildium_staff_id when available
        if (propertyManagerId) {
          try {
            const { data: pm, error: pmError } = await db
              .from('staff')
              .select('buildium_staff_id')
              .eq('id', propertyManagerId)
              .not('buildium_staff_id', 'is', null)
              .single();
            if (pmError) {
              logger.warn(
                { error: pmError, propertyManagerId, staffId: propertyManagerId },
                'Unable to load property manager Buildium staff id',
              );
            } else if (pm?.buildium_staff_id != null) {
              const pmId = Number(pm.buildium_staff_id);
              if (Number.isFinite(pmId)) {
                propertyPayload.PropertyManagerId = pmId;
              } else {
                logger.warn(
                  { propertyManagerId, staffId: propertyManagerId, buildiumStaffId: pm.buildium_staff_id },
                  'Invalid Buildium staff id for property manager; skipping PropertyManagerId',
                );
              }
            }
          } catch (error) {
            logger.warn(
              { error, propertyManagerId, staffId: propertyManagerId },
              'Unexpected error loading property manager Buildium staff id',
            );
          }
        }
        if (prelinkedOwnerIds.length)
          propertyPayload.RentalOwnerIds = prelinkedOwnerIds;

        // If request included units, include them in the Buildium property create payload (per Buildium docs)
        let includedUnitsInCreate = false;
        if (Array.isArray(units) && units.length > 0) {
          const toEnumBedrooms = (v: string | number | null | undefined): string | null => {
            switch (String(v || '').trim()) {
              case 'Studio':
                return 'Studio';
              case '1':
                return 'OneBed';
              case '2':
                return 'TwoBed';
              case '3':
                return 'ThreeBed';
              case '4':
                return 'FourBed';
              case '5':
                return 'FiveBed';
              case '6':
                return 'SixBed';
              case '7':
                return 'SevenBed';
              case '8':
                return 'EightBed';
              case '9':
              case '9+':
                return 'NineBedPlus';
              case '5+':
                return 'FiveBed';
              default:
                return 'NotSet';
            }
          };
          const toEnumBathrooms = (v: string | number | null | undefined): string | null => {
            switch (String(v || '').trim()) {
              case '1':
                return 'OneBath';
              case '1.5':
                return 'OnePointFiveBath';
              case '2':
                return 'TwoBath';
              case '2.5':
                return 'TwoPointFiveBath';
              case '3':
                return 'ThreeBath';
              case '3.5':
                return 'ThreePointFiveBath';
              case '4':
                return 'FourBath';
              case '4.5':
                return 'FourPointFiveBath';
              case '5':
                return 'FiveBath';
              case '5+':
                return 'FivePlusBath';
              case '4+':
                return 'FourBath'; // Fallback for 4+
              default:
                return 'NotSet';
            }
          };
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
                Country: mapCountryToBuildium(country) || 'UnitedStates',
              },
            }));
          if (buildiumUnits.length) {
            (propertyPayload as unknown as Record<string, unknown>).Units = buildiumUnits;
            includedUnitsInCreate = true;
          }
        }

        // Validate required fields for Buildium property before attempting
        const propValidation = validateBuildiumPropertyPayload(propertyPayload);
        if (!propValidation.ok) {
          logger.warn(
            { missing: propValidation.missing },
            'Skipping Buildium property create: missing fields',
          );
          try {
            await recordSyncStatus(
              db,
              createdProperty.id,
              null,
              'failed',
              `Missing fields: ${propValidation.missing.join(', ')}`,
            );
          } catch {}
        }

        // Mark syncing and attempt create
        try {
          await recordSyncStatus(db, createdProperty.id, null, 'syncing');
        } catch {}
        const _propAttempted = false;
        if (propValidation.ok) {
          // Mark syncing and attempt create
          try {
            await recordSyncStatus(db, createdProperty.id, null, 'syncing');
          } catch {}
          const propRes = await buildiumFetch('POST', '/rentals', undefined, propertyPayload, orgId);
          const propResJson = propRes.json as BuildiumIdResponse;
          // propAttempted = true
          if (propRes.ok && propResJson?.Id) {
            const buildiumId = Number(propResJson.Id);
            await db
              .from('properties')
              .update({ buildium_property_id: buildiumId })
              .eq('id', createdProperty.id);
            try {
              await recordSyncStatus(db, createdProperty.id, buildiumId, 'synced');
            } catch {}
          } else {
            // Structured error logging to surface Buildium validation details (e.g., 422 field errors)
            const errorLog = {
              status: propRes.status,
              errorText: propRes.errorText,
              responseJson: propRes.json,
              requestPreview: {
                Name: propertyPayload.Name,
                RentalType: propertyPayload.RentalType,
                RentalSubType: propertyPayload.RentalSubType,
                OperatingBankAccountId: propertyPayload.OperatingBankAccountId,
                Address: propertyPayload.Address,
                UnitsCount: Array.isArray(propertyPayload.Units)
                  ? (propertyPayload.Units as unknown[]).length
                  : undefined,
              },
            };
            try {
              logger.warn(errorLog, 'Buildium property sync failed');
            } catch {
              console.warn('Buildium property sync failed', errorLog);
            }
            try {
              await recordSyncStatus(
                db,
                createdProperty.id,
                null,
                'failed',
                `HTTP ${propRes.status}: ${propRes.errorText || 'unknown'}`,
              );
            } catch {}
          }
        }
        const buildiumPropertyId = await (async () => {
          const { data, error: buildiumIdError } = await db
            .from('properties')
            .select('buildium_property_id')
            .eq('id', createdProperty.id)
            .single();
          if (buildiumIdError) {
            logger.warn(
              { error: buildiumIdError, propertyId: createdProperty.id },
              'Failed to load Buildium property id after sync',
            );
            return null;
          }
          return data?.buildium_property_id as number | null;
        })();

        // 3) Map Units via initial property create: if we included units, fetch them from Buildium and link IDs
        if (buildiumPropertyId) {
          const insertedUnits: Array<{
            id: string;
            unit_number?: string;
            buildium_unit_id?: number;
          }> = (typedBody.__insertedUnits || []).map((u) => ({
            id: u.id,
            unit_number: u.unit_number,
            buildium_unit_id: u.buildium_unit_id == null ? undefined : Number(u.buildium_unit_id),
          }));
          if (includedUnitsInCreate && insertedUnits.length > 0) {
            try {
              await Promise.all(
                insertedUnits.map((u) => recordSyncStatus(db, u.id, null, 'syncing')),
              );
            } catch {}
            // Buildium units listing is property-scoped via query param
            const listRes = await buildiumFetch('GET', `/rentals/units`, {
              propertyids: buildiumPropertyId,
            }, undefined, orgId);
            if (listRes.ok && Array.isArray(listRes.json)) {
              const remoteUnits: Array<{ Id: number; UnitNumber: string }> = listRes.json;
              for (const local of insertedUnits) {
                const match = remoteUnits.find(
                  (it) => String(it?.UnitNumber || '') === String(local.unit_number || ''),
                );
                if (match?.Id) {
                  const buId = Number(match.Id);
                  await db.from('units').update({ buildium_unit_id: buId }).eq('id', local.id);
                  try {
                    await recordSyncStatus(db, local.id, buId, 'synced');
                  } catch {}
                } else {
                  try {
                    await recordSyncStatus(
                      db,
                      local.id,
                      null,
                      'failed',
                      'Unit not found after property create',
                    );
                  } catch {}
                }
              }
            } else {
              // Could not fetch units; mark as failed with context
              try {
                logger.warn(
                  { status: listRes.status, error: listRes.errorText, responseJson: listRes.json },
                  'Buildium units fetch after property create failed',
                );
              } catch {}
              for (const local of insertedUnits) {
                try {
                  await recordSyncStatus(
                    db,
                    local.id,
                    null,
                    'failed',
                    `Units fetch failed: HTTP ${listRes.status}`,
                  );
                } catch {}
              }
            }
          }
        } else {
          // Property didn't sync; mark any units as failed
          const insertedUnits: Array<{ id: string }> = typedBody.__insertedUnits || [];
          if (insertedUnits.length > 0) {
            for (const local of insertedUnits) {
              try {
                await recordSyncStatus(
                  db,
                  local.id,
                  null,
                  'failed',
                  'Property did not sync to Buildium',
                );
              } catch {}
            }
          }
        }

        // 4) Create/link owners now that we have a Buildium PropertyId
        if (buildiumPropertyId && owners && owners.length > 0) {
          const rentalOwnerIds: number[] = [...prelinkedOwnerIds];
          for (const o of owners) {
            let buildiumOwnerId: number | null = null;
            const { data: localOwner, error: localOwnerLookupError } = await db
              .from('owners')
              .select('id, buildium_owner_id, contact_id')
              .eq('id', o.id)
              .single();
            if (localOwnerLookupError) {
              logger.warn(
                { ownerId: o.id, error: localOwnerLookupError },
                'Failed to load owner during Buildium sync',
              );
              continue;
            }
            if (!localOwner) continue;
            buildiumOwnerId = localOwner.buildium_owner_id || null;
            if (!buildiumOwnerId) {
              if (!localOwner.contact_id) continue;
              const { data: contact, error: contactError } = await db
                .from('contacts')
                .select('*')
                .eq('id', localOwner.contact_id)
                .single();
              if (contactError) {
                logger.warn(
                  { error: contactError, contactId: localOwner.contact_id },
                  'Failed to load contact for owner sync',
                );
                continue;
              }
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
                    Country:
                      mapCountryToBuildium(contact.primary_country) ||
                      mapCountryToBuildium(country) ||
                      'UnitedStates',
                  },
                  IsActive: true,
                  PropertyIds: [buildiumPropertyId],
                };
                const ownerSync = await buildiumFetch(
                  'POST',
                  '/rentals/owners',
                  undefined,
                  ownerPayload,
                  orgId,
                );
                const ownerSyncJson = ownerSync.json as BuildiumIdResponse;
                if (ownerSync.ok && ownerSyncJson?.Id) {
                  buildiumOwnerId = Number(ownerSyncJson.Id);
                  await db
                    .from('owners')
                    .update({ buildium_owner_id: buildiumOwnerId })
                    .eq('id', localOwner.id);
                } else {
                  console.warn(
                    'Buildium owner create failed:',
                    ownerSync.status,
                    ownerSync.errorText,
                  );
                }
              }
            }
            if (buildiumOwnerId) rentalOwnerIds.push(buildiumOwnerId);
          }
          // Update property with full owner set
          if (rentalOwnerIds.length) {
            await buildiumFetch(
              'PUT',
              `/rentals/${buildiumPropertyId}`,
              undefined,
              {
                ...(propertyPayload as unknown as Record<string, unknown>),
                RentalOwnerIds: rentalOwnerIds,
              },
              orgId,
            );
          }
        }
      }
    } catch (syncErr) {
      console.warn('Non-fatal: Buildium sync block failed:', syncErr);
    }

    // Create property staff record if property manager is assigned
    if (propertyManagerId) {
      const { error: staffError } = await db.from('property_staff').insert({
        property_id: createdProperty.id,
        staff_id: propertyManagerId,
        role: 'Property Manager',
      });

      if (staffError) {
        console.error('Error creating property staff record:', staffError);
      }
    }

    // Kick off compliance sync for NYC properties so assets/filings exist before program assignment
    if (ENABLE_COMPLIANCE_SYNC_ON_CREATE && boroughLc && NYC_BOROUGHS.has(boroughLc)) {
      try {
        const complianceSync = new ComplianceSyncService();
        await complianceSync.syncPropertyCompliance(createdProperty.id, orgId);
      } catch (syncErr) {
        logger.warn(
          {
            error: syncErr instanceof Error ? syncErr.message : String(syncErr),
            propertyId: createdProperty.id,
            orgId,
          },
          'Compliance sync after property creation failed',
        );
      }
    }

    return NextResponse.json(
      {
        message: 'Property created successfully',
        property: property,
        building: enrichmentResult?.building || null,
        enrichment_errors: enrichmentResult?.errors || [],
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error creating property',
    );
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}

// Buildium HTTP helper moved to '@/lib/buildium-http'

// Helper: robust Buildium owner search with optional filters and pagination
async function _searchBuildiumOwnerId(params: {
  email?: string;
  firstName?: string;
  lastName?: string;
  buildiumPropertyId?: number;
  orgId?: string;
}): Promise<number | null> {
  const emailLc = (params.email || '').toLowerCase();
  const ownername = [params.firstName, params.lastName].filter(Boolean).join(' ').trim() || undefined;
  const limit = 200;
  let offset = 0;
  const maxPages = 60; // up to 12,000 owners

  for (let page = 0; page < maxPages; page++) {
    const q: Record<string, string | number | boolean | null | undefined> = { limit, offset };
    if (params.buildiumPropertyId) q.propertyids = params.buildiumPropertyId;
    if (ownername) q.ownername = ownername;

    // Use /v1/rentals/owners with filters
    const res = await buildiumFetch('GET', '/rentals/owners', q, undefined, params.orgId);
    if (!res.ok || !Array.isArray(res.json)) break;
    const arr: Array<Record<string, unknown>> = res.json;

    // If searching by email, match locally (case-insensitive)
    if (emailLc) {
      const match = arr.find((it) => String(it?.Email || '').toLowerCase() === emailLc);
      if (match?.Id) return Number(match.Id);
    }

    // As a secondary heuristic, if ownername was provided, try an exact name match on FirstName/LastName
    if (ownername) {
      const [fn, ...lnp] = ownername.split(' ');
      const ln = lnp.join(' ').trim();
      const matchByName = arr.find(
        (it) =>
          String(it?.FirstName || '').toLowerCase() === (fn || '').toLowerCase() &&
          String(it?.LastName || '').toLowerCase() === (ln || '').toLowerCase(),
      );
      if (matchByName?.Id) return Number(matchByName.Id);
    }

    if (arr.length < limit) break; // no more pages
    offset += limit;
  }
  return null;
}

// Record sync status via RPC (entity_type = 'Rental' for both properties and units)
async function recordSyncStatus(
  db: typeof supabase,
  entityId: string,
  buildiumId: number | null,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  errorMessage?: string,
) {
  try {
    const rpcArgs: UpdateBuildiumSyncStatusArgs = {
      p_entity_type: 'Rental',
      p_entity_id: entityId,
      // Supabase type generator marks this as number-only, but the function accepts null
      p_buildium_id: (buildiumId ?? null) as unknown as number,
      p_status: status,
      p_error_message: errorMessage ?? undefined,
    };
    await db.rpc('update_buildium_sync_status', rpcArgs);
  } catch (e) {
    console.warn('recordSyncStatus failed', (e as Error).message);
  }
}

// Validate required fields for Buildium property create
function validateBuildiumPropertyPayload(
  payload:
    | Record<string, unknown>
    | { Name?: string; Address?: unknown; RentalType?: string; RentalSubType?: string },
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!payload?.Name) missing.push('Name');
  const addr = (payload?.Address as Record<string, unknown>) || {};
  if (!addr?.AddressLine1) missing.push('Address.AddressLine1');
  if (!addr?.City) missing.push('Address.City');
  if (!addr?.State) missing.push('Address.State');
  if (!addr?.PostalCode) missing.push('Address.PostalCode');
  if (!addr?.Country) missing.push('Address.Country');
  if (!payload?.RentalType) missing.push('RentalType');
  if (!payload?.RentalSubType) missing.push('RentalSubType');
  // OperatingBankAccountId is optional per Buildium schema
  // if (!payload?.OperatingBankAccountId) missing.push('OperatingBankAccountId')
  return { ok: missing.length === 0, missing };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim();
    const statusParam = url.searchParams.get('status') || 'all';
    const validStatuses: PropertyStatusEnum[] = ['Active', 'Inactive'];
    const statusFilter: PropertyStatusEnum | 'all' = validStatuses.includes(
      statusParam as PropertyStatusEnum,
    )
      ? (statusParam as PropertyStatusEnum)
      : 'all';
    const typeParam = url.searchParams.get('type') || 'all';
    const validTypes: PropertyTypeEnum[] = [
      'Condo',
      'Co-op',
      'Condop',
      'Rental Building',
      'Townhouse',
      'Mult-Family',
    ];
    const typeFilter: PropertyTypeEnum | 'all' | 'none' =
      typeParam === 'none'
        ? 'none'
        : validTypes.includes(typeParam as PropertyTypeEnum)
          ? (typeParam as PropertyTypeEnum)
          : 'all';
    const sortDir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
    const pageParam = Number(url.searchParams.get('page') || '1');
    const sizeParam = Number(url.searchParams.get('pageSize') || '25');
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize =
      Number.isFinite(sizeParam) && sizeParam > 0 ? Math.min(sizeParam, 100) : 25;

    // Resolve org context (header preferred; fallback to first membership)
    let orgId: string | null = request.headers.get('x-org-id') || null;
    if (!orgId) {
      try {
        const { data: memberships, error: membershipsError } = await (supabaseAdmin || supabase)
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1);
        if (membershipsError) {
          logger.error(
            { error: membershipsError, userId: user.id },
            'Failed to resolve org for properties list',
          );
        }
        const first = Array.isArray(memberships) && memberships.length > 0 ? memberships[0] : null;
        orgId = (first as OrgMembershipRow | null)?.org_id ?? null;
      } catch (err) {
        console.warn('Failed to resolve orgId for properties list', err);
      }
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;
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
      operating_bank_gl_account_id,
      deposit_trust_gl_account_id
    `;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = db
      .from('properties')
      .select(baseCols, { count: 'exact' })
      .eq('org_id', orgId);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (typeFilter !== 'all') {
      if (typeFilter === 'none') query = query.is('property_type', null);
      else query = query.eq('property_type', typeFilter);
    }
    if (search.length > 1) {
      const like = `%${search.replace(/[%_]/g, '\\$&')}%`;
      query = query.or(
        [
          `name.ilike.${like}`,
          `address_line1.ilike.${like}`,
          `city.ilike.${like}`,
          `state.ilike.${like}`,
        ].join(','),
      );
    }

    const { data, error, count } = await query
      .order('name', { ascending: sortDir === 'asc' })
      .range(from, to)
      .returns<PropertyListRow[]>();

    if (error) {
      console.error('Error fetching properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }

    const properties = Array.isArray(data) ? data : [];
    const propertyIds = properties.map((p) => p.id).filter(Boolean);
    const propertyManagerStaffMap = new Map<string, number>();

    // Resolve Property Manager assignments via property_staff (one per property)
    if (propertyIds.length) {
      try {
        const { data: assignments, error: assignmentsError } = await db
          .from('property_staff')
          .select('property_id, staff_id, role')
          .in('property_id', propertyIds)
          .eq('role', 'Property Manager');

        if (assignmentsError) {
          logger.warn({ error: assignmentsError }, 'Failed to load property manager assignments');
        }

        for (const row of assignments || []) {
          const propertyId = (row as { property_id?: string | null })?.property_id;
          const staffId = (row as { staff_id?: number | null })?.staff_id;
          if (!propertyId || !staffId) continue;
          if (!propertyManagerStaffMap.has(propertyId)) {
            propertyManagerStaffMap.set(propertyId, staffId);
          }
        }
      } catch (err) {
        console.warn('Failed to load property manager assignments', err);
      }
    }

    const managerIds = Array.from(new Set(propertyManagerStaffMap.values()));

    const managerMap = new Map<
      string,
      { name: string; email?: string | null; phone?: string | null; role?: string | null }
    >();
    if (managerIds.length) {
      try {
        const { data: managers, error: managersError } = await db
          .from('staff')
          .select('id, first_name, last_name, email, phone, role')
          .in('id', managerIds);
        if (managersError) {
          logger.warn({ error: managersError }, 'Failed to load property managers');
        }
        for (const mgr of managers || []) {
          const normalized = normalizeStaffRole(mgr?.role);
          if (normalized === 'Property Manager') {
            const name =
              [mgr?.first_name, mgr?.last_name].filter(Boolean).join(' ').trim() ||
              'Property Manager';
            managerMap.set(String(mgr.id), {
              name,
              email: mgr?.email ?? null,
              phone: mgr?.phone ?? null,
              role: mgr?.role ?? null,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load property managers for list', err);
      }
    }

    const ownersByProperty = new Map<string, { primaryOwnerName?: string; ownersCount: number }>();
    if (propertyIds.length) {
      try {
        const { data: ownersRows, error: ownersError } = await db
          .from('property_ownerships_cache')
          .select('property_id, display_name, primary')
          .in('property_id', propertyIds);
        if (ownersError) {
          logger.warn({ error: ownersError }, 'Failed to load owners for properties list');
        }
        for (const row of ownersRows || []) {
          const propertyId = (row as { property_id?: string | null })?.property_id;
          if (!propertyId) continue;
          const current = ownersByProperty.get(propertyId) ?? {
            ownersCount: 0,
            primaryOwnerName: undefined,
          };
          current.ownersCount += 1;
          const isPrimary = Boolean((row as { primary?: boolean | null }).primary);
          const displayName = (row as { display_name?: string | null }).display_name;
          if (isPrimary && displayName) current.primaryOwnerName = displayName;
          ownersByProperty.set(propertyId, current);
        }
        // If no explicit primary found, fall back to first display_name we saw
        for (const row of ownersRows || []) {
          const propertyId = (row as { property_id?: string | null })?.property_id;
          const displayName = (row as { display_name?: string | null }).display_name;
          if (!propertyId || !displayName) continue;
          const entry = ownersByProperty.get(propertyId);
          if (entry && !entry.primaryOwnerName) entry.primaryOwnerName = displayName;
        }
      } catch (err) {
        console.warn('Failed to load owner cache for properties list', err);
      }
    }

    const mapped = properties.map((p) => {
      const ownersMeta = ownersByProperty.get(p.id) ?? { ownersCount: 0, primaryOwnerName: null };
      let primaryOwnerName = ownersMeta.primaryOwnerName;
      if (!primaryOwnerName && typeof p?.primary_owner === 'string') {
        const trimmed = p.primary_owner.trim();
        if (trimmed.length > 0) primaryOwnerName = trimmed;
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
        ownersCount: ownersMeta.ownersCount,
        primaryOwnerName,
        propertyManagerName: (() => {
          const staffId = propertyManagerStaffMap.get(p.id);
          return staffId ? managerMap.get(String(staffId))?.name ?? null : null;
        })(),
        // Preserve legacy response key names; values now reference gl_accounts(id)
        operatingBankAccountId: p.operating_bank_gl_account_id ?? null,
        depositTrustAccountId: p.deposit_trust_gl_account_id ?? null,
      };
    });

    return NextResponse.json({
      data: mapped,
      page,
      pageSize,
      total: count ?? mapped.length,
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
