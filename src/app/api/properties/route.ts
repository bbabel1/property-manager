import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

    // Create property with transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the property
      const property = await tx.property.create({
        data: {
          name,
          structureDescription,
          addressLine1,
          city,
          state,
          postalCode,
          country: country as any, // Cast to Country enum
          rentalSubType: rentalSubType as any, // Cast to RentalSubType enum
          operatingBankAccountId: operatingBankAccountId || null,
          reserve: reserve ? parseFloat(reserve.toString()) : null,
          yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
          // Initialize with empty arrays for related data
          rentalOwnerIds: [],
        }
      })

      // Create ownership records if owners are provided
      if (owners && owners.length > 0) {
        const ownershipRecords = owners.map((owner: any) => ({
          ownerId: owner.id,
          propertyId: property.id,
          ownershipPercentage: owner.ownershipPercentage ? parseFloat(owner.ownershipPercentage.toString()) : null,
          disbursementPercentage: owner.disbursementPercentage ? parseFloat(owner.disbursementPercentage.toString()) : null,
          ownerName: owner.name,
          primary: owner.primary || false
        }))

        // Use the correct model name - it should be lowercase in Prisma client
        await tx.ownership.createMany({
          data: ownershipRecords
        })

        // Update the property's primary_owner field (this will be handled by the trigger)
        // But we can also set it manually for immediate access
        const primaryOwner = owners.find((o: any) => o.primary)
        if (primaryOwner) {
          await tx.property.update({
            where: { id: property.id },
            data: { primaryOwner: primaryOwner.name }
          })
        }
      }

      // Create property staff record if property manager is assigned
      if (propertyManagerId) {
        await tx.propertyStaff.create({
          data: {
            propertyId: property.id,
            staffId: propertyManagerId,
            role: 'PROPERTY_MANAGER'
          }
        })
      }

      return property
    })

    return NextResponse.json(
      { 
        message: 'Property created successfully',
        property: result
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
    const properties = await prisma.property.findMany({
      include: {
        ownership: {
          include: {
            owner: true
          }
        },
        operatingBankAccount: true,
        propertyStaff: {
          include: {
            staff: true
          }
        }
      }
    })

    return NextResponse.json(properties)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
