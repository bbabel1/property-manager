import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireSupabaseAdmin } from '@/lib/supabase-client'

// GET /api/work-orders
// Searches local work_orders table with filters
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const propertyId = searchParams.get('propertyId') || ''
    const unitId = searchParams.get('unitId') || ''
    const category = searchParams.get('category') || ''
    const scheduledFrom = searchParams.get('scheduledFrom') || ''
    const scheduledTo = searchParams.get('scheduledTo') || ''
    const limit = Number(searchParams.get('limit') || '50')
    const offset = Number(searchParams.get('offset') || '0')

    const supabaseAdmin = requireSupabaseAdmin('search work orders')
    const { data, error } = await (supabaseAdmin.functions as any).invoke('buildium-sync', {
      body: {
        entityType: 'workOrder',
        operation: 'searchLocal',
        entityData: {
          q, status, priority, propertyId, unitId, category, scheduledFrom, scheduledTo, limit, offset
        }
      }
    })
    if (error || !data?.success) {
      logger.error('Local work orders search via Edge failed', error)
      return NextResponse.json({ error: 'Failed to search work orders' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: data.data || [], count: data.count || 0 })
  } catch (error) {
    logger.error({ error }, 'Error searching local work orders')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
