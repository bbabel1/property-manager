import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'

// POST /api/work-orders/sync/from-buildium
// Body: { propertyId?, unitId?, status?, categoryId?, limit?, offset? }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()

    const body = await request.json().catch(() => ({}))
    const params = {
      propertyId: typeof body.propertyId === 'number' ? body.propertyId : undefined,
      unitId: typeof body.unitId === 'number' ? body.unitId : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      categoryId: typeof body.categoryId === 'number' ? body.categoryId : undefined,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      offset: typeof body.offset === 'number' ? body.offset : undefined,
      persist: true as const
    }

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'syncFromBuildium', entityData: params }
    })
    if (error || !data?.success) {
      logger.error('Edge sync from Buildium failed')
      return NextResponse.json({ error: data?.error || 'Sync failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, synced: data.synced || 0, updated: data.updated || 0 })
  } catch (error) {
    logger.error('Error syncing work orders from Buildium', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
