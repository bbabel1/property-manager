import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

// POST /api/work-orders/sync/to-buildium
// Body: { localId: string }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireRole('platform_admin')
    const guardResult = await getBuildiumOrgIdOr403(request)
    if ('response' in guardResult) return guardResult.response

    const body = (await request.json().catch(() => ({}))) as Record<string, any>
    const localId = body?.localId as string
    if (!localId) {
      return NextResponse.json({ error: 'localId is required' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin.functions as any).invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'syncLocalById', entityData: { localId } }
    })
    if (error || !data?.success) {
      return NextResponse.json({ error: data?.error || 'Sync failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, buildiumId: data?.data?.Id })
  } catch (error) {
    logger.error({ error }, 'Error syncing local work order to Buildium')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
