import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { validateCSRFToken } from '@/lib/csrf'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // Check authentication
    const user = await requireUser(request);
    
    // CSRF protection
    const isValidCSRF = await validateCSRFToken(request);
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const propertyId = resolvedParams.id
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['name', 'address_line1', 'city', 'state', 'postal_code', 'country', 'status']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Use admin client for property operations to bypass RLS
    const adminClient = supabaseAdmin || supabase

    // Update the property
    const updatePatch: any = {
      name: body.name,
      address_line1: body.address_line1,
      address_line2: body.address_line2 || null,
      address_line3: body.address_line3 || null,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country,
      property_type: body.property_type ?? null,
      status: body.status,
      reserve: body.reserve || 0,
      year_built: body.year_built || null,
      updated_at: new Date().toISOString()
    }
    // Optional management/service/fee fields (only update when provided)
    if (Object.prototype.hasOwnProperty.call(body, 'management_scope')) updatePatch.management_scope = body.management_scope || null
    if (Object.prototype.hasOwnProperty.call(body, 'service_assignment')) updatePatch.service_assignment = body.service_assignment || null
    if (Object.prototype.hasOwnProperty.call(body, 'service_plan')) updatePatch.service_plan = body.service_plan || null
    if (Object.prototype.hasOwnProperty.call(body, 'active_services')) updatePatch.active_services = Array.isArray(body.active_services) ? body.active_services : null
    else if (Object.prototype.hasOwnProperty.call(body, 'included_services')) updatePatch.active_services = Array.isArray(body.included_services) ? body.included_services : null
    if (Object.prototype.hasOwnProperty.call(body, 'fee_assignment')) updatePatch.fee_assignment = body.fee_assignment || null
    if (Object.prototype.hasOwnProperty.call(body, 'fee_type')) updatePatch.fee_type = body.fee_type || null
    if (Object.prototype.hasOwnProperty.call(body, 'fee_percentage')) updatePatch.fee_percentage = (body.fee_percentage ?? null) !== null ? Number(body.fee_percentage) : null
    if (Object.prototype.hasOwnProperty.call(body, 'management_fee')) updatePatch.management_fee = (body.management_fee ?? null) !== null ? Number(body.management_fee) : null
    if (Object.prototype.hasOwnProperty.call(body, 'billing_frequency')) updatePatch.billing_frequency = body.billing_frequency || null

    const { data, error } = await adminClient
      .from('properties')
      .update(updatePatch)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) {
      console.error('Error updating property:', error)
      return NextResponse.json({ error: 'Failed to update property' }, { status: 500 })
    }

    // Handle ownership updates
    if (body.owners && Array.isArray(body.owners)) {
      console.log('🔍 API: Processing ownership updates for property:', propertyId)
      console.log('🔍 API: Owners data:', body.owners)
      
      // Use admin client for ownership operations to bypass RLS
      const adminClient = supabaseAdmin || supabase
      
      // First, delete all existing ownership records for this property
      const { error: deleteError } = await adminClient
        .from('ownerships')
        .delete()
        .eq('property_id', propertyId)

      if (deleteError) {
        console.error('🔍 API: Error deleting existing ownership records:', deleteError)
      } else {
        console.log('🔍 API: Successfully deleted existing ownership records')
      }

      // Then insert new ownership records
      for (const owner of body.owners) {
        console.log('🔍 API: Inserting ownership record for owner:', owner.id)
        const { data: ownershipData, error: insertError } = await adminClient
          .from('ownerships')
          .insert({
            property_id: propertyId,
            owner_id: owner.id,
            ownership_percentage: owner.ownershipPercentage,
            disbursement_percentage: owner.disbursementPercentage,
            primary: owner.primary,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()

        if (insertError) {
          console.error('🔍 API: Error inserting ownership record:', insertError)
        } else {
          console.log('🔍 API: Successfully inserted ownership record:', ownershipData)
        }
      }
    } else {
      console.log('🔍 API: No owners data provided in request body')
    }

    // primary_owner field removed - ownership is now managed through ownerships table

    return NextResponse.json({ 
      success: true, 
      property: data 
    })

  } catch (error) {
    console.error('Error in PUT /api/properties/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
