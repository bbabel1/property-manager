import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'

// GET /api/properties/:id/sync-status
// Returns Buildium sync status rows for this property (entity_type='Rental') and its units
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(request)
    const { id } = await params
    const db = supabaseAdmin || supabase

    // Fetch property status
    const { data: propStatus } = await db
      .from('buildium_sync_status')
      .select('*')
      .eq('entity_type', 'Rental')
      .eq('entity_id', id)
      .order('updated_at', { ascending: false })

    // Fetch unit ids for this property
    const { data: units } = await db
      .from('units')
      .select('id')
      .eq('property_id', id)

    const unitIds = (units || []).map(u => u.id)
    let unitStatuses: any[] = []
    if (unitIds.length) {
      const { data } = await db
        .from('buildium_sync_status')
        .select('*')
        .eq('entity_type', 'Rental')
        .in('entity_id', unitIds)
        .order('updated_at', { ascending: false })
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
