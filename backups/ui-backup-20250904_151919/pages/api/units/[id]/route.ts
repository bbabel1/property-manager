import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { buildiumSync } from '@/lib/buildium-sync'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser(request)
    const body = await request.json().catch(() => ({}))

    const { data: existing, error: findErr } = await supabase
      .from('units')
      .select('*')
      .eq('id', params.id)
      .single()
    if (findErr || !existing) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    const updatedFields = { ...body, updated_at: new Date().toISOString() }
    const { data: unit, error } = await supabase
      .from('units')
      .update(updatedFields)
      .eq('id', params.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to update unit', details: error.message }, { status: 500 })

    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('buildium_property_id')
        .eq('id', unit.property_id)
        .single()
      if (prop?.buildium_property_id) {
        await buildiumSync.syncUnitToBuildium({ ...unit, buildium_property_id: prop.buildium_property_id })
      } else {
        console.warn('Skipping Buildium sync for update: property missing buildium_property_id')
      }
    } catch (syncErr) {
      console.error('Non-fatal: failed syncing unit update to Buildium', syncErr)
    }

    return NextResponse.json(unit)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error updating unit', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

