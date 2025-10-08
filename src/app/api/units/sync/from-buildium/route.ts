import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import UnitService from '@/lib/unit-service'

// POST /api/units/sync/from-buildium
// Body: { propertyIds?: number[]|string, lastUpdatedFrom?, lastUpdatedTo?, orderby?, limit?, offset? }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()

    const body = (await request.json().catch(() => ({}))) as Record<string, any>
    const params = {
      propertyIds: body.propertyIds ?? body.propertyids ?? body.propertyId,
      lastUpdatedFrom: body.lastUpdatedFrom ?? body.lastupdatedfrom,
      lastUpdatedTo: body.lastUpdatedTo ?? body.lastupdatedto,
      orderby: body.orderby,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      offset: typeof body.offset === 'number' ? body.offset : undefined,
      persist: true as const
    }

    const items = await UnitService.listFromBuildium(params)
    logger.info(`Synced ${items.length} units from Buildium to DB`)
    return NextResponse.json({ success: true, synced: items.length })
  } catch (error) {
    logger.error({ error }, 'Error syncing units from Buildium')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
