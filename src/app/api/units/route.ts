
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { buildiumSync } from '@/lib/buildium-sync';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { UnitCreateSchema, UnitQuerySchema, type UnitCreateInput, type UnitQueryInput } from '@/schemas/unit';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import type { Database } from '@/types/database';
import { resolveResourceOrg, requireOrgMember } from '@/lib/auth/org-guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type UnitStatus = Database['public']['Enums']['unit_status_enum'];
type UnitBedrooms = Database['public']['Enums']['bedroom_enum'];
type UnitBathrooms = Database['public']['Enums']['bathroom_enum'];
type CountryEnum = Database['public']['Enums']['countries'];
type UnitCursor = { createdAt: string; id: string };

const encodeCursor = (row: { created_at?: string | null; id?: string | null } | undefined) => {
  if (!row?.created_at || !row?.id) return null;
  return Buffer.from(`${row.created_at}::${row.id}`, 'utf8').toString('base64');
};

const decodeCursor = (cursor?: string | null): UnitCursor | null => {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [createdAt, id] = decoded.split('::');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();

    const body = await request.json();

    // Validate request body with schema
    const validatedData = sanitizeAndValidate<UnitCreateInput>(body, UnitCreateSchema);
    console.log('Units API: Validated data:', validatedData);

    const {
      propertyId,
      unitNumber,
      unitSize,
      marketRent,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      unitBedrooms,
      unitBathrooms,
      description,
    } = validatedData;

    const normalizedStatus = (validatedData.status ?? 'Vacant') as UnitStatus;
    const normalizedBedrooms = (unitBedrooms ?? null) as UnitBedrooms | null;
    const normalizedBathrooms = (unitBathrooms ?? null) as UnitBathrooms | null;
    const normalizedCountry = mapGoogleCountryToEnum(country) as CountryEnum;

    // Resolve org from property and enforce membership
    const propertyOrg = await resolveResourceOrg(db, 'property', propertyId);
    if (!propertyOrg.ok) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    await requireOrgMember({ client: db, userId: user.id, orgId: propertyOrg.orgId });

    // Create unit
    const nowIso = new Date().toISOString();

    const {
      data: propertyRow,
      error: propertyError,
    } = await db
      .from('properties')
      .select('id, org_id, buildium_property_id')
      .eq('id', propertyId)
      .eq('org_id', propertyOrg.orgId)
      .maybeSingle();

    if (propertyError) {
      console.error('Error loading property for unit creation:', propertyError);
      return NextResponse.json(
        { error: 'Failed to create unit', details: propertyError.message },
        { status: 500 },
      );
    }

    if (!propertyRow || !propertyRow.org_id) {
      return NextResponse.json(
        { error: 'Property not found or missing organization' },
        { status: 404 },
      );
    }

    const { data: unit, error } = await db
      .from('units')
      .insert({
        property_id: propertyId,
        org_id: propertyOrg.orgId,
        buildium_property_id: propertyRow.buildium_property_id ?? null,
        unit_number: unitNumber,
        unit_size: unitSize,
        market_rent: marketRent,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country: normalizedCountry,
        unit_bedrooms: normalizedBedrooms,
        unit_bathrooms: normalizedBathrooms,
        description,
        status: normalizedStatus,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating unit:', error);
      return NextResponse.json(
        { error: 'Failed to create unit', details: error.message },
        { status: 500 },
      );
    }

    // Attempt Buildium sync after DB write
    try {
      if (propertyRow.buildium_property_id) {
        await buildiumSync.syncUnitToBuildium({
          ...unit,
          buildium_property_id: propertyRow.buildium_property_id,
        });
      } else {
        console.warn('Skipping Buildium sync: property missing buildium_property_id');
      }
    } catch (e) {
      console.error('Non-fatal: failed syncing unit to Buildium', e);
    }

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
    }

    console.error('Error in units API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate<UnitQueryInput>(
      Object.fromEntries(searchParams),
      UnitQuerySchema,
    );
    console.log('Units API: Validated query parameters:', query);

    const pageSize = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const parsedCursor = decodeCursor(query.cursor);
    if (query.cursor && !parsedCursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    const {
      propertyId,
      status,
      unitNumber,
      search,
      minRent,
      maxRent,
      bedrooms,
      bathrooms,
    } = query;

    // Org-scoped query
    let builder = db
      .from('units')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (propertyId) {
      builder = builder.eq('property_id', propertyId);
    }
    if (status) {
      builder = builder.eq('status', status);
    }
    if (unitNumber) {
      builder = builder.ilike('unit_number', `%${unitNumber}%`);
    }
    if (search) {
      builder = builder.or(
        `unit_number.ilike.%${search}%,address_line1.ilike.%${search}%,address_line2.ilike.%${search}%`,
      );
    }
    if (minRent !== undefined) {
      builder = builder.gte('market_rent', minRent);
    }
    if (maxRent !== undefined) {
      builder = builder.lte('market_rent', maxRent);
    }
    if (bedrooms) {
      builder = builder.eq('unit_bedrooms', bedrooms);
    }
    if (bathrooms) {
      builder = builder.eq('unit_bathrooms', bathrooms);
    }

    if (parsedCursor) {
      const cursorFilter = [
        `created_at.lt.${encodeURIComponent(parsedCursor.createdAt)}`,
        `and(created_at.eq.${encodeURIComponent(parsedCursor.createdAt)},id.lt.${encodeURIComponent(parsedCursor.id)})`,
      ].join(',');
      builder = builder.or(cursorFilter).limit(pageSize + 1);
    } else {
      const rawOffset = query.offset ?? 0;
      const safeOffset = Math.max(0, Math.min(rawOffset, 1000)); // avoid deep offsets on large tables
      builder =
        safeOffset > 0
          ? builder.range(safeOffset, safeOffset + pageSize - 1)
          : builder.limit(pageSize + 1);
    }

    const { data: units, error } = await builder;

    if (error) {
      console.error('Error fetching units:', error);
      console.error('Query parameters:', { propertyId, limit: pageSize, offset: query.offset ?? 0 });
      return NextResponse.json(
        { error: 'Failed to fetch units', details: error.message },
        { status: 500 },
      );
    }

    const rows = units || [];
    const page = rows.slice(0, pageSize);
    const nextCursor = rows.length > pageSize ? encodeCursor(rows[page.length - 1]) : null;

    console.log(`Units API: Found ${page.length} units for propertyId: ${propertyId || 'all'}`);
    const response = NextResponse.json(page);
    if (nextCursor) response.headers.set('x-next-cursor', nextCursor);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
    }

    console.error('Error in units GET:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
