import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { supabase, supabaseAdmin } from '@/lib/db';
import {
  mapCountryToBuildium,
  mapPropertyToBuildium,
  mapOwnerToBuildium,
} from '@/lib/buildium-mappers';
import { buildiumFetch } from '@/lib/buildium-http';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import type { BuildiumUnit, BuildiumLease } from '@/types/buildium';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const db = supabaseAdmin || supabase;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);

    // Load local property (with minimal fields needed to construct Buildium payload)
    const { data: property, error: propErr } = await db
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    if (propErr || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Resolve Operating Bank Account ID for Buildium
    // In Buildium, the GL Account ID for a bank account IS the bank account ID
    let buildiumOperatingBankAccountId: number | undefined;
    const operatingGlId: string | null = (property as any).operating_bank_gl_account_id ?? null;

    if (operatingGlId) {
      const { data: gl } = await db
        .from('gl_accounts')
        .select('id, buildium_gl_account_id, is_bank_account')
        .eq('id', operatingGlId)
        .maybeSingle();

      if (gl) {
        const glBuildiumId = (gl as any).buildium_gl_account_id;
        if (typeof glBuildiumId === 'number' && glBuildiumId > 0) {
          // Use the GL account ID directly as the bank account ID
          buildiumOperatingBankAccountId = glBuildiumId;
        } else {
          return NextResponse.json(
            { error: 'Operating bank account GL is missing a Buildium GL account id' },
            { status: 422 },
          );
        }
      }
    }

    // Ensure Owners exist in Buildium, collect IDs
    const prelinkedOwnerIds: number[] = [];
    const ownersPendingCreation: { ownerPayload: any; ownerId: string }[] = [];
    try {
      const { data: ownerships } = await db
        .from('ownerships')
        .select('owner_id')
        .eq('property_id', id);
      const ownerIds = (ownerships || []).map((o: any) => String(o.owner_id));
      if (ownerIds.length) {
        const { data: owners } = await db
          .from('owners')
          .select('*, contacts!inner(*)')
          .in('id', ownerIds);
        for (const rawOwner of owners || []) {
          const contactSource = Array.isArray((rawOwner as any).contacts)
            ? (rawOwner as any).contacts[0]
            : (rawOwner as any).contacts;
          const contact = contactSource || {};

          const fallbackAddressLine1 =
            (rawOwner as any)?.tax_address_line1 || property.address_line1 || 'Address';
          const normalizedAddressLine1 = (
            contact?.primary_address_line_1 ||
            fallbackAddressLine1 ||
            ''
          ).trim();
          const resolvedAddressLine1 =
            normalizedAddressLine1 && normalizedAddressLine1.toLowerCase() !== 'n/a'
              ? normalizedAddressLine1
              : fallbackAddressLine1;

          const resolvedCity =
            contact?.primary_city || (rawOwner as any)?.tax_city || property.city || 'New York';
          const resolvedState =
            contact?.primary_state || (rawOwner as any)?.tax_state || property.state || 'NY';
          const resolvedPostal =
            contact?.primary_postal_code ||
            (rawOwner as any)?.tax_postal_code ||
            property.postal_code ||
            '10000';
          const resolvedCountry =
            mapCountryToBuildium(
              contact?.primary_country ||
                (rawOwner as any)?.tax_country ||
                property.country ||
                'United States',
            ) || 'UnitedStates';

          const ownerForBuildium = {
            ...rawOwner,
            FirstName: contact?.first_name || (rawOwner as any)?.tax_payer_name1 || 'Owner',
            LastName: contact?.last_name || (rawOwner as any)?.tax_payer_name2 || 'Primary',
            Email: contact?.primary_email || undefined,
            PhoneNumber: contact?.primary_phone || undefined,
            Address: {
              AddressLine1: resolvedAddressLine1,
              AddressLine2:
                contact?.primary_address_line_2 ||
                (rawOwner as any)?.tax_address_line2 ||
                undefined,
              AddressLine3:
                contact?.primary_address_line_3 ||
                (rawOwner as any)?.tax_address_line3 ||
                undefined,
              City: resolvedCity,
              State: resolvedState,
              PostalCode: resolvedPostal,
              Country: resolvedCountry,
            },
            TaxId: (rawOwner as any)?.tax_payer_id || undefined,
            IsActive: (rawOwner as any)?.is_active !== false,
          };

          const ow = rawOwner as any;
          if (ow.buildium_owner_id) {
            prelinkedOwnerIds.push(Number(ow.buildium_owner_id));
            continue;
          }

          if (property.buildium_property_id) {
            const creationResult = await createOwnerDirectly(
              mapOwnerToBuildium(ownerForBuildium as any),
              Number(property.buildium_property_id),
              ow.id,
              orgId,
            );
            if (!creationResult.success) {
              return NextResponse.json(
                {
                  error: 'Failed to create owner in Buildium',
                  details: creationResult.error,
                  ownerId: ow.id,
                },
                { status: 422 },
              );
            }
            prelinkedOwnerIds.push(creationResult.buildiumId!);
            continue;
          }

          ownersPendingCreation.push({ ownerPayload: ownerForBuildium, ownerId: ow.id });
        }
      }
    } catch (e) {
      // Non-fatal, but property create may fail later
    }

    // Build property payload
    const payload = mapPropertyToBuildium({
      name: property.name,
      structure_description: property.structure_description || undefined,
      is_active: property.status !== 'Inactive',
      buildium_operating_bank_account_id: buildiumOperatingBankAccountId,
      reserve: property.reserve || undefined,
      address_line1: property.address_line1,
      address_line2: property.address_line2 || undefined,
      city: property.city,
      state: property.state,
      postal_code: property.postal_code,
      country: property.country,
      year_built: property.year_built || undefined,
      rental_type: 'Rental',
      property_type: property.property_type,
    } as any);
    if (prelinkedOwnerIds.length) (payload as any).RentalOwnerIds = prelinkedOwnerIds;

    // Create or update in Buildium
    const hadExistingBuildiumId = Boolean(property.buildium_property_id);
    let buildiumId = property.buildium_property_id ? Number(property.buildium_property_id) : null;
    if (buildiumId) {
      const res = await buildiumFetch('PUT', `/rentals/${buildiumId}`, undefined, payload, orgId);
      if (!res.ok) {
        return NextResponse.json(
          {
            error: 'Failed to update property in Buildium',
            status: res.status,
            details: res.errorText || res.json,
          },
          { status: 422 },
        );
      }
    } else {
      const res = await buildiumFetch('POST', `/rentals`, undefined, payload, orgId);
      const resJson = res.json as any;
      if (!res.ok || !resJson?.Id) {
        return NextResponse.json(
          {
            error: 'Failed to create property in Buildium',
            status: res.status,
            details: res.errorText || res.json,
          },
          { status: 422 },
        );
      }
      buildiumId = Number(resJson.Id);
      await db
        .from('properties')
        .update({ buildium_property_id: buildiumId, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    // Track how many owners were pre-linked before creating new ones
    const prelinkedCountBeforeCreation = prelinkedOwnerIds.length;

    if (buildiumId && ownersPendingCreation.length) {
      for (const item of ownersPendingCreation) {
        const basePayload = mapOwnerToBuildium(item.ownerPayload as any);
        basePayload.PropertyIds = Array.from(
          new Set([...(basePayload.PropertyIds || []), buildiumId]),
        );
        const creationResult = await createOwnerDirectly(
          basePayload,
          buildiumId,
          item.ownerId,
          orgId,
        );
        if (!creationResult.success) {
          return NextResponse.json(
            {
              error: 'Failed to create owner in Buildium',
              details: creationResult.error,
              ownerId: item.ownerId,
            },
            { status: 422 },
          );
        }
        prelinkedOwnerIds.push(creationResult.buildiumId!);
      }
    }

    // Only do an owner assignment PUT if:
    // 1. New owners were created after the property POST (need to link them)
    // 2. This is an existing property being updated (pre-linked owners may have changed)
    const hasNewOwnersToLink = prelinkedOwnerIds.length > prelinkedCountBeforeCreation;
    if (buildiumId && hasNewOwnersToLink && hadExistingBuildiumId) {
      const ownerUpdatePayload: Record<string, unknown> = {
        ...(payload as unknown as Record<string, unknown>),
        RentalOwnerIds: Array.from(new Set(prelinkedOwnerIds)),
      };

      const ownerUpdateRes = await buildiumFetch(
        'PUT',
        `/rentals/${buildiumId}`,
        undefined,
        ownerUpdatePayload,
        orgId,
      );
      if (!ownerUpdateRes.ok) {
        return NextResponse.json(
          {
            error: 'Failed to assign owners to property in Buildium',
            status: ownerUpdateRes.status,
            details: ownerUpdateRes.errorText || ownerUpdateRes.json,
          },
          { status: 422 },
        );
      }
    }

    if (buildiumId) {
      try {
        const buildiumUnitsRes = await buildiumFetch(
          'GET',
          `/rentals/units`,
          {
            propertyids: buildiumId,
          },
          undefined,
          orgId,
        );
        const buildiumUnits: BuildiumUnit[] = Array.isArray(buildiumUnitsRes.json)
          ? (buildiumUnitsRes.json as BuildiumUnit[])
          : [];
        if (buildiumUnits.length) {
          const { data: localUnits, error: localUnitsError } = await db
            .from('units')
            .select('id, unit_number, buildium_unit_id, buildium_property_id')
            .eq('property_id', id);

          if (!localUnitsError && Array.isArray(localUnits) && localUnits.length) {
            const normalize = (value: string | null | undefined) =>
              String(value || '')
                .trim()
                .toLowerCase();
            const byNumber = new Map<string, BuildiumUnit[]>();
            for (const bu of buildiumUnits) {
              const key = normalize((bu as any)?.UnitNumber);
              if (!key) continue;
              const list = byNumber.get(key);
              if (list) list.push(bu);
              else byNumber.set(key, [bu]);
            }

            for (const unitRow of localUnits) {
              if (unitRow?.buildium_unit_id) continue;
              const key = normalize((unitRow as any)?.unit_number);
              if (!key) continue;
              const matches = byNumber.get(key);
              if (matches && matches.length === 1) {
                const match = matches[0];
                await db
                  .from('units')
                  .update({
                    buildium_unit_id: match.Id,
                    buildium_property_id: buildiumId,
                    buildium_created_at: (match as any)?.CreatedDate || new Date().toISOString(),
                    buildium_updated_at: (match as any)?.ModifiedDate || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', unitRow.id);
                logger.info(
                  { propertyId: id, unitId: unitRow.id, buildiumUnitId: match.Id },
                  'Linked Buildium unit to local unit after property sync',
                );
                byNumber.set(key, []);
              }
            }
          }
        }
      } catch (unitLinkError) {
        logger.warn(
          {
            error: unitLinkError instanceof Error ? unitLinkError.message : unitLinkError,
            propertyId: id,
          },
          'Failed linking Buildium units to local units after property sync',
        );
      }
    }

    if (buildiumId && hadExistingBuildiumId) {
      try {
        const leaseRes = await buildiumFetch(
          'GET',
          `/leases`,
          {
            propertyId: buildiumId,
            pageSize: 200,
          },
          undefined,
          orgId,
        );
        const buildiumLeases: BuildiumLease[] = Array.isArray(leaseRes.json)
          ? (leaseRes.json as BuildiumLease[])
          : Array.isArray((leaseRes.json as any)?.Data)
            ? (leaseRes.json as { Data: BuildiumLease[] }).Data
            : [];

        if (buildiumLeases.length) {
          const { data: localLeases, error: localLeaseError } = await db
            .from('lease')
            .select(
              'id, property_id, unit_id, lease_from_date, rent_amount, buildium_lease_id, buildium_property_id, buildium_unit_id, lease_to_date',
            )
            .eq('property_id', id);

          if (!localLeaseError && Array.isArray(localLeases) && localLeases.length) {
            const unitIds = Array.from(new Set(localLeases.map((l) => l.unit_id).filter(Boolean)));
            const unitMeta = new Map<
              string,
              { buildium_unit_id: number | null; unit_number: string | null }
            >();
            if (unitIds.length) {
              const { data: unitRows } = await db
                .from('units')
                .select('id, buildium_unit_id, unit_number')
                .in('id', unitIds as any);
              for (const row of unitRows || []) {
                unitMeta.set(String(row.id), {
                  buildium_unit_id: row.buildium_unit_id ?? null,
                  unit_number: row.unit_number ?? null,
                });
              }
            }

            const normalizeDate = (value: any) => {
              if (!value) return null;
              try {
                return new Date(value).toISOString().split('T')[0];
              } catch {
                return null;
              }
            };

            const map = new Map<string, BuildiumLease[]>();
            const push = (key: string | null, lease: BuildiumLease) => {
              if (!key) return;
              const arr = map.get(key);
              if (arr) arr.push(lease);
              else map.set(key, [lease]);
            };

            for (const lease of buildiumLeases) {
              const start = normalizeDate(lease.LeaseFromDate);
              if (!start) continue;
              const unitIdKey = lease.UnitId ? `unit:${lease.UnitId}|${start}` : null;
              const unitNumberKey = lease.UnitNumber
                ? `number:${String(lease.UnitNumber).trim().toLowerCase()}|${start}`
                : null;
              push(unitIdKey, lease);
              push(unitNumberKey, lease);
            }

            for (const localLease of localLeases) {
              if (localLease.buildium_lease_id) continue;
              const start = normalizeDate(localLease.lease_from_date);
              if (!start) continue;
              const unitInfo = unitMeta.get(String(localLease.unit_id));
              const localBuildiumUnitId =
                localLease.buildium_unit_id || unitInfo?.buildium_unit_id || null;
              const unitNumberNorm = unitInfo?.unit_number
                ? String(unitInfo.unit_number).trim().toLowerCase()
                : null;

              const keys: string[] = [];
              if (localBuildiumUnitId) keys.push(`unit:${localBuildiumUnitId}|${start}`);
              if (unitNumberNorm) keys.push(`number:${unitNumberNorm}|${start}`);

              let match: BuildiumLease | null = null;
              for (const key of keys) {
                const candidates = map.get(key);
                if (!candidates || candidates.length === 0) continue;
                if (candidates.length === 1) {
                  match = candidates[0];
                  break;
                }
                if (localLease.rent_amount != null) {
                  const rentMatch = candidates.find((item) => {
                    const rent = item?.AccountDetails?.Rent;
                    return (
                      rent != null &&
                      Math.round(rent) === Math.round(Number(localLease.rent_amount))
                    );
                  });
                  if (rentMatch) {
                    match = rentMatch;
                    break;
                  }
                }
              }

              if (match) {
                const removeMatch = (leaseMatch: BuildiumLease) => {
                  for (const key of keys) {
                    if (!key) continue;
                    const arr = map.get(key);
                    if (!arr) continue;
                    map.set(
                      key,
                      arr.filter((item) => item !== leaseMatch),
                    );
                  }
                };
                removeMatch(match);

                await db
                  .from('lease')
                  .update({
                    buildium_lease_id: match.Id,
                    buildium_property_id:
                      match.PropertyId ?? localLease.buildium_property_id ?? buildiumId,
                    buildium_unit_id: match.UnitId ?? localBuildiumUnitId,
                    buildium_created_at: match.CreatedDateTime ?? new Date().toISOString(),
                    buildium_updated_at: match.LastUpdatedDateTime ?? new Date().toISOString(),
                  })
                  .eq('id', localLease.id);

                logger.info(
                  { propertyId: id, leaseId: localLease.id, buildiumLeaseId: match.Id },
                  'Linked Buildium lease to local lease after property sync',
                );
              }
            }
          }
        }
      } catch (leaseLinkError) {
        logger.warn(
          {
            error: leaseLinkError instanceof Error ? leaseLinkError.message : leaseLinkError,
            propertyId: id,
          },
          'Failed linking Buildium leases to local leases after property sync',
        );
      }
    }

    return NextResponse.json({ success: true, buildium_property_id: buildiumId });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    logger.error({ error }, 'Error syncing property to Buildium');
    return NextResponse.json({ error: 'Failed to sync property to Buildium' }, { status: 500 });
  }
}

async function createOwnerDirectly(
  ownerPayload: any,
  buildiumPropertyId: number,
  ownerId: string,
  orgId: string,
): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
  try {
    const payload = {
      ...ownerPayload,
      PropertyIds: Array.from(new Set([...(ownerPayload?.PropertyIds || []), buildiumPropertyId])),
    };
    const createRes = await buildiumFetch('POST', `/rentals/owners`, undefined, payload, orgId);
    const createJson = createRes.json as any;
    if (!createRes.ok || !createJson?.Id) {
      return {
        success: false,
        error: JSON.stringify(createRes.json ?? createRes.errorText ?? 'Unknown error'),
      };
    }
    const newId = Number(createJson.Id);
    const db = supabaseAdmin || supabase;
    await db
      .from('owners')
      .update({ buildium_owner_id: newId, buildium_updated_at: new Date().toISOString() })
      .eq('id', ownerId);
    return { success: true, buildiumId: newId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
