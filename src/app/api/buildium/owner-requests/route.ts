import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { BuildiumOwnerRequestCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers'
import { buildiumFetch } from '@/lib/buildium-http'

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

    const params: Record<string, string> = {}
    if (limit) params.limit = limit
    if (offset) params.offset = offset
    if (orderby) params.orderby = orderby
    if (status) params.status = status
    if (ownerId) params.ownerId = ownerId
    if (propertyId) params.propertyId = propertyId
    if (unitId) params.unitId = unitId
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo

    const response = await buildiumFetch('GET', '/rentals/ownerrequests', params, undefined, undefined)

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium owner requests fetch failed')
      return NextResponse.json({ error: 'Failed to fetch owner requests from Buildium', details: errorData }, { status: response.status })
    }

    const ownerRequests = response.json ?? []

    // Optional response filtering by RequestedByUserEntity.Type
    const requestedByTypeParam = searchParams.get('requestedByType')
    const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true'
    const requestedTypes = (requestedByTypeParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const filtered = Array.isArray(ownerRequests) && requestedTypes.length > 0
      ? ownerRequests.filter((item) => {
          const t = (item as { RequestedByUserEntity?: { Type?: unknown } })?.RequestedByUserEntity?.Type
          if (!t) return includeUnspecified
          return requestedTypes.includes(String(t).toLowerCase())
        })
      : ownerRequests

    // Persist to local tasks with task_kind='owner'
    try {
      await Promise.all(
        (Array.isArray(ownerRequests) ? ownerRequests : []).map(async (item) => {
          const localData = await mapTaskFromBuildiumWithRelations(item, supabaseAdmin, { taskKind: 'owner' })
          const buildiumId = item?.Id
          if (!buildiumId) return
          const subject =
            typeof (localData as { subject?: unknown }).subject === 'string'
              ? (localData as { subject?: string }).subject
              : ''
          const { data: existing } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('buildium_task_id', buildiumId)
            .maybeSingle()
          const now = new Date().toISOString()
          if (existing?.id) {
            await supabaseAdmin
              .from('tasks')
              .update({ ...localData, subject, updated_at: now } as any)
              .eq('id', existing.id)
          } else {
            await supabaseAdmin
              .from('tasks')
              .insert({ ...localData, subject, created_at: now, updated_at: now } as any)
          }
        })
      )
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist some Owner requests to tasks')
    }

    logger.info('Buildium owner requests fetched successfully')
    return NextResponse.json({ success: true, data: filtered, count: Array.isArray(filtered) ? filtered.length : 0 })
  } catch (error) {
    logger.error({ error });
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

    const response = await buildiumFetch('POST', '/rentals/ownerrequests', undefined, validatedData, undefined)

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium owner request creation failed')
      return NextResponse.json({ error: 'Failed to create owner request in Buildium', details: errorData }, { status: response.status })
    }

    const ownerRequest = response.json ?? {}
    logger.info('Buildium owner request created successfully')

    // Persist created Owner request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(ownerRequest, supabaseAdmin, { taskKind: 'owner' })
      const now = new Date().toISOString()
      const subject =
        typeof (localData as { subject?: unknown }).subject === 'string'
          ? (localData as { subject?: string }).subject
          : ''
      await supabaseAdmin
        .from('tasks')
        .insert({ ...localData, subject, created_at: now, updated_at: now } as any)
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist created Owner request to tasks')
    }

    return NextResponse.json({ success: true, data: ownerRequest }, { status: 201 })
  } catch (error) {
    logger.error({ error });
    logger.error('Error creating Buildium owner request')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
