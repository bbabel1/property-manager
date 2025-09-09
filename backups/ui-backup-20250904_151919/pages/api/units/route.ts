import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { buildiumSync } from '@/lib/buildium-sync'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { UnitCreateSchema, UnitQuerySchema } from '@/schemas/unit'
import { mapGoogleCountryToEnum } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)

    const body = await request.json()
    
    // Validate request body with schema
    const validatedData = sanitizeAndValidate(body, UnitCreateSchema);
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
      description
    } = validatedData

    // Create unit
    const normalizedCountry = mapGoogleCountryToEnum(country)
    const { data: unit, error } = await supabase
      .from('units')
      .insert({
        property_id: propertyId,
        unit_number: unitNumber,
        unit_size: unitSize,
        market_rent: marketRent,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country: normalizedCountry,
        unit_bedrooms: unitBedrooms,
        unit_bathrooms: unitBathrooms,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating unit:', error)
      return NextResponse.json(
        { error: 'Failed to create unit', details: error.message },
        { status: 500 }
      )
    }

    // Attempt Buildium sync after DB write
    try {
      // Resolve buildium_property_id for this local unit
      const { data: prop } = await supabase
        .from('properties')
        .select('buildium_property_id')
        .eq('id', unit.property_id)
        .single()
      if (prop?.buildium_property_id) {
        await buildiumSync.syncUnitToBuildium({ ...unit, buildium_property_id: prop.buildium_property_id })
      } else {
        console.warn('Skipping Buildium sync: property missing buildium_property_id')
      }
    } catch (e) {
      console.error('Non-fatal: failed syncing unit to Buildium', e)
    }

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in units API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), UnitQuerySchema);
    console.log('Units API: Validated query parameters:', query);

    const { data: units, error } = await supabase
      .from('units')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching units:', error)
      return NextResponse.json(
        { error: 'Failed to fetch units' },
        { status: 500 }
      )
    }

    return NextResponse.json(units || [])
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in units GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    )
  }
}
