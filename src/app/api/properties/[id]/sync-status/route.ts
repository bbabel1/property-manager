import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { requireOrgMember, resolveResourceOrg } from '@/lib/auth/org-guards'

// GET /api/properties/:id/sync-status
// Returns Buildium sync status rows for this property (entity_type='Rental') and its units
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth()
    const { id } = await params
    const resolved = await resolveResourceOrg(supabase, 'property', id)
    if (!resolved.ok) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId: resolved.orgId })
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : ''
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }
    const orgId = resolved.orgId

    // Fetch property status
    const { data: propStatus, error: propError } = await supabase
      .from('buildium_sync_status')
      .select('*')
      .eq('entity_type', 'Rental')
      .eq('entity_id', id)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
    if (propError) {
      return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 })
    }

    // Fetch unit ids for this property
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', id)
      .eq('org_id', orgId)
    if (unitsError) {
      return NextResponse.json({ error: 'Failed to fetch unit sync status' }, { status: 500 })
    }

    const unitIds = (units || []).map(u => u.id)
    let unitStatuses: any[] = []
    if (unitIds.length) {
      const { data, error } = await supabase
        .from('buildium_sync_status')
        .select('*')
        .eq('entity_type', 'Rental')
        .in('entity_id', unitIds)
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false })
      if (error) {
        return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 })
      }
      unitStatuses = data || []
    }

    return NextResponse.json({
      property: propStatus || [],
      units: unitStatuses
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 })
  }
}
