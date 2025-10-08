import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumFetch } from '@/lib/buildium-http'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    const { id: unitId, imageId } = await params
    const db = supabaseAdmin || supabase

    const { data: unitRow, error: unitError } = await db
      .from('units')
      .select('id, buildium_unit_id')
      .eq('id', unitId)
      .maybeSingle()

    if (unitError || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const { data: imageRow, error: imageError } = await db
      .from('unit_images')
      .select('*')
      .eq('id', imageId)
      .eq('unit_id', unitId)
      .maybeSingle()

    if (imageError || !imageRow) {
      return NextResponse.json({ error: 'Unit image not found' }, { status: 404 })
    }

    if (imageRow.buildium_image_id && unitRow.buildium_unit_id) {
      const res = await buildiumFetch('DELETE', `/rentals/units/${unitRow.buildium_unit_id}/images/${imageRow.buildium_image_id}`)
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to delete unit image from Buildium', details: res.errorText || res.json }, { status: res.status || 502 })
      }
    }

    const { error: deleteError } = await db
      .from('unit_images')
      .delete()
      .eq('id', imageId)
      .eq('unit_id', unitId)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete unit image' }, { status: 500 })
    }

    logger.info({ userId: user.id, unitId, imageId }, 'Unit image deleted successfully')

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'Error deleting unit image')
    return NextResponse.json({ error: 'Failed to delete unit image' }, { status: 500 })
  }
}
