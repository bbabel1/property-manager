import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'

// POST /api/work-orders/sync/to-buildium
// Body: { localId: string }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()

    const body = await request.json().catch(() => ({}))
    const localId = body?.localId as string
    if (!localId) {
      return NextResponse.json({ error: 'localId is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'syncLocalById', entityData: { localId } }
    })
    if (error || !data?.success) {
      return NextResponse.json({ error: data?.error || 'Sync failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, buildiumId: data?.data?.Id })
  } catch (error) {
    logger.error('Error syncing local work order to Buildium', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
