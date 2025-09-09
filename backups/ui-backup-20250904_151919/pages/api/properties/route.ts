import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { mapGoogleCountryToEnum } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      rentalSubType,
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
      operatingBankAccountId,
      depositTrustAccountId,
      reserve,
      propertyManagerId,
      status
    } = body

    // Validate required fields
    if (!rentalSubType || !name || !addressLine1 || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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
      rental_sub_type: rentalSubType,
      operating_bank_account_id: operatingBankAccountId || null,
      deposit_trust_account_id: depositTrustAccountId || null,
      reserve: reserve ? parseFloat(reserve.toString()) : null,
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
      status: status || 'Active',
      rental_owner_ids: [],
    }

    // Create the property
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .insert(propertyData)
      .select()
      .single()

    if (propertyError) {
      console.error('Error creating property:', propertyError)
      return NextResponse.json(
        { error: 'Failed to create property' },
        { status: 500 }
      )
    }

    // Create ownership records if owners are provided
    if (owners && owners.length > 0) {
      const ownershipRecords = owners.map((owner: any) => ({
        owner_id: owner.id,
        property_id: property.id,
        ownership_percentage: owner.ownershipPercentage ? parseFloat(owner.ownershipPercentage.toString()) : null,
        disbursement_percentage: owner.disbursementPercentage ? parseFloat(owner.disbursementPercentage.toString()) : null,
        owner_name: owner.name,
        primary: owner.primary || false
      }))

      // Use correct table name 'ownerships'
      const { error: ownershipError } = await supabaseAdmin
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

    // Create property staff record if property manager is assigned
    if (propertyManagerId) {
      const { error: staffError } = await supabaseAdmin
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
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Fetch only fields needed for the properties list and map to camelCase
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('id, name, address_line1, rental_sub_type, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties' },
        { status: 500 }
      )
    }

    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      addressLine1: p.address_line1,
      rentalSubType: p.rental_sub_type,
      status: p.status,
      createdAt: p.created_at,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
