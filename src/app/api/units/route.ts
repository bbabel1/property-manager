
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/db';
import { buildiumSync } from '@/lib/buildium-sync';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { UnitCreateSchema, UnitQuerySchema, type UnitCreateInput, type UnitQueryInput } from '@/schemas/unit';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import type { Database } from '@/types/database';

type UnitStatus = Database['public']['Enums']['unit_status_enum'];
type UnitBedrooms = Database['public']['Enums']['bedroom_enum'];
type UnitBathrooms = Database['public']['Enums']['bathroom_enum'];
type CountryEnum = Database['public']['Enums']['countries'];

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);

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

    // Create unit
    // Use admin client if available for writes to bypass RLS
    const db = supabaseAdmin || supabase;
    const nowIso = new Date().toISOString();

    const {
      data: propertyRow,
      error: propertyError,
    } = await db
      .from('properties')
      .select('id, org_id, buildium_property_id')
      .eq('id', propertyId)
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
        org_id: propertyRow.org_id,
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
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Error in units API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate<UnitQueryInput>(
      Object.fromEntries(searchParams),
      UnitQuerySchema,
    );
    console.log('Units API: Validated query parameters:', query);

    const {
      limit,
      offset,
      propertyId,
      status,
      unitNumber,
      search,
      minRent,
      maxRent,
      bedrooms,
      bathrooms,
    } = query;

    // Use admin client if available (bypasses RLS), fallback to regular client
    // This matches the pattern used in properties API
    const db = supabaseAdmin || supabase;
    let builder = db.from('units').select('*').order('created_at', { ascending: false });

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

    if (typeof offset === 'number' && typeof limit === 'number') {
      builder = builder.range(offset, offset + limit - 1);
    }

    const { data: units, error } = await builder;

    if (error) {
      console.error('Error fetching units:', error);
      console.error('Query parameters:', { propertyId, limit, offset });
      return NextResponse.json(
        { error: 'Failed to fetch units', details: error.message },
        { status: 500 },
      );
    }

    console.log(
      `Units API: Found ${units?.length || 0} units for propertyId: ${propertyId || 'all'}`,
    );
    return NextResponse.json(units || []);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.error('Error in units GET:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
