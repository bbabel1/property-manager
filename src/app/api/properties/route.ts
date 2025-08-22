import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      rentalSubType,
      name,
      addressLine1,
      city,
      state,
      postalCode,
      country,
      yearBuilt,
      structureDescription,
      owners,
      operatingBankAccountId,
      reserve,
      propertyManagerId
    } = body

    // Validate required fields
    if (!rentalSubType || !name || !addressLine1 || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create property data object matching database schema (snake_case)
    const propertyData = {
      name,
      structure_description: structureDescription,
      address_line1: addressLine1,
      city,
      state,
      postal_code: postalCode,
      country,
      rental_sub_type: rentalSubType,
      operating_bank_account_id: operatingBankAccountId || null,
      reserve: reserve ? parseFloat(reserve.toString()) : null,
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
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

      const { error: ownershipError } = await supabaseAdmin
        .from('ownership')
        .insert(ownershipRecords)

      if (ownershipError) {
        console.error('Error creating ownership records:', ownershipError)
        // Note: In a production app, you might want to rollback the property creation here
        return NextResponse.json(
          { error: 'Failed to create ownership records' },
          { status: 500 }
        )
      }

      // Update the property's primary_owner field if there's a primary owner
      const primaryOwner = owners.find((o: any) => o.primary)
      if (primaryOwner) {
        const { error: updateError } = await supabaseAdmin
          .from('properties')
          .update({ primary_owner: primaryOwner.name })
          .eq('id', property.id)

        if (updateError) {
          console.error('Error updating primary owner:', updateError)
        }
      }
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
    // Fetch properties with related data using Supabase joins
    const { data: properties, error } = await supabaseAdmin
      .from('properties')
      .select(`
        *,
        ownership!property_id (
          *,
          owners!owner_id (*)
        ),
        bank_accounts!operating_bank_account_id (*),
        property_staff!property_id (
          *,
          staff!staff_id (*)
        )
      `)

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties' },
        { status: 500 }
      )
    }

    return NextResponse.json(properties)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
