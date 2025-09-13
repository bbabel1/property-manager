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
    // Optional location fields (partial updates)
    if (Object.prototype.hasOwnProperty.call(body, 'borough')) updatePatch.borough = typeof body.borough === 'string' ? body.borough : null
    if (Object.prototype.hasOwnProperty.call(body, 'neighborhood')) updatePatch.neighborhood = typeof body.neighborhood === 'string' ? body.neighborhood : null
    if (Object.prototype.hasOwnProperty.call(body, 'longitude')) updatePatch.longitude = body.longitude != null ? Number(body.longitude) : null
    if (Object.prototype.hasOwnProperty.call(body, 'latitude')) updatePatch.latitude = body.latitude != null ? Number(body.latitude) : null
    if (Object.prototype.hasOwnProperty.call(body, 'location_verified')) updatePatch.location_verified = !!body.location_verified
    else if (Object.prototype.hasOwnProperty.call(body, 'locationVerified')) updatePatch.location_verified = !!body.locationVerified

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

    // Handle ownership updates (non-destructive when empty)
    // Only replace ownerships when owners array is provided AND non-empty.
    // This prevents accidental wipes when a client sends an empty array due to UI hydration timing.
    if (body.owners && Array.isArray(body.owners) && body.owners.length > 0) {
      console.log('🔍 API: Processing ownership updates for property:', propertyId)
      console.log('🔍 API: Owners data:', body.owners)
      
      // Use admin client for ownership operations to bypass RLS
      const adminClient = supabaseAdmin || supabase
      // Ensure we have org_id for ownership inserts
      let orgId: string | null = null
      try {
        // 0) Prefer explicit org id from header if provided
        const hdrOrg = request.headers.get('x-org-id')
        if (hdrOrg) orgId = hdrOrg

        // 1) Try from the updated property row
        if (!orgId) orgId = (data as any)?.org_id ?? null

        // 2) Try reloading the property
        if (!orgId) {
          const { data: propRow } = await adminClient
            .from('properties')
            .select('org_id')
            .eq('id', propertyId)
            .maybeSingle()
          orgId = (propRow as any)?.org_id ?? null
        }

        // 3) Try user's org membership (first org)
        if (!orgId) {
          const { data: mem } = await adminClient
            .from('org_memberships')
            .select('org_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          orgId = (mem as any)?.org_id ?? null
        }

        // 4) Try deriving from first owner in payload
        if (!orgId) {
          const firstOwner = body.owners?.[0]
          if (firstOwner?.id) {
            const { data: own } = await adminClient
              .from('owners')
              .select('org_id')
              .eq('id', firstOwner.id)
              .maybeSingle()
            orgId = (own as any)?.org_id ?? null
          }
        }

        // 5) Single-tenant convenience: if exactly one org exists, use it
        if (!orgId) {
          const { data: orgs } = await adminClient
            .from('organizations')
            .select('id')
          if (Array.isArray(orgs) && orgs.length === 1) orgId = orgs[0].id
        }

        // If we resolved orgId and property has none, persist it for consistency
        if (orgId) {
          await adminClient
            .from('properties')
            .update({ org_id: orgId, updated_at: new Date().toISOString() })
            .eq('id', propertyId)
        }
      } catch {}

      if (!orgId) {
        console.error('🔍 API: Cannot upsert ownerships — missing org_id for property and user:', propertyId)
        return NextResponse.json({ error: 'Missing org context; cannot upsert ownerships' }, { status: 400 })
      }
      
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
      const insertErrors: any[] = []
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
            org_id: orgId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()

        if (insertError) {
          console.error('🔍 API: Error inserting ownership record:', insertError)
          insertErrors.push(insertError)
        } else {
          console.log('🔍 API: Successfully inserted ownership record:', ownershipData)
        }
      }
      if (insertErrors.length) {
        return NextResponse.json({ error: 'Failed to upsert one or more ownerships', details: insertErrors.map(e => e.message || String(e)) }, { status: 400 })
      }
    } else {
      console.log('🔍 API: Skipping ownership updates (no owners provided or empty)')
    }

    // Handle property manager assignment (optional)
    if (Object.prototype.hasOwnProperty.call(body, 'property_manager_id')) {
      const staffId = body.property_manager_id
      // Remove existing link for PROPERTY_MANAGER
      await adminClient.from('property_staff').delete().eq('property_id', propertyId).eq('role', 'PROPERTY_MANAGER')
      if (staffId) {
        await adminClient.from('property_staff').insert({
          property_id: propertyId,
          staff_id: typeof staffId === 'string' ? Number(staffId) : staffId,
          role: 'PROPERTY_MANAGER',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
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
