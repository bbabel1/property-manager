import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { BuildiumOwnerRequestCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers'

// NOTE: Endpoint path based on Buildium docs conventions (align with your account)
const OWNER_REQUESTS_ENDPOINT = `${process.env.BUILDIUM_BASE_URL}/rentals/ownerrequests`

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('owner requests sync')
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin')

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const orderby = searchParams.get('orderby')
    const status = searchParams.get('status')
    const ownerId = searchParams.get('ownerId')
    const propertyId = searchParams.get('propertyId')
    const unitId = searchParams.get('unitId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const queryParams = new URLSearchParams()
    if (limit) queryParams.append('limit', limit)
    if (offset) queryParams.append('offset', offset)
    if (orderby) queryParams.append('orderby', orderby!)
    if (status) queryParams.append('status', status!)
    if (ownerId) queryParams.append('ownerId', ownerId!)
    if (propertyId) queryParams.append('propertyId', propertyId!)
    if (unitId) queryParams.append('unitId', unitId!)
    if (dateFrom) queryParams.append('dateFrom', dateFrom!)
    if (dateTo) queryParams.append('dateTo', dateTo!)

    const response = await fetch(`${OWNER_REQUESTS_ENDPOINT}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium owner requests fetch failed')
      return NextResponse.json({ error: 'Failed to fetch owner requests from Buildium', details: errorData }, { status: response.status })
    }

    const ownerRequests = await response.json()

    // Optional response filtering by RequestedByUserEntity.Type
    const requestedByTypeParam = searchParams.get('requestedByType')
    const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true'
    const requestedTypes = (requestedByTypeParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const filtered = Array.isArray(ownerRequests) && requestedTypes.length > 0
      ? ownerRequests.filter((item: any) => {
          const t = item?.RequestedByUserEntity?.Type
          if (!t) return includeUnspecified
          return requestedTypes.includes(String(t).toLowerCase())
        })
      : ownerRequests

    // Persist to local tasks with task_kind='owner'
    try {
      await Promise.all(
        (Array.isArray(ownerRequests) ? ownerRequests : []).map(async (item: any) => {
          const localData = await mapTaskFromBuildiumWithRelations(item, supabaseAdmin, { taskKind: 'owner' })
          const buildiumId = item?.Id
          if (!buildiumId) return
          const { data: existing } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('buildium_task_id', buildiumId)
            .maybeSingle()
          const now = new Date().toISOString()
          if (existing?.id) {
            await supabaseAdmin.from('tasks').update({ ...localData, updated_at: now }).eq('id', existing.id)
          } else {
            await supabaseAdmin.from('tasks').insert({ ...localData, created_at: now, updated_at: now })
          }
        })
      )
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist some Owner requests to tasks')
    }

    logger.info('Buildium owner requests fetched successfully')
    return NextResponse.json({ success: true, data: filtered, count: Array.isArray(filtered) ? filtered.length : 0 })
  } catch (error) {
    logger.error('Error fetching Buildium owner requests')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('owner requests sync')
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin')

    const body = await request.json()
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerRequestCreateSchema)

    const response = await fetch(OWNER_REQUESTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium owner request creation failed')
      return NextResponse.json({ error: 'Failed to create owner request in Buildium', details: errorData }, { status: response.status })
    }

    const ownerRequest = await response.json()
    logger.info('Buildium owner request created successfully')

    // Persist created Owner request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(ownerRequest, supabaseAdmin, { taskKind: 'owner' })
      const now = new Date().toISOString()
      await supabaseAdmin.from('tasks').insert({ ...localData, created_at: now, updated_at: now })
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist created Owner request to tasks')
    }

    return NextResponse.json({ success: true, data: ownerRequest }, { status: 201 })
  } catch (error) {
    logger.error('Error creating Buildium owner request')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
